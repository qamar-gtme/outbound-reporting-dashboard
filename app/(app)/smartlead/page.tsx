import Link from "next/link";
import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";

export const revalidate = 60;

type Campaign = {
  id: number;
  name: string;
  status: string;
  created_at: string | null;
  start_date: string | null;
  end_date: string | null;
  synced_at: string;
};

type CoverageRow = {
  campaign_id: number;
  mega_slug: string;
  sub_slug: string;
  vertical_slug: string;
  lead_count: number;
  sent_count: number;
  replied_count: number;
  reply_rate: number | null;
};

const STATUS_ORDER = ["ACTIVE", "PAUSED", "DRAFTED", "COMPLETED", "ARCHIVED", "STOPPED"];

const statusPill: Record<string, string> = {
  ACTIVE: "bg-accent/15 text-accent border-accent/30",
  PAUSED: "bg-warn/15 text-warn border-warn/30",
  DRAFTED: "bg-muted/20 text-muted border-muted/30",
  COMPLETED: "bg-info/15 text-info border-info/30",
  ARCHIVED: "bg-dim/20 text-dim border-dim/30",
  STOPPED: "bg-loss/15 text-loss border-loss/30",
};

const ALLOWED_FILTER = new Set(STATUS_ORDER);

export default async function SmartleadPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const rawStatus = (params.status ?? "").toUpperCase();
  const activeFilter = ALLOWED_FILTER.has(rawStatus) ? rawStatus : null;

  const query = activeFilter
    ? `smartlead_campaigns?status=eq.${activeFilter}&order=created_at.desc.nullslast`
    : "smartlead_campaigns?order=created_at.desc.nullslast";

  const [campaigns, coverage] = await Promise.all([
    fetchTable(query) as Promise<Campaign[]>,
    fetchTable("smartlead_campaign_icp_coverage?limit=20000") as Promise<CoverageRow[]>,
  ]);

  // For status counts in the header we always want the full inventory.
  const all = activeFilter
    ? ((await fetchTable("smartlead_campaigns?select=status,synced_at")) as Campaign[])
    : campaigns;

  const counts: Record<string, number> = {};
  for (const c of all) counts[c.status] = (counts[c.status] ?? 0) + 1;
  const total = all.length;

  const latestSync = all.reduce<string | null>((acc, c) => {
    if (!c.synced_at) return acc;
    if (!acc || c.synced_at > acc) return c.synced_at;
    return acc;
  }, null);

  // Index coverage by campaign for the inline expansion.
  const covByCampaign = new Map<number, CoverageRow[]>();
  for (const r of coverage ?? []) {
    if (!covByCampaign.has(r.campaign_id)) covByCampaign.set(r.campaign_id, []);
    covByCampaign.get(r.campaign_id)!.push(r);
  }

  return (
    <div>
      <SectionHead
        eyebrow="Section B · Smartlead"
        title="Campaign inventory."
        description="Every Smartlead campaign in the open.cx account — active, paused, drafted, completed, archived. Synced from server.smartlead.ai into Supabase and read live by the dashboard."
        source="smartlead_campaigns"
        accent="warn"
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 text-[12px]">
        <FilterChip label={`${total.toLocaleString()} total`} href="/smartlead" active={!activeFilter} />
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <FilterChip
            key={s}
            label={`${counts[s].toLocaleString()} ${s.toLowerCase()}`}
            href={`/smartlead?status=${s}`}
            active={activeFilter === s}
            tone={s}
          />
        ))}
        <Link
          href="/smartlead/icp"
          className="ml-auto px-3 py-1 rounded border border-accent/30 text-accent text-[11px] font-num uppercase tracking-[0.08em] hover:bg-accent/10 transition-colors"
        >
          ICP / TAM coverage →
        </Link>
      </div>

      <div className="card overflow-hidden mb-3">
        <table className="data">
          <thead>
            <tr>
              <th></th>
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
            {campaigns.length ? (
              campaigns.map((c) => {
                const rows = covByCampaign.get(c.id) ?? [];
                const megaRollup = rows.filter(
                  (r) => r.sub_slug === "" && r.vertical_slug === "",
                );
                const totalLeads = megaRollup.reduce((s, r) => s + (r.lead_count || 0), 0);
                const totalSent = megaRollup.reduce((s, r) => s + (r.sent_count || 0), 0);
                const totalReplied = megaRollup.reduce((s, r) => s + (r.replied_count || 0), 0);
                const replyRate = totalSent > 0 ? totalReplied / totalSent : null;
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
              })
            ) : (
              <tr>
                <td colSpan={8} className="text-dim italic text-center py-10">
                  {activeFilter
                    ? `No campaigns with status ${activeFilter}.`
                    : "No campaigns synced yet. Run `npm run sync:smartlead` to populate."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-dim font-num">
        Last synced: {latestSync ? relativeTime(latestSync) : "never"}
        {latestSync && <span className="text-dim/70"> · {fmtDateTime(latestSync)}</span>}
      </div>
    </div>
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
  coverage: CoverageRow[];
}) {
  const hasCoverage = leadCount > 0;
  // We render as <details>/<summary> with one row of <tr> per state.
  // Since <details> can't span <tr>s, we use a single <tr> with an interactive
  // button that anchor-links to a row below — or just render the expansion as
  // an additional <tr> always visible when there's coverage. Simpler: always
  // show expansion row when coverage exists.
  return (
    <>
      <tr>
        <td className="w-6 text-dim">{hasCoverage ? "▾" : "·"}</td>
        <td className="font-medium text-ink">{c.name || "·"}</td>
        <td>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded border text-[10.5px] uppercase tracking-[0.08em] font-medium font-num ${
              statusPill[c.status] ?? "bg-muted/15 text-muted border-muted/30"
            }`}
          >
            {c.status}
          </span>
        </td>
        <td className="font-num text-muted text-[12px]">{fmtDate(c.created_at)}</td>
        <td className="font-num text-muted text-[12px]">{fmtDate(c.start_date)}</td>
        <td className="text-right font-num text-ink2 text-[12px]">{leadCount ? leadCount.toLocaleString() : "—"}</td>
        <td className="text-right font-num text-ink2 text-[12px]">{fmtRate(replyRate)}</td>
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
  coverage: CoverageRow[];
  totalLeads: number;
  totalSent: number;
  totalReplied: number;
}) {
  // Use the vertical rows only for the per-vertical breakdown.
  const verticalRows = coverage.filter(
    (r) => r.vertical_slug !== "" && r.sub_slug !== "",
  );
  const topByCount = [...verticalRows]
    .sort((a, b) => b.lead_count - a.lead_count)
    .slice(0, 5);
  const topByReply = [...verticalRows]
    .filter((r) => (r.sent_count ?? 0) > 10)
    .sort(
      (a, b) =>
        (b.reply_rate ?? 0) - (a.reply_rate ?? 0) || b.replied_count - a.replied_count,
    )
    .slice(0, 3);

  const overall = totalSent > 0 ? totalReplied / totalSent : null;
  return (
    <div className="card-tight px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] font-num text-ink2 mb-3">
        <span>
          <span className="text-dim">leads</span> {totalLeads.toLocaleString()}
        </span>
        <span>
          <span className="text-dim">sent</span> {totalSent.toLocaleString()}
        </span>
        <span>
          <span className="text-dim">replied</span> {totalReplied.toLocaleString()}
        </span>
        <span>
          <span className="text-dim">reply rate</span>{" "}
          <span className="text-accent">{fmtRate(overall)}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
            Top 5 verticals · by lead count
          </div>
          {topByCount.length ? (
            <ul className="space-y-1">
              {topByCount.map((r) => (
                <li
                  key={r.mega_slug + r.sub_slug + r.vertical_slug}
                  className="flex items-baseline justify-between text-[12px]"
                >
                  <span className="text-ink2 truncate pr-3">
                    <span className="text-dim">{r.mega_slug}/</span>
                    {r.vertical_slug}
                  </span>
                  <span className="font-num text-ink shrink-0">
                    {r.lead_count.toLocaleString()}
                    <span className="text-dim"> · </span>
                    <span className="text-muted">{fmtRate(r.reply_rate)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-dim text-[12px] italic">No classifications yet.</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
            Top 3 verticals · by reply rate (sent &gt; 10)
          </div>
          {topByReply.length ? (
            <ul className="space-y-1">
              {topByReply.map((r) => (
                <li
                  key={r.mega_slug + r.sub_slug + r.vertical_slug + "rr"}
                  className="flex items-baseline justify-between text-[12px]"
                >
                  <span className="text-ink2 truncate pr-3">
                    <span className="text-dim">{r.mega_slug}/</span>
                    {r.vertical_slug}
                  </span>
                  <span className="font-num text-ink shrink-0">
                    <span className="text-accent">{fmtRate(r.reply_rate)}</span>
                    <span className="text-dim"> · </span>
                    <span className="text-muted">{r.replied_count}/{r.sent_count}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-dim text-[12px] italic">
              Not enough volume yet (need &gt;10 sent per vertical).
            </div>
          )}
        </div>
      </div>
    </div>
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
    <a
      href={href}
      className={`px-2.5 py-1 rounded border font-num text-[11px] uppercase tracking-[0.08em] transition-colors ${
        active
          ? toneCls || "bg-ink/10 text-ink border-ink/30"
          : "bg-transparent text-muted border-line hover:text-ink hover:border-ink/40"
      }`}
    >
      {label}
    </a>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
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
