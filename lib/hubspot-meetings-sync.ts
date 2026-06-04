/**
 * HubSpot meetings sync.
 *
 * Pulls every meeting booked in HubSpot in the last N days, classifies channel
 * (sdr_dial / cold_email / cold_email_or_inbound / inbound / customer_success
 * / unknown) and upserts into `public.outbound_meetings`.
 *
 * Mirrors the Python `pull_all_meetings.py` reference script in
 * `~/Desktop/Qam/claude-code/systems/opencx-backward-mine/`. Keep both in sync
 * when classification rules change.
 */

import { updateTag } from "next/cache";

type Logger = (msg: string) => void;

type Owner = { id: string; firstName?: string; lastName?: string };
type Meeting = { id: string; properties: Record<string, string | null> };

const HS_BASE = "https://api.hubapi.com";

const SDR_NAMES: Record<string, string[]> = {
  us: ["Mahmoud", "Khaled", "Ghaith", "Waseem", "Ikremah", "Kaze"],
  uk: ["Awad", "Ronan"],
  saudi: ["Laith", "Aseel", "Mohammed Alherz", "Alars"],
};
const CLOSER_NAMES = ["Mo Gharbat", "Wahaj", "Tom", "Farah Eibayat"];

const DISCOVERY_PATTERNS = [
  /discovery/i,
  /\bintro\b/i,
  /\binitial\b/i,
  /\<\>/,
  /\bx\s+open/i,
  /open\s+x\s+/i,
  /first meeting/i,
  /qualifi/i,
];
const CS_RECURRING_PATTERNS = [
  /daily/i,
  /weekly/i,
  /standup/i,
  /check\s*in/i,
  /sync\b/i,
  /working session/i,
  /go live/i,
  /kickoff/i,
  /onboarding/i,
];

function classifyOwner(o: Owner): { role: string; region: string } {
  const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim().toLowerCase();
  for (const [region, names] of Object.entries(SDR_NAMES)) {
    for (const n of names) if (name.includes(n.toLowerCase())) return { role: "sdr", region };
  }
  for (const c of CLOSER_NAMES) if (name.includes(c.toLowerCase())) return { role: "closer", region: "global" };
  return { role: "other", region: "" };
}

async function hsFetch(path: string, init: RequestInit, key: string): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`${HS_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    if (r.status === 429) {
      const wait = Number(r.headers.get("retry-after") ?? 1 + attempt * 2);
      await new Promise((res) => setTimeout(res, wait * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`HubSpot ${r.status} ${path}: ${await r.text()}`);
    return r.json();
  }
  throw new Error(`HubSpot max retries on ${path}`);
}

async function listOwners(key: string): Promise<Owner[]> {
  const out: Owner[] = [];
  let after: string | undefined;
  while (true) {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const d = await hsFetch(`/crm/v3/owners?${params}`, { method: "GET" }, key);
    out.push(...d.results);
    after = d.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

async function searchMeetingsSince(startEpochMs: number, key: string): Promise<Meeting[]> {
  const out: Meeting[] = [];
  let after: string | undefined;
  while (true) {
    const body: any = {
      filterGroups: [
        { filters: [{ propertyName: "hs_meeting_start_time", operator: "GTE", value: String(startEpochMs) }] },
      ],
      sorts: [{ propertyName: "hs_meeting_start_time", direction: "DESCENDING" }],
      properties: [
        "hs_meeting_title",
        "hs_meeting_outcome",
        "hs_timestamp",
        "hubspot_owner_id",
        "hs_meeting_start_time",
      ],
      limit: 100,
    };
    if (after) body.after = after;
    const d = await hsFetch("/crm/v3/objects/meetings/search", { method: "POST", body: JSON.stringify(body) }, key);
    out.push(...d.results);
    after = d.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

async function batchAssoc(mids: string[], to: string, key: string): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (let i = 0; i < mids.length; i += 100) {
    const chunk = mids.slice(i, i + 100);
    const d = await hsFetch(
      `/crm/v3/associations/meetings/${to}/batch/read`,
      { method: "POST", body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }) },
      key,
    );
    for (const r of d.results) out[r.from.id] = (r.to ?? []).map((t: any) => t.id);
  }
  return out;
}

async function batchCompanies(ids: string[], key: string): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  const uniq = Array.from(new Set(ids));
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const body = {
      inputs: chunk.map((id) => ({ id })),
      properties: [
        "name",
        "domain",
        "industry",
        "numberofemployees",
        "country",
        "hs_lead_source",
        "lifecyclestage",
      ],
    };
    const d = await hsFetch("/crm/v3/objects/companies/batch/read", { method: "POST", body: JSON.stringify(body) }, key);
    for (const r of d.results) out[r.id] = r.properties ?? {};
  }
  return out;
}

async function smartleadDomainSet(sbUrl: string, sbKey: string): Promise<Set<string>> {
  // Only replied leads. Domain-only match was too loose: Microsoft / Cognism
  // appeared because we cold-emailed someone there once. A meeting is
  // cold_email only when a contact at that domain actually replied.
  const domains = new Set<string>();
  let offset = 0;
  const page = 5000;
  while (true) {
    const url =
      `${sbUrl}/rest/v1/smartlead_leads?select=email&is_replied=eq.true` +
      `&limit=${page}&offset=${offset}`;
    const r = await fetch(url, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    });
    if (!r.ok) throw new Error(`smartlead_leads fetch ${r.status}: ${await r.text()}`);
    const rows: { email: string | null }[] = await r.json();
    if (!rows.length) break;
    for (const row of rows) {
      const em = row.email ?? "";
      if (em.includes("@")) domains.add(em.split("@", 2)[1].toLowerCase().trim());
    }
    if (rows.length < page) break;
    offset += page;
  }
  return domains;
}

export type SyncOpts = { log?: Logger; days?: number };
export type SyncResult = {
  ok: boolean;
  meetings_fetched: number;
  meetings_upserted: number;
  channel_counts: Record<string, number>;
  duration_ms: number;
  ran_at: string;
  errors?: string;
};

export async function runHubSpotMeetingsSync(opts: SyncOpts = {}): Promise<SyncResult> {
  const log: Logger = opts.log ?? (() => {});
  const days = opts.days ?? 120;
  const t0 = Date.now();
  const ranAt = new Date().toISOString();

  const hsKey = process.env.OPENCX_HUBSPOT_KEY ?? process.env.HUBSPOT_KEY ?? "";
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!hsKey) throw new Error("OPENCX_HUBSPOT_KEY env var required");
  if (!sbUrl || !sbKey) throw new Error("Supabase env vars required");

  const start = Date.now() - days * 24 * 60 * 60 * 1000;
  log(`pulling meetings since ${new Date(start).toISOString()}`);

  const owners = await listOwners(hsKey);
  const ownerClass = new Map(owners.map((o) => [o.id, classifyOwner(o)]));
  const ownerLabel = new Map(
    owners.map((o) => [o.id, `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim()]),
  );
  log(`${owners.length} owners loaded`);

  const meetings = await searchMeetingsSince(start, hsKey);
  log(`${meetings.length} meetings in window`);

  const mids = meetings.map((m) => m.id);
  const cosBy = await batchAssoc(mids, "companies", hsKey);
  const dealsBy = await batchAssoc(mids, "deals", hsKey);
  const contactsBy = await batchAssoc(mids, "contacts", hsKey);

  const allCids = Array.from(new Set(Object.values(cosBy).flat()));
  const cprops = await batchCompanies(allCids, hsKey);

  const slDomains = await smartleadDomainSet(sbUrl, sbKey);
  log(`smartlead domain set: ${slDomains.size}`);

  const rows = meetings.map((m) => {
    const p = m.properties ?? {};
    const oid = p.hubspot_owner_id ?? "";
    const { role, region } = ownerClass.get(oid) ?? { role: "unknown", region: "" };
    const cos = cosBy[m.id] ?? [];
    const cprof = cos[0] ? cprops[cos[0]] ?? {} : {};
    const domain = (cprof.domain ?? "").toString().toLowerCase().trim();
    const inSmartlead = !!domain && slDomains.has(domain);
    const title = p.hs_meeting_title ?? "";
    const isRecurring = CS_RECURRING_PATTERNS.some((r) => r.test(title));
    const isDiscovery = !isRecurring && DISCOVERY_PATTERNS.some((r) => r.test(title));

    let channel: string;
    if (isRecurring) channel = "customer_success";
    else if (role === "sdr") channel = "sdr_dial";
    else if (role === "closer" && inSmartlead) channel = "cold_email";
    else if (role === "closer" && isDiscovery) channel = "cold_email_or_inbound";
    else if (role === "closer") channel = "inbound";
    else if (inSmartlead) channel = "cold_email";
    else channel = "unknown";

    return {
      meeting_id: m.id,
      meeting_title: p.hs_meeting_title || null,
      meeting_outcome: p.hs_meeting_outcome || null,
      meeting_start: p.hs_meeting_start_time || null,
      owner_id: oid || null,
      owner_name: ownerLabel.get(oid) || null,
      owner_role: role,
      owner_region: region,
      channel,
      is_discovery: isDiscovery,
      is_recurring: isRecurring,
      company_id: cos[0] || null,
      company_name: cprof.name || null,
      company_domain: domain || null,
      company_industry: cprof.industry || null,
      company_employees: cprof.numberofemployees ? Number(cprof.numberofemployees) : null,
      company_country: cprof.country || null,
      company_in_smartlead: inSmartlead,
      lead_source: cprof.hs_lead_source || null,
      icp_tier: cprof.icp_tier || null,
      deal_ids: (dealsBy[m.id] ?? []).join(",") || null,
      contact_count: (contactsBy[m.id] ?? []).length,
    };
  });

  // Upsert in batches.
  let upserted = 0;
  const channelCounts: Record<string, number> = {};
  for (const r of rows) channelCounts[r.channel] = (channelCounts[r.channel] ?? 0) + 1;

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = await fetch(`${sbUrl}/rest/v1/outbound_meetings`, {
      method: "POST",
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`outbound_meetings upsert ${r.status}: ${txt.slice(0, 500)}`);
    }
    upserted += chunk.length;
    log(`upserted ${upserted}/${rows.length}`);
  }

  // Invalidate dashboard cache tags so /meetings re-renders.
  try {
    updateTag("meetings");
    updateTag("outbound-meetings");
  } catch {
    // updateTag may not be available outside Next request scope.
  }

  return {
    ok: true,
    meetings_fetched: meetings.length,
    meetings_upserted: upserted,
    channel_counts: channelCounts,
    duration_ms: Date.now() - t0,
    ran_at: ranAt,
  };
}
