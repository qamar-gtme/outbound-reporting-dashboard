#!/usr/bin/env tsx
/**
 * Sync open.cx Smartlead campaigns into Supabase.
 *
 * Reads:
 *   SMARTLEAD_API_KEY_OPENCX (preferred) or SMARTLEAD_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Writes:
 *   public.smartlead_campaigns  (upsert by id)
 *   public.smartlead_sync_runs  (one summary row per run)
 *
 * Idempotent. Safe to re-run on a cron.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- env loader (no extra dep) --------------------------------------------
function loadDotEnv(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // missing .env is fine; rely on real env
  }
}
loadDotEnv(resolve(process.cwd(), ".env.local"));
loadDotEnv(resolve(process.cwd(), ".env"));

const SMARTLEAD_KEY =
  process.env.SMARTLEAD_API_KEY_OPENCX || process.env.SMARTLEAD_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_WRITE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SMARTLEAD_KEY) {
  console.error(
    "Missing SMARTLEAD_API_KEY_OPENCX (or SMARTLEAD_API_KEY). Set in .env.local.",
  );
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_WRITE_KEY) {
  console.error(
    "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or anon key).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_WRITE_KEY, {
  auth: { persistSession: false },
});

// --- types ----------------------------------------------------------------
type RawCampaign = {
  id: number;
  name: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  schedule_start_time?: string | null;
  client_id?: number | null;
  user_id?: number | null;
  track_settings?: unknown;
  scheduler_cron_value?: unknown;
  min_time_btwn_emails?: number | null;
  max_leads_per_day?: number | null;
  parent_campaign_id?: number | null;
  [k: string]: unknown;
};

// --- fetch ----------------------------------------------------------------
async function fetchAllCampaigns(): Promise<RawCampaign[]> {
  const url = `https://server.smartlead.ai/api/v1/campaigns?api_key=${SMARTLEAD_KEY}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Smartlead /campaigns failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (Array.isArray(body)) return body as RawCampaign[];
  // tolerant: some Smartlead endpoints wrap in { data: [...] } or { campaigns: [...] }
  if (Array.isArray((body as any).data)) return (body as any).data;
  if (Array.isArray((body as any).campaigns)) return (body as any).campaigns;
  throw new Error(
    `Unexpected /campaigns response shape: ${JSON.stringify(body).slice(0, 200)}`,
  );
}

// --- shape mapper ---------------------------------------------------------
function toRow(c: RawCampaign) {
  // start_date / end_date are NOT in the list response; fall back to
  // schedule_start_time when present so the column isn't empty for every row.
  const startDate =
    c.start_date ??
    (typeof c.schedule_start_time === "string" ? c.schedule_start_time : null);

  // scheduler_cron_value can be either a cron string or an object describing
  // the send window — stringify objects so the text column always holds something
  // useful.
  let cronText: string | null = null;
  if (c.scheduler_cron_value != null) {
    cronText =
      typeof c.scheduler_cron_value === "string"
        ? c.scheduler_cron_value
        : JSON.stringify(c.scheduler_cron_value);
  }

  return {
    id: c.id,
    name: c.name,
    status: c.status,
    created_at: c.created_at ?? null,
    start_date: startDate,
    end_date: c.end_date ?? null,
    client_id: c.client_id ?? null,
    user_id: c.user_id ?? null,
    track_settings: c.track_settings ?? null,
    scheduler_cron_value: cronText,
    min_time_btwn_emails: c.min_time_btwn_emails ?? null,
    max_leads_per_day: c.max_leads_per_day ?? null,
    parent_campaign_id: c.parent_campaign_id ?? null,
    raw: c as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  };
}

// --- main -----------------------------------------------------------------
async function main() {
  const startedAt = Date.now();
  let fetched = 0;
  let upserted = 0;
  let errText: string | null = null;

  try {
    console.log("Fetching campaigns from Smartlead...");
    const campaigns = await fetchAllCampaigns();
    fetched = campaigns.length;
    console.log(`  -> ${fetched} campaigns received.`);

    // Snapshot pre-existing ids so the run summary can report new vs updated.
    const { data: existing, error: existingErr } = await supabase
      .from("smartlead_campaigns")
      .select("id");
    if (existingErr) throw existingErr;
    const existingIds = new Set<number>((existing ?? []).map((r: any) => r.id));

    const rows = campaigns.map(toRow);

    // Upsert in chunks of 500 — Smartlead returns ~100 campaigns today but
    // be safe against growth.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("smartlead_campaigns")
        .upsert(slice, { onConflict: "id" });
      if (error) throw error;
      upserted += slice.length;
    }

    const newCount = rows.filter((r) => !existingIds.has(r.id)).length;
    const updatedCount = upserted - newCount;

    const statusBreakdown: Record<string, number> = {};
    for (const r of rows) {
      statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1;
    }

    console.log(
      `Synced ${upserted} campaigns (${newCount} new / ${updatedCount} updated).`,
    );
    console.log(`Status breakdown: ${JSON.stringify(statusBreakdown)}`);
    console.log(`Took ${Date.now() - startedAt}ms.`);
  } catch (err: any) {
    errText = err?.message ?? String(err);
    console.error("Sync failed:", errText);
  }

  // Always log the run, success or failure.
  const { error: runErr } = await supabase.from("smartlead_sync_runs").insert({
    campaigns_fetched: fetched,
    campaigns_upserted: upserted,
    errors: errText,
  });
  if (runErr) {
    console.error("Failed to write smartlead_sync_runs row:", runErr.message);
  }

  if (errText) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
