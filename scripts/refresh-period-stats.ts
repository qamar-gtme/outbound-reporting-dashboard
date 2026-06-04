#!/usr/bin/env tsx
/**
 * Refresh the stale period stats rows that the dashboard reads from:
 *   - smartlead_account_totals (id=1)
 *   - hs_period_stats (period_id=1)
 *
 * Both were one-shot CSV ETLs; nothing refreshes them. This script pulls live
 * data and overwrites the row.
 *
 * Run:
 *   tsx scripts/refresh-period-stats.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadDotEnv(resolve(process.cwd(), ".env.local"));
loadDotEnv(resolve(process.cwd(), ".env"));

const SL_KEY = process.env.SMARTLEAD_API_KEY_OPENCX!;
const HS_KEY = process.env.OPENCX_HUBSPOT_KEY ?? process.env.HUBSPOT_KEY!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SL_KEY || !HS_KEY || !SB_URL || !SB_KEY) {
  console.error("Missing env: SMARTLEAD_API_KEY_OPENCX, OPENCX_HUBSPOT_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sbHeaders = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function refreshSmartleadTotals() {
  console.log("\n=== Smartlead totals ===");
  const cRes = await fetch(`https://server.smartlead.ai/api/v1/campaigns?api_key=${SL_KEY}`);
  const campaigns: any[] = await cRes.json();
  const active = campaigns.filter((c) => c.status === "ACTIVE");
  console.log(`  ${campaigns.length} campaigns total, ${active.length} active`);

  let totals = {
    campaigns_active: active.length,
    total_sent: 0,
    total_delivered: 0,
    total_opens: 0,
    total_replies: 0,
    total_positive_replies: 0,
    total_meetings_booked: 0,
    total_bounces: 0,
    total_unsubscribes: 0,
    total_spam_complaints: 0,
    domains_warming: 0,
    domains_active: 0,
    inboxes_total: 0,
  };

  for (const c of campaigns) {
    try {
      const r = await fetch(
        `https://server.smartlead.ai/api/v1/campaigns/${c.id}/analytics?api_key=${SL_KEY}`,
      );
      const a = await r.json();
      totals.total_sent += Number(a.sent_count ?? 0);
      totals.total_opens += Number(a.open_count ?? 0);
      totals.total_replies += Number(a.reply_count ?? 0);
      totals.total_bounces += Number(a.bounce_count ?? 0);
      totals.total_unsubscribes += Number(a.unsubscribed_count ?? 0);
      console.log(`  ${c.id} ${c.name?.slice(0, 35)}: sent=${a.sent_count} replies=${a.reply_count}`);
    } catch (e: any) {
      console.error(`  ${c.id} analytics failed: ${e.message}`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setUTCDate(1);

  const row = {
    id: 1,
    period_label: "current-month",
    period_start: monthStart.toISOString().slice(0, 10),
    period_end: today,
    ...totals,
    pulled_at: new Date().toISOString(),
  };

  const r = await fetch(`${SB_URL}/rest/v1/smartlead_account_totals?id=eq.1`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    console.error(`  upsert failed ${r.status}: ${await r.text()}`);
  } else {
    console.log(`  totals upserted: sent=${totals.total_sent} replies=${totals.total_replies}`);
  }
  return totals;
}

async function hsFetch(path: string, method: "GET" | "POST", body?: any): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`https://api.hubapi.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${HS_KEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) {
      const wait = Number(r.headers.get("retry-after") ?? 1);
      await new Promise((res) => setTimeout(res, wait * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`HS ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  throw new Error(`HS retry exhausted ${path}`);
}

async function hsCountSearch(object: string, filters: any[]): Promise<number> {
  const body = { filterGroups: [{ filters }], limit: 1 };
  const d = await hsFetch(`/crm/v3/objects/${object}/search`, "POST", body);
  return d.total ?? 0;
}

async function refreshHsPeriodStats() {
  console.log("\n=== HubSpot period stats ===");

  // Anchor window to last 30 days for "current" stats. The existing row was a
  // Mar-Apr snapshot; we're switching to rolling 30d so the dashboard surfaces
  // recent activity, not a frozen quarter.
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startMs = start.getTime();
  console.log(`  window: ${start.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);

  const totalDealsCreated = await hsCountSearch("deals", [
    { propertyName: "createdate", operator: "GTE", value: String(startMs) },
  ]);
  const closedWonCount = await hsCountSearch("deals", [
    { propertyName: "dealstage", operator: "EQ", value: "closedwon" },
    { propertyName: "closedate", operator: "GTE", value: String(startMs) },
  ]);
  const closedLostCount = await hsCountSearch("deals", [
    { propertyName: "dealstage", operator: "EQ", value: "closedlost" },
    { propertyName: "closedate", operator: "GTE", value: String(startMs) },
  ]);
  const openDealsCount = await hsCountSearch("deals", [
    { propertyName: "dealstage", operator: "NEQ", value: "closedwon" },
    { propertyName: "dealstage", operator: "NEQ", value: "closedlost" },
  ]);

  // SDR-owned meetings via outbound_meetings table if it exists.
  let sdrOwnedMeetings = 0;
  let sdrOwnedDeals = 0;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/outbound_meetings?select=count&channel=in.(sdr_dial,cold_email)&meeting_start=gte.${start.toISOString()}`,
      { headers: { ...sbHeaders, Prefer: "count=exact" } },
    );
    if (r.ok) {
      const cr = r.headers.get("content-range") ?? "";
      const m = cr.match(/\/(\d+)$/);
      if (m) sdrOwnedMeetings = Number(m[1]);
    }
  } catch {}

  console.log(
    `  deals_created=${totalDealsCreated} won=${closedWonCount} lost=${closedLostCount} open=${openDealsCount} sdr_meetings=${sdrOwnedMeetings}`,
  );

  const row = {
    period_id: 1,
    total_meetings_booked_org: null,
    total_deals_created_org: totalDealsCreated,
    closed_won_count: closedWonCount,
    closed_won_amount: 0,
    closed_lost_count: closedLostCount,
    closed_lost_amount: 0,
    open_deals_count: openDealsCount,
    sdr_owned_meetings: sdrOwnedMeetings,
    sdr_owned_deals: sdrOwnedDeals,
    closed_won_total_ever: null,
    pulled_at: new Date().toISOString(),
  };

  const r = await fetch(`${SB_URL}/rest/v1/hs_period_stats?period_id=eq.1`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    console.error(`  upsert failed ${r.status}: ${await r.text()}`);
  } else {
    console.log("  hs_period_stats updated");
  }
}

const SDR_OWNER_MAP: Record<string, { name: string; region: "US" | "UK" | "Saudi" }> = {
  "90233609": { name: "Mahmoud Hilali", region: "US" },
  "90578410": { name: "Ghaith Salameh", region: "US" },
  "90983233": { name: "Waseem Shetaiwi", region: "US" },
  "90233610": { name: "Ikremah Yaghi", region: "US" },
};

async function refreshHsMeetingsByOwner() {
  console.log("\n=== HubSpot meetings by SDR ===");
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startMs = start.getTime();

  // Search per US SDR owner — we only care about US SDR meetings here per Wahaj feedback.
  const out: { period_id: number; hubspot_owner_id: number; owner_name: string; meetings_count: number; is_sdr: boolean; sdr_region: string }[] = [];
  for (const [oid, meta] of Object.entries(SDR_OWNER_MAP)) {
    let count = 0;
    let after: string | undefined;
    while (true) {
      const body: any = {
        filterGroups: [
          {
            filters: [
              { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
              { propertyName: "hs_meeting_start_time", operator: "GTE", value: String(startMs) },
            ],
          },
        ],
        properties: ["hs_meeting_title"],
        limit: 100,
      };
      if (after) body.after = after;
      const d = await hsFetch("/crm/v3/objects/meetings/search", "POST", body);
      count += (d.results ?? []).length;
      after = d.paging?.next?.after;
      if (!after) break;
    }
    out.push({
      period_id: 1,
      hubspot_owner_id: Number(oid),
      owner_name: meta.name,
      meetings_count: count,
      is_sdr: true,
      sdr_region: meta.region,
    });
    console.log(`  ${meta.name}: ${count} meetings`);
  }

  // Wipe period=1 rows and reinsert. PostgREST doesn't support TRUNCATE so
  // delete then upsert.
  const delRes = await fetch(
    `${SB_URL}/rest/v1/hs_meetings_by_owner?period_id=eq.1`,
    { method: "DELETE", headers: sbHeaders },
  );
  if (!delRes.ok) {
    console.error(`  delete failed ${delRes.status}: ${await delRes.text()}`);
    return;
  }
  const ins = await fetch(`${SB_URL}/rest/v1/hs_meetings_by_owner`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify(out),
  });
  if (!ins.ok) {
    console.error(`  insert failed ${ins.status}: ${await ins.text()}`);
    return;
  }
  console.log(`  hs_meetings_by_owner refreshed with ${out.length} rows`);
}

(async () => {
  await refreshSmartleadTotals();
  await refreshHsPeriodStats();
  await refreshHsMeetingsByOwner();
  console.log("\n done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
