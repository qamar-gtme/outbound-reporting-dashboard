/**
 * Smartlead per-campaign ICP/TAM coverage sync.
 *
 * For every campaign in `smartlead_campaigns`:
 *   1. Fetch the full lead list via /campaigns/{id}/leads (paginated).
 *   2. Fetch /campaigns/{id}/statistics (paginated) and aggregate per-email
 *      sent_count + replied_count.
 *   3. Upsert into public.smartlead_leads.
 *   4. Classify any lead with classified_vertical IS NULL using OpenAI against
 *      the v3 taxonomy in public.tam_industries/subindustries/verticals.
 *   5. Rebuild public.smartlead_campaign_icp_coverage (vertical + sub + mega
 *      rollup rows so the UI can read at any depth).
 *
 * Env (read at call time):
 *   SMARTLEAD_API_KEY_OPENCX   (preferred) or SMARTLEAD_API_KEY
 *   OPENAI_API_KEY_OPENCX      (preferred) or OPENAI_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Idempotent. Skips classification if title or company_name is missing.
 * Never touches the OutSearched Smartlead key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SmartleadIcpSyncResult = {
  campaigns_processed: number;
  leads_fetched: number;
  leads_upserted: number;
  stats_rows_processed: number;
  leads_to_classify: number;
  leads_classified: number;
  coverage_rows_written: number;
  classification_cost_usd_estimate: number;
  errors: string | null;
  ran_at: string;
  duration_ms: number;
};

type LeadRow = {
  smartlead_lead_id: number;
  campaign_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  title: string | null;
  country: string | null;
  linkedin_url: string | null;
  custom_fields: Record<string, unknown> | null;
  status: string | null;
  is_replied: boolean;
  reply_count: number;
  sent_count: number;
};

type TaxonomyLite = {
  // Tree shape passed in the GPT prompt.
  tree: Array<{
    mega_slug: string;
    mega_label: string;
    subs: Array<{
      sub_slug: string;
      sub_label: string;
      verticals: Array<{ vertical_slug: string; vertical_label: string }>;
    }>;
  }>;
  // Lookup of vertical_slug -> { mega_slug, sub_slug } for validation.
  verticalIndex: Map<string, { mega_slug: string; sub_slug: string }>;
};

// ─── Env ──────────────────────────────────────────────────────────────────────

function readEnv() {
  const SMARTLEAD_KEY =
    process.env.SMARTLEAD_API_KEY_OPENCX || process.env.SMARTLEAD_API_KEY;
  const OPENAI_KEY =
    process.env.OPENAI_API_KEY_OPENCX || process.env.OPENAI_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_WRITE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SMARTLEAD_KEY) {
    throw new Error("Missing SMARTLEAD_API_KEY_OPENCX (or SMARTLEAD_API_KEY).");
  }
  if (!OPENAI_KEY) {
    throw new Error("Missing OPENAI_API_KEY_OPENCX (or OPENAI_API_KEY).");
  }
  if (!SUPABASE_URL || !SUPABASE_WRITE_KEY) {
    throw new Error(
      "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or anon key).",
    );
  }
  return { SMARTLEAD_KEY, OPENAI_KEY, SUPABASE_URL, SUPABASE_WRITE_KEY };
}

// ─── Smartlead fetch helpers ──────────────────────────────────────────────────

const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function smartleadGet(url: string): Promise<any> {
  // Conservative 1 req/sec; retry on 429 with exponential backoff.
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429) {
      const wait = Math.min(60_000, 2 ** attempt * 1000);
      await SLEEP(wait);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Smartlead GET ${res.status} ${res.statusText} :: ${url.replace(/api_key=[^&]+/, "api_key=***")}`);
    }
    return res.json();
  }
  throw new Error(`Smartlead GET exhausted retries: ${url.replace(/api_key=[^&]+/, "api_key=***")}`);
}

async function fetchAllLeads(
  apiKey: string,
  campaignId: number,
  log: (m: string) => void,
): Promise<any[]> {
  const PAGE = 100;
  const out: any[] = [];
  let offset = 0;
  let total: number | null = null;
  for (let safety = 0; safety < 1000; safety++) {
    const url = `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/leads?api_key=${apiKey}&offset=${offset}&limit=${PAGE}`;
    const body = await smartleadGet(url);
    const rows: any[] = body?.data ?? [];
    if (total == null) total = Number(body?.total_leads ?? 0);
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += rows.length;
    if (total > 0 && out.length >= total) break;
    await SLEEP(800);
  }
  log(`  leads: ${out.length}/${total ?? "?"}`);
  return out;
}

async function fetchAllStats(
  apiKey: string,
  campaignId: number,
  log: (m: string) => void,
): Promise<any[]> {
  const PAGE = 500;
  const out: any[] = [];
  let offset = 0;
  let total: number | null = null;
  for (let safety = 0; safety < 1000; safety++) {
    const url = `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/statistics?api_key=${apiKey}&offset=${offset}&limit=${PAGE}`;
    const body = await smartleadGet(url);
    const rows: any[] = body?.data ?? [];
    if (total == null) total = Number(body?.total_stats ?? 0);
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += rows.length;
    if (total > 0 && out.length >= total) break;
    await SLEEP(800);
  }
  log(`  stats: ${out.length}/${total ?? "?"}`);
  return out;
}

// ─── Lead transform ───────────────────────────────────────────────────────────

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  return String(v);
}

// Smartlead's lead.custom_fields often carries title (varies per campaign).
// Probe a few common field names so we don't need a per-campaign mapping.
const TITLE_KEYS = [
  "title",
  "Title",
  "job_title",
  "JobTitle",
  "position",
  "role",
];
const COUNTRY_KEYS = ["country", "Country", "location_country"];

function pickFromCustom(
  custom: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!custom) return null;
  for (const k of keys) {
    const v = (custom as any)[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractCountry(location: string | null, custom: any): string | null {
  const fromCustom = pickFromCustom(custom, COUNTRY_KEYS);
  if (fromCustom) return fromCustom;
  if (!location) return null;
  // "London Area, United Kingdom, United Kingdom" → "United Kingdom"
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function rawToLeadRow(raw: any, campaignId: number): LeadRow | null {
  const lead = raw?.lead ?? raw;
  const id = Number(lead?.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const custom = (lead?.custom_fields as Record<string, unknown>) ?? null;
  const status = asString(raw?.status) ?? asString(lead?.status);
  return {
    smartlead_lead_id: id,
    campaign_id: campaignId,
    email: asString(lead?.email)?.toLowerCase() ?? null,
    first_name: asString(lead?.first_name),
    last_name: asString(lead?.last_name),
    company_name: asString(lead?.company_name),
    title: pickFromCustom(custom, TITLE_KEYS),
    country: extractCountry(asString(lead?.location), custom),
    linkedin_url: asString(lead?.linkedin_profile),
    custom_fields: custom,
    status,
    is_replied: status === "REPLIED",
    reply_count: 0,
    sent_count: 0,
  };
}

// ─── Stat aggregation ─────────────────────────────────────────────────────────

type StatAgg = { sent: number; replied: number };

function aggregateStats(stats: any[]): Map<string, StatAgg> {
  const m = new Map<string, StatAgg>();
  for (const s of stats) {
    const email = asString(s?.lead_email)?.toLowerCase();
    if (!email) continue;
    const sent = s?.sent_time ? 1 : 0;
    const replied = s?.reply_time ? 1 : 0;
    const cur = m.get(email) ?? { sent: 0, replied: 0 };
    cur.sent += sent;
    cur.replied += replied;
    m.set(email, cur);
  }
  return m;
}

// ─── Taxonomy loader ──────────────────────────────────────────────────────────

async function loadTaxonomy(sb: SupabaseClient): Promise<TaxonomyLite> {
  const { data: megasRaw, error: e1 } = await sb
    .from("tam_industries")
    .select("id, slug, name, deprecated_at")
    .is("deprecated_at", null)
    .limit(5000);
  if (e1) throw e1;
  const { data: subsRaw, error: e2 } = await sb
    .from("tam_subindustries")
    .select("id, industry_id, slug, name, deprecated_at")
    .is("deprecated_at", null)
    .limit(5000);
  if (e2) throw e2;
  const { data: vertsRaw, error: e3 } = await sb
    .from("tam_verticals")
    .select("id, subindustry_id, slug, name, deprecated_at")
    .is("deprecated_at", null)
    .limit(5000);
  if (e3) throw e3;

  const megas = megasRaw ?? [];
  const subs = subsRaw ?? [];
  const verts = vertsRaw ?? [];

  const megaById = new Map<number, any>();
  for (const m of megas) megaById.set(m.id as number, m);
  const subById = new Map<number, any>();
  for (const s of subs) subById.set(s.id as number, s);

  const subsByMega = new Map<number, any[]>();
  for (const s of subs) {
    if (!subsByMega.has(s.industry_id)) subsByMega.set(s.industry_id, []);
    subsByMega.get(s.industry_id)!.push(s);
  }
  const vertsBySub = new Map<number, any[]>();
  for (const v of verts) {
    if (!vertsBySub.has(v.subindustry_id)) vertsBySub.set(v.subindustry_id, []);
    vertsBySub.get(v.subindustry_id)!.push(v);
  }

  const verticalIndex = new Map<string, { mega_slug: string; sub_slug: string }>();
  const tree = megas
    .slice()
    .sort((a: any, b: any) => String(a.slug).localeCompare(String(b.slug)))
    .map((m: any) => ({
      mega_slug: m.slug,
      mega_label: m.name,
      subs: (subsByMega.get(m.id) ?? [])
        .sort((a: any, b: any) => String(a.slug).localeCompare(String(b.slug)))
        .map((s: any) => {
          const vs = (vertsBySub.get(s.id) ?? []).map((v: any) => {
            verticalIndex.set(v.slug, { mega_slug: m.slug, sub_slug: s.slug });
            return { vertical_slug: v.slug, vertical_label: v.name };
          });
          return { sub_slug: s.slug, sub_label: s.name, verticals: vs };
        }),
    }));

  return { tree, verticalIndex };
}

// ─── Classification (OpenAI) ──────────────────────────────────────────────────

const OPENAI_MODEL = "gpt-4o-mini";
// Pricing (USD per 1M tokens) — gpt-4o-mini
const PRICE_IN = 0.15 / 1_000_000;
const PRICE_OUT = 0.60 / 1_000_000;

function buildSystemPrompt(tax: TaxonomyLite): string {
  const lines: string[] = [];
  lines.push(
    "You are classifying B2B leads against open.cx's v3 industry taxonomy (19 megas / 110 subs / 339 verticals).",
  );
  lines.push("Pick the single best vertical for each lead. Output mega/sub/vertical slugs EXACTLY as listed below.");
  lines.push("When `company` is null, infer the company from the `domain` field (e.g. domain=tailscale.com → Tailscale, a B2B SaaS networking company → tech-software).");
  lines.push("Disregard personal-email domains (gmail.com, outlook.com, yahoo.com, hotmail.com, icloud.com); those return null slugs.");
  lines.push("If the company is clearly a CX vendor / outsourced support / BPO, classify under tech-software or professional-legal-services accordingly.");
  lines.push("If you genuinely cannot infer a company from either field, return null slugs and confidence 0.");
  lines.push("");
  lines.push("TAXONOMY:");
  for (const m of tax.tree) {
    lines.push(`# ${m.mega_slug} — ${m.mega_label}`);
    for (const s of m.subs) {
      const vs = s.verticals
        .map((v) => `${v.vertical_slug}=${v.vertical_label}`)
        .join("; ");
      lines.push(`  ${s.sub_slug} — ${s.sub_label}: ${vs}`);
    }
  }
  return lines.join("\n");
}

type ClassifyOut = {
  email: string;
  mega: string | null;
  sub: string | null;
  vertical: string | null;
  confidence: number;
};

async function classifyBatch(
  apiKey: string,
  systemPrompt: string,
  leads: LeadRow[],
  log: (m: string) => void,
): Promise<{ results: ClassifyOut[]; usage: { in: number; out: number } }> {
  const userPayload = {
    leads: leads.map((l) => {
      const domain = l.email ? (l.email.split("@")[1] ?? null) : null;
      return {
        email: l.email,
        company: l.company_name,
        domain,
        title: l.title,
        country: l.country,
      };
    }),
  };

  const body = {
    model: OPENAI_MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "icp_classifications",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["classifications"],
          properties: {
            classifications: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["email", "mega", "sub", "vertical", "confidence"],
                properties: {
                  email: { type: "string" },
                  mega: { type: ["string", "null"] },
                  sub: { type: ["string", "null"] },
                  vertical: { type: ["string", "null"] },
                  confidence: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Classify each lead below. Return one entry per input lead, with the email echoed verbatim.\n\n" +
          JSON.stringify(userPayload),
      },
    ],
  };

  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const errBody = await res.text();
      lastErr = `OpenAI ${res.status}: ${errBody.slice(0, 300)}`;
      // Quota / billing failures will return 429 forever — surface immediately
      // so the run aborts with a clear message instead of "exhausted retries".
      if (/insufficient_quota|exceeded your current quota|billing/i.test(errBody)) {
        throw new Error(lastErr);
      }
      const wait = Math.min(30_000, 2 ** attempt * 1000);
      await SLEEP(wait);
      continue;
    }
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
    }
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content ?? "";
    const usage = payload?.usage ?? {};
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      log(`  parse fail: ${(content as string).slice(0, 200)}`);
      return {
        results: [],
        usage: { in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0 },
      };
    }
    return {
      results: (parsed?.classifications as ClassifyOut[]) ?? [],
      usage: { in: usage.prompt_tokens ?? 0, out: usage.completion_tokens ?? 0 },
    };
  }
  throw new Error(`OpenAI exhausted retries — last: ${lastErr || "unknown"}`);
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runSmartleadIcpSync(opts?: {
  log?: (m: string) => void;
  classifyBatchSize?: number;
  maxConcurrentBatches?: number;
}): Promise<SmartleadIcpSyncResult> {
  const log = opts?.log ?? (() => {});
  const BATCH = opts?.classifyBatchSize ?? 10;
  const startedAt = Date.now();
  const ranAt = new Date().toISOString();

  let leadsFetched = 0;
  let leadsUpserted = 0;
  let statsProcessed = 0;
  let toClassify = 0;
  let classified = 0;
  let coverageRows = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let errText: string | null = null;

  try {
    const env = readEnv();
    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_WRITE_KEY, {
      auth: { persistSession: false },
    });

    // Step 1: pull list of campaigns we own.
    const { data: campaigns, error: ce } = await sb
      .from("smartlead_campaigns")
      .select("id, name, status")
      .order("id");
    if (ce) throw ce;
    log(`Campaigns to process: ${(campaigns ?? []).length}`);

    // Step 2: per-campaign — fetch leads + stats and upsert.
    for (const c of campaigns ?? []) {
      log(`Campaign ${c.id} (${c.status}) — ${c.name}`);
      const [leadsRaw, statsRaw] = await Promise.all([
        fetchAllLeads(env.SMARTLEAD_KEY, c.id as number, log),
        fetchAllStats(env.SMARTLEAD_KEY, c.id as number, log),
      ]);
      statsProcessed += statsRaw.length;
      const agg = aggregateStats(statsRaw);

      const rows: LeadRow[] = [];
      for (const raw of leadsRaw) {
        const row = rawToLeadRow(raw, c.id as number);
        if (!row) continue;
        const a = row.email ? agg.get(row.email) : undefined;
        if (a) {
          row.sent_count = a.sent;
          row.reply_count = a.replied;
          if (a.replied > 0) row.is_replied = true;
        }
        rows.push(row);
      }
      leadsFetched += rows.length;

      // Upsert in chunks of 500.
      for (let i = 0; i < rows.length; i += 500) {
        const slice = rows.slice(i, i + 500).map((r) => ({
          ...r,
          synced_at: new Date().toISOString(),
        }));
        const { error } = await sb
          .from("smartlead_leads")
          .upsert(slice, { onConflict: "smartlead_lead_id,campaign_id" });
        if (error) throw error;
        leadsUpserted += slice.length;
      }
    }

    log(`Leads upserted: ${leadsUpserted}`);

    // Step 3: classify any lead with classified_vertical NULL and enough info.
    const tax = await loadTaxonomy(sb);
    const systemPrompt = buildSystemPrompt(tax);
    log(`Taxonomy: ${tax.verticalIndex.size} verticals indexed.`);

    // Fetch leads that need classification. Smartlead's lead endpoint does NOT
    // return title — only company_name + email + location. For industry/TAM
    // classification, company_name (or, as fallback, the email domain) is
    // sufficient. We require at least one of those — leads with neither get
    // zero-confidence and stay NULL.
    //
    // Page in chunks because PostgREST caps server-side at 1000 rows.
    const allNullCls: LeadRow[] = [];
    const PAGE_SEL = 1000;
    for (let from = 0; from < 200_000; from += PAGE_SEL) {
      const { data: page, error: pe } = await sb
        .from("smartlead_leads")
        .select(
          "smartlead_lead_id, campaign_id, email, company_name, title, country",
        )
        .is("classified_vertical", null)
        .order("smartlead_lead_id", { ascending: true })
        .range(from, from + PAGE_SEL - 1);
      if (pe) throw pe;
      const rows = (page ?? []) as LeadRow[];
      if (rows.length === 0) break;
      allNullCls.push(...rows);
      if (rows.length < PAGE_SEL) break;
    }
    const needCls = allNullCls.filter((l) => {
      const hasCompany = !!(l.company_name && l.company_name.trim());
      const hasDomain = !!(l.email && /@[^.]+\.[^.]+/.test(l.email));
      return hasCompany || hasDomain;
    });
    const skipCls = allNullCls.filter((l) => !needCls.includes(l));
    toClassify = needCls.length;
    log(`Leads needing classification: ${toClassify} (skipping ${skipCls.length} with no company/domain)`);

    // Mark zero-confidence rows for leads with neither company_name nor a
    // usable email domain so we don't keep returning to them.
    for (let i = 0; i < skipCls.length; i += 500) {
      const ids = skipCls.slice(i, i + 500);
      if (ids.length === 0) break;
      const { error: zeroErr } = await sb
        .from("smartlead_leads")
        .update({
          classification_confidence: 0,
          classification_model: OPENAI_MODEL,
          classified_at: new Date().toISOString(),
        })
        .in("smartlead_lead_id", ids.map((r) => r.smartlead_lead_id));
      if (zeroErr) log(`(warn) zero-confidence update failed: ${zeroErr.message}`);
    }

    if (toClassify > 0) {
      const items = needCls as LeadRow[];
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        try {
          const { results, usage } = await classifyBatch(
            env.OPENAI_KEY,
            systemPrompt,
            batch,
            log,
          );
          tokensIn += usage.in;
          tokensOut += usage.out;

          const byEmail = new Map<string, ClassifyOut>();
          for (const r of results) {
            if (r?.email) byEmail.set(r.email.toLowerCase(), r);
          }

          for (const lead of batch) {
            const r = lead.email ? byEmail.get(lead.email.toLowerCase()) : undefined;
            let mega: string | null = null;
            let sub: string | null = null;
            let vert: string | null = null;
            let conf = 0;
            if (r && r.vertical) {
              const idx = tax.verticalIndex.get(r.vertical);
              if (idx) {
                vert = r.vertical;
                // Trust taxonomy index over model output for mega/sub.
                mega = idx.mega_slug;
                sub = idx.sub_slug;
                conf = Math.max(0, Math.min(1, Number(r.confidence) || 0));
              } else {
                log(`  invalid vertical slug from model: ${r.vertical}`);
              }
            }
            const { error: ue } = await sb
              .from("smartlead_leads")
              .update({
                classified_mega: mega,
                classified_sub: sub,
                classified_vertical: vert,
                classification_confidence: conf,
                classification_model: OPENAI_MODEL,
                classified_at: new Date().toISOString(),
              })
              .eq("smartlead_lead_id", lead.smartlead_lead_id)
              .eq("campaign_id", lead.campaign_id);
            if (ue) log(`  update fail: ${ue.message}`);
            else if (vert) classified++;
          }
          if (i % (BATCH * 10) === 0) {
            log(
              `  classified ${Math.min(i + BATCH, items.length)}/${items.length}`,
            );
          }
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          log(`  batch ${i} failed: ${msg}`);
          // Quota / billing failures aren't going to recover within this run.
          // Stop classifying so we don't burn an hour on the same 429. Still
          // proceed to coverage rebuild on whatever was successfully tagged.
          if (/insufficient_quota|exceeded your current quota|billing/i.test(msg)) {
            log("  abort classification: OpenAI quota exhausted; continuing to coverage rebuild");
            errText = msg;
            break;
          }
        }
      }
    }

    // Step 4: rebuild coverage (vertical + sub-rollup + mega-rollup rows).
    // Page because PostgREST caps server-side at 1000 rows.
    const covRows: any[] = [];
    for (let from = 0; from < 500_000; from += 1000) {
      const { data: page, error: cqe } = await sb
        .from("smartlead_leads")
        .select(
          "campaign_id, classified_mega, classified_sub, classified_vertical, sent_count, is_replied",
        )
        .not("classified_vertical", "is", null)
        .order("smartlead_lead_id", { ascending: true })
        .range(from, from + 999);
      if (cqe) throw cqe;
      const rows = page ?? [];
      if (rows.length === 0) break;
      covRows.push(...rows);
      if (rows.length < 1000) break;
    }

    type CovKey = { campaign_id: number; mega: string; sub: string; vert: string };
    const cov = new Map<
      string,
      { campaign_id: number; mega_slug: string; sub_slug: string; vertical_slug: string; lead_count: number; sent_count: number; replied_count: number }
    >();

    const bump = (
      campaignId: number,
      mega: string,
      sub: string,
      vert: string,
      sent: number,
      replied: number,
    ) => {
      const key = `${campaignId}::${mega}::${sub}::${vert}`;
      const cur = cov.get(key) ?? {
        campaign_id: campaignId,
        mega_slug: mega,
        sub_slug: sub,
        vertical_slug: vert,
        lead_count: 0,
        sent_count: 0,
        replied_count: 0,
      };
      cur.lead_count += 1;
      cur.sent_count += sent;
      cur.replied_count += replied;
      cov.set(key, cur);
    };

    for (const r of covRows as any[]) {
      const cid = r.campaign_id as number;
      const mega = r.classified_mega as string;
      const sub = (r.classified_sub as string) ?? "";
      const vert = (r.classified_vertical as string) ?? "";
      const sent = Number(r.sent_count) || 0;
      const replied = r.is_replied ? 1 : 0;
      // Vertical row
      bump(cid, mega, sub, vert, sent, replied);
      // Sub rollup
      bump(cid, mega, sub, "", sent, replied);
      // Mega rollup
      bump(cid, mega, "", "", sent, replied);
    }

    // Wipe and rewrite coverage for the campaigns we just processed.
    const campaignIds = (campaigns ?? []).map((c: any) => c.id as number);
    if (campaignIds.length > 0) {
      const { error: del } = await sb
        .from("smartlead_campaign_icp_coverage")
        .delete()
        .in("campaign_id", campaignIds);
      if (del) throw del;
    }

    const covList = Array.from(cov.values()).map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < covList.length; i += 500) {
      const slice = covList.slice(i, i + 500);
      const { error } = await sb
        .from("smartlead_campaign_icp_coverage")
        .upsert(slice, { onConflict: "campaign_id,mega_slug,sub_slug,vertical_slug" });
      if (error) throw error;
      coverageRows += slice.length;
    }
    log(`Coverage rows written: ${coverageRows}`);
  } catch (err: any) {
    errText = err?.message ?? String(err);
    log(`Sync failed: ${errText}`);
  }

  // Invalidate cached pages that depend on lead/coverage data. Wrapped in a
  // try/catch + dynamic import so the standalone tsx script path (no
  // Next.js context) still works.
  if (!errText && (leadsUpserted > 0 || coverageRows > 0)) {
    try {
      const { updateTag } = await import("next/cache");
      updateTag("smartlead-leads");
      updateTag("smartlead-coverage");
      updateTag("home");
    } catch {
      // Standalone script context — nothing to invalidate.
    }
  }

  const costUsd = tokensIn * PRICE_IN + tokensOut * PRICE_OUT;

  return {
    campaigns_processed: 0,
    leads_fetched: leadsFetched,
    leads_upserted: leadsUpserted,
    stats_rows_processed: statsProcessed,
    leads_to_classify: toClassify,
    leads_classified: classified,
    coverage_rows_written: coverageRows,
    classification_cost_usd_estimate: Number(costUsd.toFixed(4)),
    errors: errText,
    ran_at: ranAt,
    duration_ms: Date.now() - startedAt,
  };
}
