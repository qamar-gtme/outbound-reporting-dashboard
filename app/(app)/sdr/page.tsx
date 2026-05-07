import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";

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
  const ps: any = periodStats[0] || {};
  const us = allSdr.filter((r: any) => r.sdr_name !== "TEAM TOTAL" && US_NAMES.some((n) => (r.sdr_name || "").includes(n)));

  const usDials = us.reduce((a, r: any) => a + (r.total_dials || 0), 0);
  const usConn = us.reduce((a, r: any) => a + (r.connects_30s || 0), 0);
  const usConv = us.reduce((a, r: any) => a + (r.conversations_60s || 0), 0);
  const usStrong = us.reduce((a, r: any) => a + (r.strong_120s || 0), 0);
  const usSDRMtgs = owners.filter((m: any) => m.is_sdr && m.sdr_region === "US");
  const outboundMeetings = usSDRMtgs.reduce((a, m: any) => a + (m.meetings_count || 0), 0);

  return (
    <div>
      <SectionHead
        eyebrow="Section A"
        title="US SDR Team"
        description="Salesfinity dialing activity plus HubSpot meetings booked from outbound. Numbers reflect outbound attribution only, not org-wide meeting noise."
        source="Salesfinity + HubSpot"
        accent="accent"
      />

      <SubHead title="Activity headline" hint={`${p.period_start ?? ""} to ${p.period_end ?? ""}`} />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Stat n={us.length} label="active US SDRs" />
        <Stat n={usDials} label="dials" />
        <Stat n={usConn} label="connects 30s+" />
        <Stat n={usConv} label="conversations 60s+" />
        <Stat n={usStrong} label="strong 120s+" />
        <Stat n={outboundMeetings} label="outbound meetings" hint="US SDR booked" />
        <Stat n={ps.sdr_owned_deals} label="SDR-sourced deals" />
        <Stat n={pct(usConv, usDials)} label="conv rate" suffix="%" />
      </div>

      <SubHead title="Per SDR scorecard" hint="Salesfinity, year to date" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr>
              <th>SDR</th>
              <th className="text-right">Dials</th>
              <th className="text-right">Connects</th>
              <th className="text-right">Connect %</th>
              <th className="text-right">Conv 60s</th>
              <th className="text-right">Conv %</th>
              <th className="text-right">Strong 120s</th>
              <th className="text-right">Strong rate</th>
            </tr>
          </thead>
          <tbody>
            {us.map((r: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{r.sdr_name}</td>
                <td className="text-right font-num">{num(r.total_dials)}</td>
                <td className="text-right font-num">{num(r.connects_30s)}</td>
                <td className="text-right font-num text-muted">{pctStr(r.connect_rate)}</td>
                <td className="text-right font-num">{num(r.conversations_60s)}</td>
                <td className="text-right font-num text-muted">{pctStr(r.conv_rate)}</td>
                <td className="text-right font-num">{num(r.strong_120s)}</td>
                <td className="text-right font-num text-muted">{pctStr(r.conv_to_strong)}</td>
              </tr>
            ))}
            <tr className="row-emphasis">
              <td>US team total</td>
              <td className="text-right font-num">{num(usDials)}</td>
              <td className="text-right font-num">{num(usConn)}</td>
              <td className="text-right font-num">{pct(usConn, usDials)}%</td>
              <td className="text-right font-num">{num(usConv)}</td>
              <td className="text-right font-num">{pct(usConv, usDials)}%</td>
              <td className="text-right font-num">{num(usStrong)}</td>
              <td className="text-right font-num">{pct(usStrong, usConv)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHead title="Outbound meetings booked" hint="US SDRs only" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr>
              <th>SDR</th>
              <th>Region</th>
              <th className="text-right">Meetings booked</th>
            </tr>
          </thead>
          <tbody>
            {usSDRMtgs.length ? usSDRMtgs.map((m: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{m.owner_name}</td>
                <td className="text-muted">{m.sdr_region}</td>
                <td className="text-right font-num text-accent font-semibold">{num(m.meetings_count)}</td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="text-dim italic text-center py-6">No outbound meetings yet.</td></tr>
            )}
            <tr className="row-emphasis">
              <td>Total outbound</td>
              <td></td>
              <td className="text-right font-num">{num(outboundMeetings)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHead title="Contact pool" hint="HubSpot, contacts owned per SDR" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead><tr><th>SDR</th><th className="text-right">Contacts owned</th></tr></thead>
          <tbody>
            {pool.map((p: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{p.sdr_name}</td>
                <td className="text-right font-num">{num(p.contacts_owned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHead title="Conversations by industry" hint="Cross team. Use as directional only." />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead><tr><th>Industry</th><th className="text-right">Dials</th><th className="text-right">Connects</th><th className="text-right">Convos</th><th className="text-right">Conv %</th><th className="text-right">Index</th><th>Verdict</th></tr></thead>
          <tbody>
            {byInd.map((r: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{r.industry}</td>
                <td className="text-right font-num">{num(r.dials)}</td>
                <td className="text-right font-num">{num(r.connects)}</td>
                <td className="text-right font-num">{num(r.conversations)}</td>
                <td className="text-right font-num text-muted">{pctStr(r.conv_rate_pct)}</td>
                <td className="text-right font-num text-accent font-semibold">{numF(r.index_conv_dial, 2)}</td>
                <td>{verdict(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHead title="Conversations by persona" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead><tr><th>Persona</th><th className="text-right">Dials</th><th className="text-right">Connects</th><th className="text-right">Convos</th><th className="text-right">Conv %</th><th className="text-right">Index</th><th>Verdict</th></tr></thead>
          <tbody>
            {byPersona.map((r: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{r.persona}</td>
                <td className="text-right font-num">{num(r.dials)}</td>
                <td className="text-right font-num">{num(r.connects)}</td>
                <td className="text-right font-num">{num(r.conversations)}</td>
                <td className="text-right font-num text-muted">{pctStr(r.conv_rate_pct)}</td>
                <td className="text-right font-num text-accent font-semibold">{numF(r.index_conv_dial, 2)}</td>
                <td>{verdict(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHead title="Next cycle recommendations" />
      <div className="card overflow-hidden">
        <table className="data">
          <thead><tr><th>Priority</th><th>Segment</th><th>Type</th><th>Index</th><th>Current %</th><th>Action</th></tr></thead>
          <tbody>
            {recs.map((r: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{r.priority}</td>
                <td>{r.segment}</td>
                <td className="text-muted">{r.segment_type}</td>
                <td className="font-num text-accent">{r.index_value}</td>
                <td className="font-num text-muted">{r.current_dial_share}</td>
                <td className="text-ink2 text-[12.5px]">{r.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function num(v: any) { return v != null ? Number(v).toLocaleString() : "0"; }
function numF(v: any, dp = 1) { return v != null ? Number(v).toFixed(dp) : "0.00"; }
function pct(num: number, den: number) { return den ? ((num / den) * 100).toFixed(1) : "0.0"; }
function pctStr(v: any) { return v != null ? `${(Number(v) * 100).toFixed(1)}%` : "0.0%"; }
function verdict(s: string | null) {
  if (s === "overperformer") return <span className="text-accent text-[11px] font-medium">★ WIN</span>;
  if (s === "underperformer") return <span className="text-loss text-[11px] font-medium">✗ LOSS</span>;
  if (s === "total") return <span className="text-muted text-[11px] font-medium">TOTAL</span>;
  return <span className="text-dim text-[11px]">·</span>;
}
