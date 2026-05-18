/**
 * Reusable Smartlead → Supabase sync.
 *
 * Reads env at call time:
 *   SMARTLEAD_API_KEY_OPENCX (preferred) or SMARTLEAD_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Writes:
 *   public.smartlead_campaigns  (upsert by id)
 *   public.smartlead_sync_runs  (one summary row per run)
 *
 * Idempotent. Safe to re-run on a cron or from the script.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SmartleadSyncResult = {
  campaigns_fetched: number;
  campaigns_upserted: number;
  campaigns_new: number;
  campaigns_updated: number;
  status_breakdown: Record<string, number>;
  errors: string | null;
  ran_at: string;
  duration_ms: number;
};

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

function readEnv() {
  const SMARTLEAD_KEY =
    process.env.SMARTLEAD_API_KEY_OPENCX || process.env.SMARTLEAD_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_WRITE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SMARTLEAD_KEY) {
    throw new Error(
      "Missing SMARTLEAD_API_KEY_OPENCX (or SMARTLEAD_API_KEY).",
    );
  }
  if (!SUPABASE_URL || !SUPABASE_WRITE_KEY) {
    throw new Error(
      "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or anon key).",
    );
  }
  return { SMARTLEAD_KEY, SUPABASE_URL, SUPABASE_WRITE_KEY };
}

async function fetchAllCampaigns(apiKey: string): Promise<RawCampaign[]> {
  const url = `https://server.smartlead.ai/api/v1/campaigns?api_key=${apiKey}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(
      `Smartlead /campaigns failed: ${res.status} ${res.statusText}`,
    );
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

function toRow(c: RawCampaign) {
  // start_date / end_date are NOT in the list response; fall back to
  // schedule_start_time when present so the column isn't empty for every row.
  const startDate =
    c.start_date ??
    (typeof c.schedule_start_time === "string" ? c.schedule_start_time : null);

  // scheduler_cron_value can be either a cron string or an object describing
  // the send window — stringify objects so the text column always holds
  // something useful.
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

export async function runSmartleadSync(options?: {
  log?: (msg: string) => void;
}): Promise<SmartleadSyncResult> {
  const log = options?.log ?? (() => {});
  const startedAt = Date.now();
  const ranAt = new Date().toISOString();

  let fetched = 0;
  let upserted = 0;
  let newCount = 0;
  let updatedCount = 0;
  const statusBreakdown: Record<string, number> = {};
  let errText: string | null = null;

  let supabase: SupabaseClient | null = null;
  let env: ReturnType<typeof readEnv> | null = null;

  try {
    env = readEnv();
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_WRITE_KEY, {
      auth: { persistSession: false },
    });

    log("Fetching campaigns from Smartlead...");
    const campaigns = await fetchAllCampaigns(env.SMARTLEAD_KEY);
    fetched = campaigns.length;
    log(`  -> ${fetched} campaigns received.`);

    // Snapshot pre-existing ids so the run summary can report new vs updated.
    const { data: existing, error: existingErr } = await supabase
      .from("smartlead_campaigns")
      .select("id");
    if (existingErr) throw existingErr;
    const existingIds = new Set<number>(
      (existing ?? []).map((r: any) => r.id),
    );

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

    newCount = rows.filter((r) => !existingIds.has(r.id)).length;
    updatedCount = upserted - newCount;

    for (const r of rows) {
      statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1;
    }

    log(
      `Synced ${upserted} campaigns (${newCount} new / ${updatedCount} updated).`,
    );
    log(`Status breakdown: ${JSON.stringify(statusBreakdown)}`);
    log(`Took ${Date.now() - startedAt}ms.`);
  } catch (err: any) {
    errText = err?.message ?? String(err);
    log(`Sync failed: ${errText}`);
  }

  // Always log the run, success or failure — only if Supabase client built.
  if (supabase) {
    const { error: runErr } = await supabase
      .from("smartlead_sync_runs")
      .insert({
        campaigns_fetched: fetched,
        campaigns_upserted: upserted,
        errors: errText,
      });
    if (runErr) {
      log(`Failed to write smartlead_sync_runs row: ${runErr.message}`);
    }
  }

  // Invalidate the dashboard's cached pages so the next user request gets
  // fresh data. Only do this if (a) the sync succeeded, and (b) we're inside
  // a Next.js request/build context (i.e. the cron route, not the standalone
  // script). The dynamic import + try/catch keeps `tsx scripts/...` working.
  if (!errText && upserted > 0) {
    try {
      const { updateTag } = await import("next/cache");
      updateTag("smartlead-campaigns");
      updateTag("home");
    } catch {
      // Not in a Next.js request context — that's fine (CLI script path).
    }
  }

  return {
    campaigns_fetched: fetched,
    campaigns_upserted: upserted,
    campaigns_new: newCount,
    campaigns_updated: updatedCount,
    status_breakdown: statusBreakdown,
    errors: errText,
    ran_at: ranAt,
    duration_ms: Date.now() - startedAt,
  };
}
