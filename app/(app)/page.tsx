import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";

const US_NAMES = ["Mahmoud", "Kaze", "Khaled", "Ghaith", "Waseem", "Ikremah"];

type Campaign = {
  id: number;
  name: string;
  status: string;
  created_at: string | null;
};

type MegaCovRow = {
  campaign_id: number;
  mega_slug: string;
  lead_count: number;
  sent_count: number;
  replied_count: number;
};

// All Supabase reads live inside this cached function so that the rendered
// home page comes out of the in-memory cache between syncs. The sync libs
// call `updateTag('smartlead-campaigns'|'smartlead-leads')` so a fresh sync
// invalidates this page on the next request.
async function loadHomeData() {
  "use cache";
  cacheLife({ revalidate: 600, expire: 3600 });
  cacheTag("home", "sdr", "smartlead-campaigns", "smartlead-leads", "smartlead-coverage");

  const [
    sdrAll,
    smartleadTotals,
    periodStats,
    owners,
    period,
    campaigns,
    mega,
  ] = await Promise.all([
    fetchTable("sdr_perf_by_sdr?period_id=eq.1&limit=200"),
    fetchTable("smartlead_account_totals?order=period_start.desc&limit=1"),
    fetchTable("hs_period_stats?period_id=eq.1&limit=1"),
    fetchTable("hs_meetings_by_owner?period_id=eq.1&limit=200"),
    fetchTable("sdr_perf_period?id=eq.1&limit=1"),
    fetchTable(
      "smartlead_campaigns?select=id,name,status,created_at&order=created_at.desc.nullslast&limit=200",
    ) as Promise<Campaign[]>,
    // Use the new pre-aggregated view instead of pulling the full 20k-row
    // coverage table.
    fetchTable(
      "smartlead_mega_coverage?select=campaign_id,mega_slug,lead_count,sent_count,replied_count&limit=2000",
    ) as Promise<MegaCovRow[]>,
  ]);

  return { sdrAll, smartleadTotals, periodStats, owners, period, campaigns, mega };
}

export default async function HomePage() {
  const {
    sdrAll,
    smartleadTotals,
    periodStats,
    owners,
    period,
    campaigns,
    mega,
  } = await loadHomeData();

  const ps: any = periodStats[0] || {};
  const sl: any = smartleadTotals[0] || {};
  const p: any = period[0] || {};

  const us = sdrAll.filter(
    (r: any) =>
      r.sdr_name !== "TEAM TOTAL" &&
      US_NAMES.some((n) => (r.sdr_name || "").includes(n)),
  );
  const usDials = us.reduce((a: number, r: any) => a + (r.total_dials || 0), 0);
  const usConv = us.reduce(
    (a: number, r: any) => a + (r.conversations_60s || 0),
    0,
  );
  const outboundMeetings = owners
    .filter((m: any) => m.is_sdr && m.sdr_region === "US")
    .reduce((a: number, m: any) => a + (m.meetings_count || 0), 0);

  // Reply rate
  const replyRate =
    sl.total_sent > 0
      ? ((sl.total_replies || 0) / sl.total_sent) * 100
      : null;

  // Campaign status breakdown
  const statusCounts: Record<string, number> = {};
  for (const c of campaigns) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  const activeCount = statusCounts["ACTIVE"] ?? 0;

  // Top mega industries by Smartlead lead volume — already aggregated by the
  // smartlead_mega_coverage view (one row per campaign × mega).
  const megaTotals = new Map<string, { lead: number; sent: number; rep: number }>();
  for (const r of mega) {
    const cur = megaTotals.get(r.mega_slug) ?? { lead: 0, sent: 0, rep: 0 };
    cur.lead += r.lead_count || 0;
    cur.sent += r.sent_count || 0;
    cur.rep += r.replied_count || 0;
    megaTotals.set(r.mega_slug, cur);
  }
  const topMegas = Array.from(megaTotals.entries())
    .sort((a, b) => b[1].lead - a[1].lead)
    .slice(0, 6);
  const totalLeads = Array.from(megaTotals.values()).reduce(
    (a, v) => a + v.lead,
    0,
  );

  // Top SDRs by dials
  const topSdrs = [...us]
    .sort((a: any, b: any) => (b.total_dials || 0) - (a.total_dials || 0))
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <SectionHead
        eyebrow="Overview"
        title="Outbound at a glance."
        description={
          p.period_start
            ? `Activity from ${fmtDate(p.period_start)} to ${fmtDate(p.period_end)}.`
            : "Activity for the current reporting period."
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat n={usDials} label="Dials" />
        <Stat n={usConv} label="Conversations" hint="60s+" />
        <Stat n={outboundMeetings} label="Meetings" hint="US SDR booked" />
        <Stat n={ps.sdr_owned_deals} label="Sourced deals" />
        <Stat n={sl.total_sent} label="Emails sent" />
        <Stat
          n={replyRate != null ? `${replyRate.toFixed(2)}%` : "—"}
          label="Reply rate"
          hint={sl.total_replies ? `${sl.total_replies.toLocaleString()} replies` : undefined}
        />
      </div>

      {/* Focal sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* SDR leaderboard */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">
                SDR leaderboard
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                US team · dials, conversations, conv rate
              </p>
            </div>
            <Link
              href="/sdr"
              className="text-[11px] font-num uppercase tracking-[0.08em] text-muted hover:text-accent transition-colors"
            >
              Open →
            </Link>
          </div>
          {topSdrs.length ? (
            <table className="data">
              <thead>
                <tr>
                  <th>SDR</th>
                  <th className="text-right">Dials</th>
                  <th className="text-right">Convos</th>
                  <th className="text-right">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {topSdrs.map((r: any) => (
                  <tr key={r.sdr_name}>
                    <td className="font-medium text-ink">{r.sdr_name}</td>
                    <td className="text-right font-num">
                      {(r.total_dials || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-num">
                      {(r.conversations_60s || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-num text-muted">
                      {r.conv_rate != null
                        ? `${(r.conv_rate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No SDR activity yet</div>
              <div className="empty-state-hint">
                Sync Salesfinity to populate the leaderboard.
              </div>
            </div>
          )}
        </div>

        {/* Smartlead snapshot */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">
                Smartlead
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                {activeCount} active · {campaigns.length} total campaigns
              </p>
            </div>
            <Link
              href="/smartlead"
              className="text-[11px] font-num uppercase tracking-[0.08em] text-muted hover:text-accent transition-colors"
            >
              Open →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Leads"
                value={totalLeads ? totalLeads.toLocaleString() : "—"}
              />
              <MiniStat
                label="Replies"
                value={
                  sl.total_replies
                    ? sl.total_replies.toLocaleString()
                    : "—"
                }
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-2 font-medium">
                Top mega industries · by lead count
              </div>
              {topMegas.length ? (
                <ul className="space-y-1.5">
                  {topMegas.map(([slug, v]) => {
                    const pct = totalLeads > 0 ? (v.lead / totalLeads) * 100 : 0;
                    const rr = v.sent > 0 ? (v.rep / v.sent) * 100 : null;
                    return (
                      <li key={slug} className="text-[12px]">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className="text-ink2 truncate pr-2 capitalize">
                            {slug.replace(/-/g, " ")}
                          </span>
                          <span className="font-num text-foreground shrink-0">
                            {v.lead.toLocaleString()}
                            <span className="text-dim"> · </span>
                            <span className="text-muted">
                              {rr != null ? `${rr.toFixed(1)}%` : "—"}
                            </span>
                          </span>
                        </div>
                        <div className="h-[3px] rounded-full bg-surface2 overflow-hidden">
                          <div
                            className="h-full bg-accent/60"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">No ICP coverage yet</div>
                  <div className="empty-state-hint">
                    Run <code className="kbd">npm run sync:smartlead-icp</code>.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <SubHead title="Workspace" hint="jump to a section" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <QuickLink href="/sdr" label="SDR" hint="Dials, meetings" />
        <QuickLink href="/smartlead" label="Smartlead" hint="Campaigns" />
        <QuickLink href="/smartlead/icp" label="ICP coverage" hint="Matrix" />
        <QuickLink href="/tam" label="TAM" hint="Company counts" />
        <QuickLink href="/tiers" label="Tiers" hint="Verticals" />
        <QuickLink href="/intent" label="Intent" hint="Signals" />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted font-medium mb-1">
        {label}
      </div>
      <div className="font-num text-[15px] font-semibold text-foreground leading-none">
        {value}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="card px-3.5 py-3 group hover:border-border-strong transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        <span className="text-[11px] text-dim group-hover:text-accent transition-colors">
          →
        </span>
      </div>
      <div className="text-[11px] text-muted">{hint}</div>
    </Link>
  );
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
