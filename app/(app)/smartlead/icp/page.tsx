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
  ACTIVE: "bg-accent/15 text-accent border-accent/30",
  PAUSED: "bg-warn/15 text-warn border-warn/30",
  DRAFTED: "bg-muted/20 text-muted border-muted/30",
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
        eyebrow="Section B · Smartlead · ICP coverage"
        title="ICP / TAM coverage by campaign."
        description="Every lead in the open.cx Smartlead account is classified to the v3 taxonomy (19 megas / 110 subs / 339 verticals) and rolled up per campaign. Drill from mega → sub → vertical to see where outbound lands and where reply rate is strongest."
        source="smartlead_campaign_icp_coverage"
        accent="accent"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Stat n={totalCampaignsCovered} label="Campaigns covered" />
        <Stat n={totalLeads} label="Total leads" />
        <Stat n={totalSent} label="Emails sent" tone="info" />
        <Stat n={totalReplied} label="Replies" tone="warn" />
        <Stat
          n={overallRate != null ? `${(overallRate * 100).toFixed(2)}%` : "—"}
          label="Reply rate"
          tone="info"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[11px] text-muted uppercase tracking-[0.12em] mr-2">Depth:</span>
        {DEPTHS.map((d) => (
          <Link
            key={d}
            href={`/smartlead/icp?depth=${d}${campaignFilter ? `&campaign=${campaignFilter}` : ""}`}
            className={`px-2.5 py-1 rounded border font-num text-[11px] uppercase tracking-[0.08em] transition-colors ${
              depth === d
                ? "bg-accent/15 text-accent border-accent/40"
                : "bg-transparent text-muted border-line hover:text-ink hover:border-ink/40"
            }`}
          >
            {d}
          </Link>
        ))}
        <span className="mx-3 text-dim">·</span>
        <span className="text-[11px] text-muted uppercase tracking-[0.12em] mr-1">Campaign:</span>
        <Link
          href={`/smartlead/icp?depth=${depth}`}
          className={`px-2.5 py-1 rounded border font-num text-[11px] uppercase tracking-[0.08em] transition-colors ${
            !campaignFilter
              ? "bg-ink/10 text-ink border-ink/30"
              : "bg-transparent text-muted border-line hover:text-ink hover:border-ink/40"
          }`}
        >
          all
        </Link>
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/smartlead/icp?depth=${depth}&campaign=${c.id}`}
            className={`px-2.5 py-1 rounded border text-[11px] uppercase tracking-[0.08em] transition-colors max-w-[260px] truncate ${
              campaignFilter === c.id
                ? statusPill[c.status] ?? "bg-ink/10 text-ink border-ink/30"
                : "bg-transparent text-muted border-line hover:text-ink hover:border-ink/40"
            }`}
            title={c.name}
          >
            {c.name}
          </Link>
        ))}
        <Link
          href="/smartlead"
          className="ml-auto text-[11px] font-num text-dim hover:text-accent uppercase tracking-[0.08em]"
        >
          ← back to inventory
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface2/80 backdrop-blur" style={{ minWidth: 320 }}>
                {depth === "mega" ? "Mega" : depth === "sub" ? "Mega / Sub" : "Mega / Sub / Vertical"}
              </th>
              {cols.map((c) => (
                <th key={c.id} className="text-right" style={{ minWidth: 160 }}>
                  <div className="truncate max-w-[200px] inline-block align-middle" title={c.name}>
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
            {sortedRowKeys.length ? (
              sortedRowKeys.map((k) => {
                const tot = rowTotals.get(k)!;
                const rate = tot.sent > 0 ? tot.rep / tot.sent : null;
                return (
                  <tr key={k}>
                    <td className="sticky left-0 bg-bg/80 backdrop-blur text-ink2">
                      {labelOf(k)}
                    </td>
                    {cols.map((c) => {
                      const cell = cellByCampaignKey.get(`${c.id}::${k}`);
                      if (!cell) {
                        return (
                          <td key={c.id} className="text-right text-dim font-num text-[12px]">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={c.id} className="text-right font-num text-[12px]">
                          <span className="text-ink">{cell.lead_count.toLocaleString()}</span>
                          {cell.sent_count > 0 && (
                            <span className="text-dim">
                              {" · "}
                              <span className={cell.reply_rate && cell.reply_rate > 0.02 ? "text-accent" : "text-muted"}>
                                {fmtRate(cell.reply_rate)}
                              </span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right font-num text-[12px] row-emphasis-cell">
                      <span className="text-ink font-medium">{tot.lead.toLocaleString()}</span>
                      {tot.sent > 0 && (
                        <span className="text-dim">
                          {" · "}
                          <span className="text-accent">{fmtRate(rate)}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={cols.length + 2} className="text-dim italic text-center py-10">
                  No coverage yet. Run <code className="kbd">npm run sync:smartlead-icp</code> to populate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
