import Link from "next/link";
import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";

export const revalidate = 60;

type Campaign = {
  id: number;
  name: string;
  status: string;
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

const DEPTHS = ["mega", "sub", "vertical"] as const;
type Depth = (typeof DEPTHS)[number];

const statusPill: Record<string, string> = {
  ACTIVE: "bg-accent/12 text-accent border-accent/30",
  PAUSED: "bg-warn/15 text-warn border-warn/30",
  DRAFTED: "bg-surface2 text-muted border-border",
  COMPLETED: "bg-info/15 text-info border-info/30",
};

export default async function SmartleadIcpPage({
  searchParams,
}: {
  searchParams?: Promise<{ depth?: string; campaign?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const depth: Depth = (DEPTHS as readonly string[]).includes(params.depth ?? "")
    ? (params.depth as Depth)
    : "mega";
  const campaignFilter = params.campaign ? Number(params.campaign) : null;

  const [campaigns, coverage] = await Promise.all([
    fetchTable("smartlead_campaigns?select=id,name,status&order=id.asc") as Promise<Campaign[]>,
    fetchTable("smartlead_campaign_icp_coverage?limit=20000") as Promise<CoverageRow[]>,
  ]);

  // Filter coverage by selected depth.
  const isDepthRow = (r: CoverageRow): boolean => {
    if (depth === "mega") return r.sub_slug === "" && r.vertical_slug === "";
    if (depth === "sub") return r.sub_slug !== "" && r.vertical_slug === "";
    return r.sub_slug !== "" && r.vertical_slug !== "";
  };
  const filtered = (coverage ?? []).filter(isDepthRow);

  // Aggregate header stats from mega-rollup rows (one per campaign per mega)
  // to avoid double-counting from vertical/sub rows.
  const megaRows = (coverage ?? []).filter(
    (r) => r.sub_slug === "" && r.vertical_slug === "",
  );
  const totalLeads = megaRows.reduce((s, r) => s + (r.lead_count || 0), 0);
  const totalSent = megaRows.reduce((s, r) => s + (r.sent_count || 0), 0);
  const totalReplied = megaRows.reduce((s, r) => s + (r.replied_count || 0), 0);
  const overallRate = totalSent > 0 ? totalReplied / totalSent : null;
  const totalCampaignsCovered = new Set(megaRows.map((r) => r.campaign_id)).size;

  // Build the matrix:
  //   rows  = distinct depth keys
  //   cols  = campaigns (optionally filtered)
  const cols = campaignFilter
    ? campaigns.filter((c) => c.id === campaignFilter)
    : campaigns;

  type Key = { mega: string; sub: string; vertical: string };
  const keyOf = (r: CoverageRow): string =>
    `${r.mega_slug}::${r.sub_slug}::${r.vertical_slug}`;
  const labelOf = (k: string): string => {
    const [mega, sub, vert] = k.split("::");
    if (depth === "mega") return mega;
    if (depth === "sub") return `${mega} / ${sub}`;
    return `${mega} / ${sub} / ${vert}`;
  };

  const rowTotals = new Map<string, { lead: number; sent: number; rep: number }>();
  for (const r of filtered) {
    const k = keyOf(r);
    if (campaignFilter && r.campaign_id !== campaignFilter) continue;
    const cur = rowTotals.get(k) ?? { lead: 0, sent: 0, rep: 0 };
    cur.lead += r.lead_count || 0;
    cur.sent += r.sent_count || 0;
    cur.rep += r.replied_count || 0;
    rowTotals.set(k, cur);
  }
  const sortedRowKeys = Array.from(rowTotals.entries())
    .sort((a, b) => b[1].lead - a[1].lead)
    .map(([k]) => k);

  // Look up cell.
  const cellByCampaignKey = new Map<string, CoverageRow>();
  for (const r of filtered) {
    cellByCampaignKey.set(`${r.campaign_id}::${keyOf(r)}`, r);
  }

  return (
    <div>
      <SectionHead
        eyebrow="Smartlead · ICP coverage"
        title="Coverage by campaign"
        description="Every lead classified to the v3 taxonomy (19 megas / 110 subs / 339 verticals), rolled up per campaign. Drill from mega → sub → vertical to see where outbound lands and where reply rate is strongest."
        source="smartlead_campaign_icp_coverage"
        accent="accent"
        actions={
          <Link
            href="/smartlead"
            className="btn btn-sm btn-ghost"
            aria-label="Back to campaign inventory"
          >
            ← Inventory
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat n={totalCampaignsCovered} label="Campaigns covered" />
        <Stat n={totalLeads} label="Total leads" />
        <Stat n={totalSent} label="Emails sent" />
        <Stat n={totalReplied} label="Replies" />
        <Stat
          n={overallRate != null ? `${(overallRate * 100).toFixed(2)}%` : "—"}
          label="Reply rate"
        />
      </div>

      <div className="card-tight px-3 py-2.5 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-muted uppercase tracking-[0.12em] font-num mr-1">
          Depth
        </span>
        {DEPTHS.map((d) => (
          <Link
            key={d}
            href={`/smartlead/icp?depth=${d}${campaignFilter ? `&campaign=${campaignFilter}` : ""}`}
            className={`inline-flex items-center h-7 px-2.5 rounded-md border font-num text-[11px] uppercase tracking-[0.06em] transition-colors ${
              depth === d
                ? "bg-accent/12 text-accent border-accent/40"
                : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
            }`}
          >
            {d}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        <span className="text-[10px] text-muted uppercase tracking-[0.12em] font-num mr-1">
          Campaign
        </span>
        <Link
          href={`/smartlead/icp?depth=${depth}`}
          className={`inline-flex items-center h-7 px-2.5 rounded-md border font-num text-[11px] uppercase tracking-[0.06em] transition-colors ${
            !campaignFilter
              ? "bg-foreground/10 text-foreground border-border-strong"
              : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
          }`}
        >
          all
        </Link>
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/smartlead/icp?depth=${depth}&campaign=${c.id}`}
            className={`inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] uppercase tracking-[0.06em] transition-colors max-w-[260px] truncate ${
              campaignFilter === c.id
                ? statusPill[c.status] ?? "bg-foreground/10 text-foreground border-border-strong"
                : "bg-transparent text-muted border-border hover:text-foreground hover:border-border-strong"
            }`}
            title={c.name}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {sortedRowKeys.length ? (
          <table className="data">
            <thead>
              <tr>
                <th
                  className="sticky left-0 bg-surface2 z-[2]"
                  style={{ minWidth: 320 }}
                >
                  {depth === "mega"
                    ? "Mega"
                    : depth === "sub"
                      ? "Mega / Sub"
                      : "Mega / Sub / Vertical"}
                </th>
                {cols.map((c) => (
                  <th
                    key={c.id}
                    className="text-right"
                    style={{ minWidth: 160 }}
                  >
                    <div
                      className="truncate max-w-[200px] inline-block align-middle"
                      title={c.name}
                    >
                      {c.name}
                    </div>
                  </th>
                ))}
                <th className="text-right" style={{ minWidth: 120 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRowKeys.map((k) => {
                const tot = rowTotals.get(k)!;
                const rate = tot.sent > 0 ? tot.rep / tot.sent : null;
                return (
                  <tr key={k}>
                    <td className="sticky left-0 bg-card text-ink2">
                      {labelOf(k)}
                    </td>
                    {cols.map((c) => {
                      const cell = cellByCampaignKey.get(`${c.id}::${k}`);
                      if (!cell) {
                        return (
                          <td
                            key={c.id}
                            className="text-right text-dim font-num text-[12px]"
                          >
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={c.id}
                          className="text-right font-num text-[12px]"
                        >
                          <span className="text-ink">
                            {cell.lead_count.toLocaleString()}
                          </span>
                          {cell.sent_count > 0 && (
                            <span className="text-dim">
                              {" · "}
                              <span
                                className={
                                  cell.reply_rate && cell.reply_rate > 0.02
                                    ? "text-accent"
                                    : "text-muted"
                                }
                              >
                                {fmtRate(cell.reply_rate)}
                              </span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right font-num text-[12px]">
                      <span className="text-ink font-medium">
                        {tot.lead.toLocaleString()}
                      </span>
                      {tot.sent > 0 && (
                        <span className="text-dim">
                          {" · "}
                          <span className="text-accent">{fmtRate(rate)}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-title">No ICP classifications yet</div>
            <div className="empty-state-hint">
              Run <code className="kbd">npm run sync:smartlead-icp</code> to
              populate. If the sync completed but the matrix is empty, check the
              OpenAI quota.
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] text-dim font-num">
        Depth <span className="text-ink2">{depth}</span> · rows{" "}
        <span className="text-ink2">{sortedRowKeys.length}</span> · cols{" "}
        <span className="text-ink2">{cols.length}</span> · cells with leads{" "}
        <span className="text-ink2">{cellByCampaignKey.size.toLocaleString()}</span>
      </div>
    </div>
  );
}

function fmtRate(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(1)}%`;
}
