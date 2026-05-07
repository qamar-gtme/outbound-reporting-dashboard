import { fetchTable } from "@/lib/supabase";

export const revalidate = 60;

const US_NAMES = ["Mahmoud", "Kaze", "Khaled", "Ghaith", "Waseem", "Ikremah"];

export default async function SDRPage() {
  const [period, allSdr, roster, owners, pool, periodStats, byInd, byPersona, recs] = await Promise.all([
    fetchTable("sdr_perf_period?id=eq.1"),
    fetchTable("sdr_perf_by_sdr?period_id=eq.1&order=total_dials.desc"),
    fetchTable("sdr_roster?status=eq.active&region=eq.US"),
    fetchTable("hs_meetings_by_owner?period_id=eq.1&order=meetings_count.desc"),
    fetchTable("hs_sdr_contact_pool?period_id=eq.1&order=contacts_owned.desc"),
    fetchTable("hs_period_stats?period_id=eq.1"),
    fetchTable("sdr_perf_by_industry?period_id=eq.1&order=conversations.desc.nullslast"),
    fetchTable("sdr_perf_by_persona?period_id=eq.1&order=conversations.desc.nullslast"),
    fetchTable("sdr_perf_recommendation?period_id=eq.1"),
  ]);

  const p: any = period[0] || {};
  const us = allSdr.filter(
    (r: any) => r.sdr_name !== "TEAM TOTAL" && US_NAMES.some((n) => (r.sdr_name || "").includes(n))
  );
  const usDials = us.reduce((a, r: any) => a + (r.total_dials || 0), 0);
  const usConn = us.reduce((a, r: any) => a + (r.connects_30s || 0), 0);
  const usConv = us.reduce((a, r: any) => a + (r.conversations_60s || 0), 0);
  const usStrong = us.reduce((a, r: any) => a + (r.strong_120s || 0), 0);
  const usSDRMtgs = owners.filter((m: any) => m.is_sdr && m.sdr_region === "US");
  const ps: any = periodStats[0] || {};

  return (
    <div>
      <SectionHeader title="Section A — US SDR Team" source="Salesfinity + HubSpot" color="accent" />
      <p className="text-ink2 max-w-3xl mb-6">
        US SDR roster: <span className="text-accent">{roster.length} active</span>.
        Period {p.period_start} → {p.period_end}.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        <Stat n={usDials} l="US dials" />
        <Stat n={usConn} l="connects 30s" />
        <Stat n={usConv} l="convos 60s" />
        <Stat n={usStrong} l="strong 120s" />
        <Stat n={ps.sdr_owned_meetings} l="SDR-owned mtgs" />
        <Stat n={ps.sdr_owned_deals} l="SDR-owned deals" />
        <Stat n={ps.total_meetings_booked_org} l="org meetings" />
        <Stat n={ps.closed_won_amount} l="org closed-won $" />
      </div>

      <H2>SDR scorecard (Salesfinity)</H2>
      <Table
        head={["SDR", "Dials", "Connects", "Connect %", "Convos", "Conv %", "Strong", "Strong rate"]}
        rows={[
          ...us.map((r: any) => [
            r.sdr_name,
            num(r.total_dials),
            num(r.connects_30s),
            pct(r.connect_rate),
            num(r.conversations_60s),
            pct(r.conv_rate),
            num(r.strong_120s),
            pct(r.conv_to_strong),
          ]),
          [
            <span key="t" className="font-bold">US TEAM TOTAL</span>,
            num(usDials),
            num(usConn),
            pct(usDials ? usConn / usDials : 0),
            num(usConv),
            pct(usDials ? usConv / usDials : 0),
            num(usStrong),
            pct(usConv ? usStrong / usConv : 0),
          ],
        ]}
      />

      <H2>HubSpot meeting ownership (US SDRs)</H2>
      <Table
        head={["SDR", "Region", "Meetings owned"]}
        rows={
          usSDRMtgs.length
            ? usSDRMtgs.map((m: any) => [m.owner_name, m.sdr_region, num(m.meetings_count)])
            : [["—", "—", "no US SDR-owned meetings in period"]]
        }
      />

      <H2>SDR contact pool (HubSpot)</H2>
      <Table
        head={["SDR", "Contacts owned"]}
        rows={pool.map((p: any) => [p.sdr_name, num(p.contacts_owned)])}
      />

      <H2>Conversation breakdown by industry</H2>
      <Note>Cross-team (US + UK SDRs combined). Use as directional, not absolute.</Note>
      <Table
        head={["Industry", "Dials", "Connects", "Convos", "Conv %", "Index", "Verdict"]}
        rows={byInd.map((r: any) => [
          r.industry,
          num(r.dials),
          num(r.connects),
          num(r.conversations),
          pct(r.conv_rate_pct),
          <span key="i" className="font-mono text-accent font-bold">{numF(r.index_conv_dial, 2)}</span>,
          verdict(r.status),
        ])}
      />

      <H2>By persona</H2>
      <Table
        head={["Persona", "Dials", "Connects", "Convos", "Conv %", "Index", "Verdict"]}
        rows={byPersona.map((r: any) => [
          r.persona,
          num(r.dials),
          num(r.connects),
          num(r.conversations),
          pct(r.conv_rate_pct),
          <span key="i" className="font-mono text-accent font-bold">{numF(r.index_conv_dial, 2)}</span>,
          verdict(r.status),
        ])}
      />

      <H2>Next-cycle recommendations</H2>
      <Table
        head={["Priority", "Segment", "Type", "Index", "Current %", "Action"]}
        rows={recs.map((r: any) => [r.priority, r.segment, r.segment_type, r.index_value, r.current_dial_share, r.recommendation])}
      />
    </div>
  );
}

function num(v: any) { return v != null ? Number(v).toLocaleString() : "—"; }
function numF(v: any, dp = 1) { return v != null ? Number(v).toFixed(dp) : "—"; }
function pct(v: any) { return v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—"; }
function verdict(s: string | null) {
  if (s === "overperformer") return <span className="text-accent">★ WIN</span>;
  if (s === "underperformer") return <span className="text-loss">✗ LOSS</span>;
  if (s === "total") return <span className="font-bold">TOTAL</span>;
  return "—";
}

function Stat({ n, l }: { n: any; l: string }) {
  return (
    <div className="bg-panel rounded-md px-4 py-3">
      <div className="font-mono font-bold text-2xl text-accent">{n != null ? Number(n).toLocaleString() : "—"}</div>
      <div className="text-xs text-dim uppercase tracking-wider mt-1">{l}</div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display font-bold text-xl mt-12 mb-3 pb-2 border-b border-border">{children}</h2>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="bg-panel border-l-2 border-accent px-4 py-3 rounded mb-4 text-sm text-muted">{children}</div>;
}

function SectionHeader({ title, source, color }: { title: string; source: string; color: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-2">
      <h1 className={`font-display font-bold text-3xl text-${color}`}>{title}</h1>
      <span className="font-mono text-[10px] uppercase tracking-wider text-dim bg-panel px-2 py-1 rounded">source: {source}</span>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-left font-display font-bold text-[11px] uppercase tracking-wider text-ink2 bg-panel px-3 py-2 border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-panel2" : ""}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 border-b border-border align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
