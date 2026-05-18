import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";
import { CompanyTable, type Lead } from "./CompanyTable";

/**
 * /segments — companies-by-bucket report for Smartlead outbound.
 *
 * Drill: default view = list of megas. Click a mega → sub list. Click a sub →
 * vertical list. Click a vertical (or "Show all companies at this level") →
 * the leaf company table. Filters (campaign, replied-only, search) are URL
 * params so the view is shareable. Search + sort + pagination + CSV export
 * are handled by the client island `<CompanyTable />`.
 *
 * Built for Wahaj Ahmed (v3 taxonomy reviewer) to inspect exactly which
 * companies sit in which bucket.
 */

type Campaign = {
  id: number;
  name: string;
  status: string;
};

type Industry = {
  slug: string;
  name: string;
  id?: number;
};

type Sub = {
  slug: string;
  name: string;
  industry_id?: number;
};

type Vertical = {
  slug: string;
  name: string;
  subindustry_id?: number;
};

async function loadSegments() {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag("smartlead-leads", "smartlead-campaigns", "smartlead-coverage");

  // Pull leads with only the columns the table actually renders to keep the
  // payload small (≈400KB serialized for 7.4k rows). Ordering replied-first so
  // the natural cache order is already useful.
  const leadsQuery =
    "smartlead_leads?select=smartlead_lead_id,company_name,title,country,email,linkedin_url,status,is_replied,reply_count,sent_count,classification_confidence,classified_mega,classified_sub,classified_vertical,campaign_id&order=is_replied.desc.nullslast,reply_count.desc.nullslast,sent_count.desc.nullslast&limit=10000";

  const [leads, campaigns, megas, subs, verticals] = await Promise.all([
    fetchTable(leadsQuery) as Promise<Lead[]>,
    fetchTable(
      "smartlead_campaigns?select=id,name,status&order=id.asc&limit=500",
    ) as Promise<Campaign[]>,
    fetchTable(
      "tam_industries?select=id,slug,name&deprecated_at=is.null&limit=200",
    ) as Promise<(Industry & { id: number })[]>,
    fetchTable(
      "tam_subindustries?select=slug,name,industry_id&deprecated_at=is.null&limit=500",
    ) as Promise<Sub[]>,
    fetchTable(
      "tam_verticals?select=slug,name,subindustry_id&deprecated_at=is.null&limit=1000",
    ) as Promise<Vertical[]>,
  ]);

  return { leads, campaigns, megas, subs, verticals };
}

type SP = {
  mega?: string;
  sub?: string;
  vertical?: string;
  campaign?: string;
  replied?: string;
  search?: string;
  page?: string;
};

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const params = (await searchParams) ?? {};
  const megaFilter = (params.mega ?? "").trim() || null;
  const subFilter = (params.sub ?? "").trim() || null;
  const vertFilter = (params.vertical ?? "").trim() || null;
  const campaignFilter = params.campaign ? Number(params.campaign) : null;
  const repliedOnly = params.replied === "1";
  const initialSearch = (params.search ?? "").trim();
  const initialPage = Math.max(1, Number(params.page) || 1);

  const { leads, campaigns, megas, subs, verticals } = await loadSegments();

  // Build pretty-name lookups (slug → name) from the taxonomy.
  const megaNameBySlug = new Map<string, string>();
  for (const m of megas) megaNameBySlug.set(m.slug, m.name);
  const megaIdBySlug = new Map<string, number>();
  for (const m of megas) if (m.id != null) megaIdBySlug.set(m.slug, m.id);

  const subsByMegaId = new Map<number, Sub[]>();
  const subNameBySlug = new Map<string, string>();
  for (const s of subs) {
    subNameBySlug.set(s.slug, s.name);
    if (s.industry_id != null) {
      if (!subsByMegaId.has(s.industry_id)) subsByMegaId.set(s.industry_id, []);
      subsByMegaId.get(s.industry_id)!.push(s);
    }
  }

  // For "verticals belonging to a sub" we need a slug→id map for subs.
  const subIdBySlug = new Map<string, number>();
  // We didn't fetch sub id; refetch is unnecessary because we can look it up
  // via the verticals table that already carries subindustry_id. Build the
  // reverse map by joining: for each vertical, its subindustry_id; we get the
  // sub slug from `subs` by matching id. So we need sub.id too.
  // -> Defer: instead, group verticals by subindustry_id.
  const vertsBySubId = new Map<number, Vertical[]>();
  const vertNameBySlug = new Map<string, string>();
  for (const v of verticals) {
    vertNameBySlug.set(v.slug, v.name);
    if (v.subindustry_id != null) {
      if (!vertsBySubId.has(v.subindustry_id))
        vertsBySubId.set(v.subindustry_id, []);
      vertsBySubId.get(v.subindustry_id)!.push(v);
    }
  }

  const campaignNamesById: Record<string, string> = {};
  for (const c of campaigns) campaignNamesById[String(c.id)] = c.name;

  // ─── Server-side filter pipeline ────────────────────────────────────────
  // Apply mega/sub/vertical/campaign/replied here; client island layers
  // search + sort + pagination on top of the result.
  const filtered = leads.filter((l) => {
    if (megaFilter && l.classified_mega !== megaFilter) return false;
    if (subFilter && l.classified_sub !== subFilter) return false;
    if (vertFilter && l.classified_vertical !== vertFilter) return false;
    if (campaignFilter != null && l.campaign_id !== campaignFilter)
      return false;
    if (repliedOnly && !l.is_replied) return false;
    return true;
  });

  // ─── KPI strip — always computed off the FULL classified lead set, not
  // the filtered one. The KPIs answer "what does our outbound look like?" not
  // "what's in this filter?" — keep them stable as filters change.
  const classifiedAll = leads.filter((l) => l.classified_mega);
  const uniqueCompanies = new Set(
    classifiedAll.map((l) => (l.company_name ?? "").toLowerCase()).filter(Boolean),
  ).size;
  const megasHit = new Set(classifiedAll.map((l) => l.classified_mega)).size;
  const vertsHit = new Set(
    classifiedAll.map((l) => l.classified_vertical).filter(Boolean),
  ).size;
  const repliedCompanies = new Set(
    classifiedAll
      .filter((l) => l.is_replied)
      .map((l) => (l.company_name ?? "").toLowerCase())
      .filter(Boolean),
  ).size;
  const overallSent = classifiedAll.reduce((s, l) => s + (l.sent_count ?? 0), 0);
  const overallReplies = classifiedAll.reduce(
    (s, l) => s + (l.reply_count ?? 0),
    0,
  );
  const overallReplyRate = overallSent > 0 ? overallReplies / overallSent : null;

  // ─── Pre-aggregate counts per mega/sub/vertical for the chip strips and
  // accordion drill. Build using the *partially-filtered* dataset so a chip's
  // count reflects what selecting it would yield (minus its own dimension).
  const leadsAfterCampaignReplied = leads.filter((l) => {
    if (campaignFilter != null && l.campaign_id !== campaignFilter)
      return false;
    if (repliedOnly && !l.is_replied) return false;
    return l.classified_mega != null;
  });

  const megaCounts = new Map<string, number>();
  for (const l of leadsAfterCampaignReplied) {
    const k = l.classified_mega!;
    megaCounts.set(k, (megaCounts.get(k) ?? 0) + 1);
  }

  const subCounts = new Map<string, number>();
  if (megaFilter) {
    for (const l of leadsAfterCampaignReplied) {
      if (l.classified_mega !== megaFilter) continue;
      if (!l.classified_sub) continue;
      subCounts.set(
        l.classified_sub,
        (subCounts.get(l.classified_sub) ?? 0) + 1,
      );
    }
  }

  const vertCounts = new Map<string, number>();
  if (megaFilter && subFilter) {
    for (const l of leadsAfterCampaignReplied) {
      if (
        l.classified_mega !== megaFilter ||
        l.classified_sub !== subFilter ||
        !l.classified_vertical
      )
        continue;
      vertCounts.set(
        l.classified_vertical,
        (vertCounts.get(l.classified_vertical) ?? 0) + 1,
      );
    }
  }

  // The "show as table" affordance triggers the leaf company table. At the
  // root URL we instead render the accordion so the user gets an at-a-glance
  // bucket structure.
  const inLeafTableView =
    !!vertFilter ||
    !!params.search ||
    repliedOnly ||
    !!campaignFilter ||
    initialPage > 1;

  // Breadcrumb path so the user can step back.
  const crumbs: { label: string; href: string }[] = [
    { label: "All segments", href: "/segments" },
  ];
  if (megaFilter) {
    crumbs.push({
      label: megaNameBySlug.get(megaFilter) ?? prettify(megaFilter),
      href: buildUrl({ mega: megaFilter }),
    });
  }
  if (megaFilter && subFilter) {
    crumbs.push({
      label: subNameBySlug.get(subFilter) ?? prettify(subFilter),
      href: buildUrl({ mega: megaFilter, sub: subFilter }),
    });
  }
  if (megaFilter && subFilter && vertFilter) {
    crumbs.push({
      label: vertNameBySlug.get(vertFilter) ?? prettify(vertFilter),
      href: buildUrl({
        mega: megaFilter,
        sub: subFilter,
        vertical: vertFilter,
      }),
    });
  }

  const anyFilter =
    !!megaFilter ||
    !!subFilter ||
    !!vertFilter ||
    !!campaignFilter ||
    repliedOnly;

  // Order megas by lead count (largest first); preserves "most-outreached"
  // intuition rather than alpha order.
  const megaOrder = Array.from(megaCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const subOrder = Array.from(subCounts.entries()).sort((a, b) => b[1] - a[1]);
  const vertOrder = Array.from(vertCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  // CSV filename hint — bucket label or "all".
  const csvBase = vertFilter
    ? vertFilter
    : subFilter
      ? subFilter
      : megaFilter
        ? megaFilter
        : "all";

  return (
    <div>
      <SectionHead
        eyebrow="Smartlead segments"
        title="Outreach by segment"
        description="Every company in our Smartlead outbound, classified to the v3 taxonomy. Drill from mega → sub → vertical to see who sits where, replies, and campaign source."
        source="smartlead_leads"
        actions={
          <Link
            href="/smartlead/icp"
            className="btn btn-sm btn-ghost"
            aria-label="View ICP coverage matrix"
          >
            ICP matrix →
          </Link>
        }
      />

      {/* KPI strip — outbound-wide totals (filters don't change these) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat
          n={uniqueCompanies}
          label="Companies outreached"
          hint="Unique classified company names"
        />
        <Stat n={megasHit} label="Megas hit" hint={`of ${megas.length} v3`} />
        <Stat
          n={vertsHit}
          label="Verticals hit"
          hint={`of ${verticals.length} v3`}
        />
        <Stat
          n={repliedCompanies}
          label="Replied companies"
          hint="Distinct repliers"
        />
        <Stat
          n={
            overallReplyRate != null
              ? `${(overallReplyRate * 100).toFixed(2)}%`
              : "—"
          }
          label="Reply rate"
          hint={`${overallReplies.toLocaleString()}/${overallSent.toLocaleString()}`}
        />
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-14 z-10 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-4 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          {/* Breadcrumb */}
          <nav
            aria-label="Segment breadcrumb"
            className="flex items-center flex-wrap gap-1 text-[11px] font-num"
          >
            {crumbs.map((c, i) => (
              <span key={c.href + i} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-dim">/</span>}
                {i === crumbs.length - 1 ? (
                  <span className="text-ink uppercase tracking-[0.06em]">
                    {c.label.replace(/-/g, " ")}
                  </span>
                ) : (
                  <Link
                    href={c.href as any}
                    className="text-muted hover:text-foreground uppercase tracking-[0.06em] transition-colors"
                  >
                    {c.label.replace(/-/g, " ")}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <span className="hidden md:block h-5 w-px bg-border mx-1" />

          {/* Campaign filter */}
          <details className="relative">
            <summary
              className={`inline-flex items-center h-7 px-2.5 rounded-md border font-num text-[11px] uppercase tracking-[0.06em] cursor-pointer list-none ${
                campaignFilter
                  ? "bg-foreground/10 text-foreground border-border-strong"
                  : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
              }`}
            >
              Campaign ·{" "}
              {campaignFilter
                ? campaigns.find((c) => c.id === campaignFilter)?.name?.slice(
                    0,
                    20,
                  ) ?? campaignFilter
                : "All"}
            </summary>
            <div className="absolute z-20 mt-1 min-w-[280px] rounded-md border border-border bg-popover p-1 shadow-lg">
              <DropdownLink
                href={buildUrl(stripCampaign({ ...params }))}
                active={!campaignFilter}
                label="All campaigns"
              />
              {campaigns.map((c) => (
                <DropdownLink
                  key={c.id}
                  href={buildUrl({ ...params, campaign: String(c.id) })}
                  active={campaignFilter === c.id}
                  label={`${c.name} · ${c.status}`}
                />
              ))}
            </div>
          </details>

          {/* Replied toggle */}
          <Link
            href={buildUrl(
              repliedOnly
                ? stripReplied({ ...params })
                : { ...params, replied: "1" },
            )}
            className={`inline-flex items-center h-7 px-2.5 rounded-md border font-num text-[11px] uppercase tracking-[0.06em] transition-colors ${
              repliedOnly
                ? "bg-accent/12 text-accent border-accent/40"
                : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
            }`}
          >
            {repliedOnly ? "✓ " : ""}Replied only
          </Link>

          {anyFilter && (
            <Link
              href="/segments"
              className="inline-flex items-center h-7 px-2.5 rounded-md border border-border bg-transparent text-muted hover:text-foreground hover:border-border-strong font-num text-[11px] uppercase tracking-[0.06em] transition-colors"
            >
              Reset
            </Link>
          )}

          <div className="ml-auto text-[11px] text-dim font-num hidden md:block">
            {filtered.length.toLocaleString()} match
            {filtered.length === 1 ? "" : "es"}
          </div>
        </div>

        {/* Mega chip row */}
        <div className="mt-2 -mx-1 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-1 pb-0.5 min-w-max">
            {megaOrder.length === 0 ? (
              <span className="text-[11px] text-dim italic px-1">
                No leads match the current campaign/replied filter.
              </span>
            ) : (
              megaOrder.map(([slug, count]) => (
                <Link
                  key={slug}
                  href={
                    megaFilter === slug
                      ? buildUrl(stripMegaDown({ ...params }))
                      : buildUrl({ ...stripMegaDown({ ...params }), mega: slug })
                  }
                  className={`inline-flex items-center h-7 px-2.5 rounded-md border font-num text-[10.5px] uppercase tracking-[0.06em] transition-colors whitespace-nowrap ${
                    megaFilter === slug
                      ? "bg-accent/12 text-accent border-accent/40"
                      : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
                  }`}
                  title={megaNameBySlug.get(slug) ?? slug}
                >
                  <span className="normal-case tracking-normal text-[12px]">
                    {megaNameBySlug.get(slug) ?? prettify(slug)}
                  </span>
                  <span className="ml-2 text-dim">{count.toLocaleString()}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Sub chip row — only when a mega is selected */}
        {megaFilter && subOrder.length > 0 && (
          <div className="mt-1.5 -mx-1 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-1 pb-0.5 min-w-max">
              <span className="text-[9.5px] text-dim uppercase tracking-[0.12em] font-num pl-1 pr-2">
                Sub
              </span>
              {subOrder.map(([slug, count]) => (
                <Link
                  key={slug}
                  href={
                    subFilter === slug
                      ? buildUrl({ ...stripSubDown({ ...params }) })
                      : buildUrl({
                          ...stripSubDown({ ...params }),
                          sub: slug,
                        })
                  }
                  className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] transition-colors whitespace-nowrap ${
                    subFilter === slug
                      ? "bg-foreground/10 text-foreground border-border-strong"
                      : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
                  }`}
                  title={subNameBySlug.get(slug) ?? slug}
                >
                  {subNameBySlug.get(slug) ?? prettify(slug)}
                  <span className="ml-1.5 text-dim font-num text-[10px]">
                    {count.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Vertical chip row — only when both mega + sub selected */}
        {megaFilter && subFilter && vertOrder.length > 0 && (
          <div className="mt-1.5 -mx-1 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-1 pb-0.5 min-w-max">
              <span className="text-[9.5px] text-dim uppercase tracking-[0.12em] font-num pl-1 pr-2">
                Vertical
              </span>
              {vertOrder.map(([slug, count]) => (
                <Link
                  key={slug}
                  href={
                    vertFilter === slug
                      ? buildUrl({
                          ...params,
                          vertical: undefined,
                          page: undefined,
                        })
                      : buildUrl({
                          ...params,
                          vertical: slug,
                          page: undefined,
                        })
                  }
                  className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] transition-colors whitespace-nowrap ${
                    vertFilter === slug
                      ? "bg-foreground/10 text-foreground border-border-strong"
                      : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
                  }`}
                  title={vertNameBySlug.get(slug) ?? slug}
                >
                  {vertNameBySlug.get(slug) ?? prettify(slug)}
                  <span className="ml-1.5 text-dim font-num text-[10px]">
                    {count.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body — accordion at root, table when drilled or any filter active */}
      {inLeafTableView || (megaFilter && subFilter && vertFilter) ? (
        <CompanyTable
          leads={filtered}
          campaignNamesById={campaignNamesById}
          initialPage={initialPage}
          showBreadcrumbCol={!megaFilter}
          csvBaseName={csvBase}
        />
      ) : megaFilter && subFilter ? (
        // Sub-level drill — show verticals as cards + "show all in sub" CTA.
        <BucketGrid
          rows={vertOrder.map(([slug, count]) => ({
            slug,
            name: vertNameBySlug.get(slug) ?? prettify(slug),
            count,
            href: buildUrl({
              mega: megaFilter,
              sub: subFilter,
              vertical: slug,
            }),
            stats: computeBucketStats(filtered, (l) => l.classified_vertical === slug),
          }))}
          emptyHint="No verticals classified within this sub yet."
          showAllHref={buildUrl({
            mega: megaFilter,
            sub: subFilter,
            search: " ",
          })}
          showAllLabel={`Show all ${filtered.length.toLocaleString()} companies in ${
            subNameBySlug.get(subFilter) ?? prettify(subFilter)
          }`}
        />
      ) : megaFilter ? (
        // Mega-level drill — show sub list with company-count + reply chips.
        <BucketGrid
          rows={subOrder.map(([slug, count]) => ({
            slug,
            name: subNameBySlug.get(slug) ?? prettify(slug),
            count,
            href: buildUrl({ mega: megaFilter, sub: slug }),
            stats: computeBucketStats(
              filtered,
              (l) => l.classified_sub === slug,
            ),
          }))}
          emptyHint="No subs classified within this mega yet."
          showAllHref={buildUrl({ mega: megaFilter, search: " " })}
          showAllLabel={`Show all ${filtered.length.toLocaleString()} companies in ${
            megaNameBySlug.get(megaFilter) ?? prettify(megaFilter)
          }`}
        />
      ) : (
        // Root — show all megas with sub-count + total counts.
        <BucketGrid
          rows={megaOrder.map(([slug, count]) => {
            const stats = computeBucketStats(
              leadsAfterCampaignReplied,
              (l) => l.classified_mega === slug,
            );
            // Count distinct subs/verticals inside this mega.
            const subSet = new Set<string>();
            const vertSet = new Set<string>();
            for (const l of leadsAfterCampaignReplied) {
              if (l.classified_mega !== slug) continue;
              if (l.classified_sub) subSet.add(l.classified_sub);
              if (l.classified_vertical) vertSet.add(l.classified_vertical);
            }
            return {
              slug,
              name: megaNameBySlug.get(slug) ?? prettify(slug),
              count,
              href: buildUrl({ mega: slug }),
              stats,
              hint: `${subSet.size} sub${subSet.size === 1 ? "" : "s"} · ${vertSet.size} vertical${
                vertSet.size === 1 ? "" : "s"
              }`,
            };
          })}
          emptyHint="No classified leads yet. Run npm run sync:smartlead-icp to populate."
          showAllHref="/segments?search= "
          showAllLabel={`Show every classified company (${leadsAfterCampaignReplied.length.toLocaleString()} rows)`}
        />
      )}

      <div className="mt-6 text-[11px] text-dim font-num">
        Source · <span className="text-ink2">smartlead_leads</span> · cached
        10m · v3 taxonomy ({megas.length} megas / {subs.length} subs /{" "}
        {verticals.length} verticals)
      </div>
    </div>
  );
}

/* ----- Helpers ---------------------------------------------------------- */

function prettify(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildUrl(params: Partial<SP>): string {
  const sp = new URLSearchParams();
  if (params.mega) sp.set("mega", params.mega);
  if (params.sub) sp.set("sub", params.sub);
  if (params.vertical) sp.set("vertical", params.vertical);
  if (params.campaign) sp.set("campaign", params.campaign);
  if (params.replied) sp.set("replied", params.replied);
  if (params.search) sp.set("search", params.search);
  if (params.page && params.page !== "1") sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/segments?${qs}` : "/segments";
}

// When user clicks a *different* mega, also drop sub/vertical/page since they
// no longer apply.
function stripMegaDown(p: Partial<SP>): Partial<SP> {
  return {
    ...p,
    mega: undefined,
    sub: undefined,
    vertical: undefined,
    page: undefined,
  };
}
function stripSubDown(p: Partial<SP>): Partial<SP> {
  return { ...p, sub: undefined, vertical: undefined, page: undefined };
}
function stripCampaign(p: Partial<SP>): Partial<SP> {
  return { ...p, campaign: undefined, page: undefined };
}
function stripReplied(p: Partial<SP>): Partial<SP> {
  return { ...p, replied: undefined, page: undefined };
}

function computeBucketStats<T extends Lead>(
  leads: T[],
  pred: (l: T) => boolean,
): { companies: number; sent: number; replied: number; replyRate: number | null } {
  const companies = new Set<string>();
  let sent = 0;
  let replied = 0;
  for (const l of leads) {
    if (!pred(l)) continue;
    if (l.company_name) companies.add(l.company_name.toLowerCase());
    sent += l.sent_count ?? 0;
    replied += l.reply_count ?? 0;
  }
  return {
    companies: companies.size,
    sent,
    replied,
    replyRate: sent > 0 ? replied / sent : null,
  };
}

function DropdownLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href as any}
      className={`block rounded px-2.5 py-1.5 text-[12px] truncate transition-colors ${
        active
          ? "bg-accent/10 text-accent"
          : "text-foreground hover:bg-surface2"
      }`}
    >
      {label}
    </Link>
  );
}

function BucketGrid({
  rows,
  emptyHint,
  showAllHref,
  showAllLabel,
}: {
  rows: {
    slug: string;
    name: string;
    count: number;
    href: string;
    hint?: string;
    stats: {
      companies: number;
      sent: number;
      replied: number;
      replyRate: number | null;
    };
  }[];
  emptyHint: string;
  showAllHref: string;
  showAllLabel: string;
}) {
  if (!rows.length) {
    return (
      <div className="card empty-state">
        <div className="empty-state-title">Nothing in this bucket</div>
        <div className="empty-state-hint">{emptyHint}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
        {rows.map((r) => (
          <Link
            key={r.slug}
            href={r.href as any}
            className="card px-4 py-3.5 group transition-colors hover:border-border-strong"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink truncate">
                  {r.name}
                </div>
                {r.hint && (
                  <div className="text-[10.5px] text-dim font-num mt-0.5 uppercase tracking-[0.08em]">
                    {r.hint}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-num text-[16px] font-semibold text-foreground leading-none">
                  {r.count.toLocaleString()}
                </div>
                <div className="text-[9.5px] text-dim uppercase tracking-[0.12em] font-num mt-1">
                  leads
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center flex-wrap gap-3 text-[11px] text-muted font-num">
              <span>
                <span className="text-dim">co · </span>
                <span className="text-ink2">
                  {r.stats.companies.toLocaleString()}
                </span>
              </span>
              <span>
                <span className="text-dim">sent · </span>
                <span className="text-ink2">{r.stats.sent.toLocaleString()}</span>
              </span>
              <span>
                <span className="text-dim">replies · </span>
                <span
                  className={
                    r.stats.replied > 0 ? "text-accent" : "text-ink2"
                  }
                >
                  {r.stats.replied.toLocaleString()}
                </span>
              </span>
              {r.stats.replyRate != null && (
                <span className="ml-auto">
                  <span className="text-dim">rate · </span>
                  <span
                    className={
                      r.stats.replyRate > 0.02 ? "text-accent" : "text-muted"
                    }
                  >
                    {(r.stats.replyRate * 100).toFixed(1)}%
                  </span>
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      <Link
        href={showAllHref as any}
        className="btn btn-sm btn-secondary"
        scroll={false}
      >
        {showAllLabel}
      </Link>
    </div>
  );
}
