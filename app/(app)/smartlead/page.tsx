import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";

type Campaign = {
  id: number;
  name: string;
  status: string;
  created_at: string | null;
  start_date: string | null;
  end_date: string | null;
  synced_at: string;
};

type MegaCovRow = {
  campaign_id: number;
  mega_slug: string;
  lead_count: number;
  sent_count: number;
  replied_count: number;
  reply_rate_pct: number | null;
};

type CampaignStats = {
  campaign_id: number;
  leads: number;
  sent_count: number;
  replied_count: number;
  reply_rate_pct: number | null;
};

const STATUS_ORDER = ["ACTIVE", "PAUSED", "DRAFTED", "COMPLETED", "ARCHIVED", "STOPPED"];

const statusPill: Record<string, string> = {
  ACTIVE: "bg-accent/12 text-accent",
  PAUSED: "bg-warn/15 text-warn",
  DRAFTED: "bg-surface2 text-muted",
  COMPLETED: "bg-info/15 text-info",
  ARCHIVED: "bg-surface2 text-dim",
  STOPPED: "bg-danger/12 text-danger",
};

const ALLOWED_FILTER = new Set(STATUS_ORDER);

// Cached: campaigns (for current filter) + all-campaign status counts + per-mega
// coverage. The args are statically-typed strings so Next can key the cache on
// them — different status filters get their own cache entries.
async function loadCampaignList(activeFilter: string | null) {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag("smartlead-campaigns", "smartlead-leads", "smartlead-coverage");

  const query = activeFilter
    ? `smartlead_campaigns?status=eq.${activeFilter}&order=created_at.desc.nullslast&limit=500`
    : "smartlead_campaigns?order=created_at.desc.nullslast&limit=500";

  const [campaigns, mega, stats, allMeta] = await Promise.all([
    fetchTable(query) as Promise<Campaign[]>,
    // Mega-only coverage view (~tens of rows), not the 20k-row matrix.
    fetchTable(
      "smartlead_mega_coverage?select=campaign_id,mega_slug,lead_count,sent_count,replied_count,reply_rate_pct&limit=2000",
    ) as Promise<MegaCovRow[]>,
    fetchTable("smartlead_campaign_stats?select=*&limit=500") as Promise<CampaignStats[]>,
    activeFilter
      ? (fetchTable(
          "smartlead_campaigns?select=status,synced_at&limit=2000",
        ) as Promise<Campaign[]>)
      : (Promise.resolve(null) as Promise<null>),
  ]);

  return { campaigns, mega, stats, allMeta };
}

export default async function SmartleadPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const rawStatus = (params.status ?? "").toUpperCase();
  const activeFilter = ALLOWED_FILTER.has(rawStatus) ? rawStatus : null;

  const { campaigns, mega, stats, allMeta } = await loadCampaignList(activeFilter);

  const statsByCampaign = new Map<number, CampaignStats>();
  for (const s of stats ?? []) statsByCampaign.set(s.campaign_id, s);

  // For status counts in the header we always want the full inventory.
  const all: Pick<Campaign, "status" | "synced_at">[] = (allMeta as any[]) ?? campaigns;

  const counts: Record<string, number> = {};
  for (const c of all) counts[c.status] = (counts[c.status] ?? 0) + 1;
  const total = all.length;

  const latestSync = all.reduce<string | null>((acc, c) => {
    if (!c.synced_at) return acc;
    if (!acc || c.synced_at > acc) return c.synced_at;
    return acc;
  }, null);

  // Index coverage by campaign (mega-level) for the inline expansion.
  const covByCampaign = new Map<number, MegaCovRow[]>();
  for (const r of mega ?? []) {
    if (!covByCampaign.has(r.campaign_id)) covByCampaign.set(r.campaign_id, []);
    covByCampaign.get(r.campaign_id)!.push(r);
  }

  return (
    <div>
      <SectionHead
        eyebrow="Smartlead"
        title="Campaigns"
        description="Every Smartlead campaign in the open.cx account, classified to the v3 taxonomy. Expand a row to see lead counts and reply rate by mega-industry."
        source="smartlead_campaigns"
        actions={
          <Link
            href="/smartlead/icp"
            className="btn btn-sm btn-secondary"
            aria-label="Open ICP and TAM coverage matrix"
          >
            ICP / TAM coverage →
          </Link>
        }
      />

      {/* Sticky filter bar */}
      <div className="sticky top-14 z-10 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-4 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <SearchStub />
          <span className="hidden md:block h-5 w-px bg-border mx-1" />
          <FilterChip
            label={`All · ${total.toLocaleString()}`}
            href="/smartlead"
            active={!activeFilter}
          />
          {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
            <FilterChip
              key={s}
              label={`${s} · ${counts[s].toLocaleString()}`}
              href={`/smartlead?status=${s}`}
              active={activeFilter === s}
              tone={s}
            />
          ))}
          <div className="ml-auto text-[11px] text-dim font-num hidden md:block">
            Last sync · {latestSync ? relativeTime(latestSync) : "never"}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden mb-3">
        {campaigns.length ? (
          <table className="data">
            <thead>
              <tr>
                <th aria-label="expand" className="w-6"></th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Start</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Reply rate</th>
                <th className="text-right">Campaign ID</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const rows = covByCampaign.get(c.id) ?? [];
                const s = statsByCampaign.get(c.id);
                const totalLeads = s?.leads ?? 0;
                const totalSent = s?.sent_count ?? 0;
                const totalReplied = s?.replied_count ?? 0;
                const replyRate =
                  totalSent > 0 ? totalReplied / totalSent : null;
                return (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    leadCount={totalLeads}
                    sentCount={totalSent}
                    repliedCount={totalReplied}
                    replyRate={replyRate}
                    coverage={rows}
                  />
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-title">
              {activeFilter
                ? `No campaigns with status ${activeFilter}`
                : "No campaigns synced yet"}
            </div>
            <div className="empty-state-hint">
              {activeFilter ? (
                <>Try a different filter or clear it.</>
              ) : (
                <>
                  Run <code className="kbd">npm run sync:smartlead</code> to
                  populate.
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-dim font-num">
        Last synced: {latestSync ? relativeTime(latestSync) : "never"}
        {latestSync && (
          <span className="text-dim/70"> · {fmtDateTime(latestSync)}</span>
        )}
      </div>
    </div>
  );
}

function SearchStub() {
  return (
    <label className="relative flex items-center min-w-[200px] sm:min-w-[260px]">
      <span className="absolute left-2.5 text-dim pointer-events-none">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        placeholder="Search campaigns…"
        disabled
        className="input pl-8 h-8 text-[12px] disabled:bg-surface2/60 disabled:cursor-not-allowed"
        aria-label="Search campaigns (coming soon)"
      />
    </label>
  );
}

function CampaignRow({
  campaign: c,
  leadCount,
  sentCount,
  repliedCount,
  replyRate,
  coverage,
}: {
  campaign: Campaign;
  leadCount: number;
  sentCount: number;
  repliedCount: number;
  replyRate: number | null;
  coverage: MegaCovRow[];
}) {
  const hasCoverage = leadCount > 0;
  return (
    <>
      <tr>
        <td className="w-6 text-dim">{hasCoverage ? "▾" : "·"}</td>
        <td className="font-medium text-ink">{c.name || "·"}</td>
        <td>
          <span
            className={`pill-cell ${statusPill[c.status] ?? "bg-surface2 text-muted"}`}
          >
            {c.status}
          </span>
        </td>
        <td className="font-num text-muted text-[12px]">
          {fmtDate(c.created_at)}
        </td>
        <td className="font-num text-muted text-[12px]">
          {fmtDate(c.start_date)}
        </td>
        <td className="text-right font-num text-ink2 text-[12px]">
          {leadCount ? leadCount.toLocaleString() : "—"}
        </td>
        <td className="text-right font-num text-ink2 text-[12px]">
          {fmtRate(replyRate)}
        </td>
        <td className="text-right font-num text-dim text-[11px]">{c.id}</td>
      </tr>
      {hasCoverage && (
        <tr>
          <td></td>
          <td colSpan={7} className="!pt-0 !pb-5">
            <CampaignIcpDetail
              coverage={coverage}
              totalLeads={leadCount}
              totalSent={sentCount}
              totalReplied={repliedCount}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function CampaignIcpDetail({
  coverage,
  totalLeads,
  totalSent,
  totalReplied,
}: {
  coverage: MegaCovRow[];
  totalLeads: number;
  totalSent: number;
  totalReplied: number;
}) {
  // The mega-coverage view returns one row per (campaign, mega). Top 5 by
  // lead count and top 3 by reply rate (with >10 sent) come from that.
  const topByCount = [...coverage]
    .sort((a, b) => b.lead_count - a.lead_count)
    .slice(0, 5);
  const topByReply = [...coverage]
    .filter((r) => (r.sent_count ?? 0) > 10)
    .sort((a, b) => {
      const ar = a.reply_rate_pct ?? 0;
      const br = b.reply_rate_pct ?? 0;
      return br - ar || b.replied_count - a.replied_count;
    })
    .slice(0, 3);

  const overall = totalSent > 0 ? totalReplied / totalSent : null;
  return (
    <div className="card-tight px-4 py-3">
      {/* Funnel chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <FunnelChip label="leads" value={totalLeads.toLocaleString()} />
        <FunnelChip label="sent" value={totalSent.toLocaleString()} tone="info" />
        <FunnelChip
          label="replied"
          value={totalReplied.toLocaleString()}
          tone="accent"
        />
        <FunnelChip
          label="reply rate"
          value={fmtRate(overall)}
          tone="accent"
          emphasize
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2 font-medium">
            Top 5 mega industries · by lead count
          </div>
          {topByCount.length ? (
            <ul className="space-y-1.5">
              {topByCount.map((r) => {
                const pct = totalLeads > 0 ? (r.lead_count / totalLeads) * 100 : 0;
                return (
                  <li
                    key={r.mega_slug}
                    className="text-[12px]"
                  >
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-ink2 truncate pr-3 capitalize">
                        {r.mega_slug.replace(/-/g, " ")}
                      </span>
                      <span className="font-num text-ink shrink-0">
                        {r.lead_count.toLocaleString()}
                        <span className="text-dim"> · </span>
                        <span className="text-muted">
                          {r.reply_rate_pct != null
                            ? `${Number(r.reply_rate_pct).toFixed(1)}%`
                            : "—"}
                        </span>
                      </span>
                    </div>
                    <div className="h-[2px] rounded-full bg-surface3 overflow-hidden">
                      <div
                        className="h-full bg-muted/50"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-dim text-[12px] italic">
              No classifications yet.
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2 font-medium">
            Top 3 mega industries · by reply rate (sent &gt; 10)
          </div>
          {topByReply.length ? (
            <ul className="space-y-1">
              {topByReply.map((r) => (
                <li
                  key={r.mega_slug + "rr"}
                  className="flex items-baseline justify-between text-[12px]"
                >
                  <span className="text-ink2 truncate pr-3 capitalize">
                    {r.mega_slug.replace(/-/g, " ")}
                  </span>
                  <span className="font-num text-ink shrink-0">
                    <span className="text-accent">
                      {r.reply_rate_pct != null
                        ? `${Number(r.reply_rate_pct).toFixed(1)}%`
                        : "—"}
                    </span>
                    <span className="text-dim"> · </span>
                    <span className="text-muted">
                      {r.replied_count}/{r.sent_count}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-dim text-[12px] italic">
              Not enough volume yet (need &gt;10 sent per mega).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelChip({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string;
  value: string;
  tone?: "accent" | "info";
  emphasize?: boolean;
}) {
  const toneCls = emphasize
    ? "bg-accent/12 text-accent"
    : tone === "accent"
      ? "text-accent"
      : tone === "info"
        ? "text-info"
        : "text-foreground";
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px]">
      <span className="text-dim uppercase tracking-[0.08em] text-[9.5px] font-num">
        {label}
      </span>
      <span className={`font-num font-medium ${toneCls}`}>{value}</span>
    </span>
  );
}

function FilterChip({
  label,
  href,
  active,
  tone,
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: string;
}) {
  const toneCls = tone ? statusPill[tone] ?? "" : "";
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-7 px-2.5 rounded-md border font-num text-[11px] uppercase tracking-[0.06em] transition-colors ${
        active
          ? toneCls
            ? `${toneCls} border-current/30`
            : "bg-foreground/10 text-foreground border-border-strong"
          : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
      }`}
    >
      {label}
    </Link>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRate(r: number | null): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
