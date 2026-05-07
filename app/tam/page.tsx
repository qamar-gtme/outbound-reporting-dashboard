import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";

export const revalidate = 60;

export default async function TAMPage() {
  const [inds, subs, verts, byInd] = await Promise.all([
    fetchTable("tam_industries?order=company_count_us.desc.nullslast"),
    fetchTable("tam_subindustries?order=company_count_us.desc.nullslast&limit=60"),
    fetchTable("tam_verticals?order=company_count_us.desc.nullslast&limit=60"),
    fetchTable("sdr_perf_by_industry?period_id=eq.1"),
  ]);

  const indDials: Record<string, any> = {};
  byInd.forEach((r: any) => (indDials[r.industry] = r));
  const totalCos = inds.reduce((a: number, t: any) => a + (t.company_count_us || 0), 0);

  return (
    <div>
      <SectionHead
        eyebrow="Section C"
        title="TAM Coverage"
        description="Hierarchical company count map across mega industries, sub industries, and verticals. Counts are mid range estimates from Census SUSB plus sector employment data."
        source="tam_*"
        accent="info"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        <Stat n={totalCos} label="addressable cos US" tone="info" />
        <Stat n={inds.length} label="L1 industries" tone="info" />
        <Stat n={subs.length} label="L2 sub industries" tone="info" />
        <Stat n={verts.length} label="L3 verticals" tone="info" />
      </div>

      <SubHead title="Level 1 industries" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead><tr><th>Industry</th><th className="text-right">Cos US</th><th className="text-right">Competitor density</th><th className="text-right">Dials</th><th className="text-right">Convos</th></tr></thead>
          <tbody>
            {inds.map((ti: any, i: number) => {
              const dialed = Object.values(indDials).filter((d: any) => (ti.name || "").toLowerCase().split(" ")[0] === (d.industry || "").toLowerCase().split(" ")[0]).reduce((a: number, d: any) => a + (d.dials || 0), 0);
              const convs = Object.values(indDials).filter((d: any) => (ti.name || "").toLowerCase().split(" ")[0] === (d.industry || "").toLowerCase().split(" ")[0]).reduce((a: number, d: any) => a + (d.conversations || 0), 0);
              return (
                <tr key={i}>
                  <td className="font-medium text-ink">{ti.name}</td>
                  <td className="text-right font-num">{num(ti.company_count_us)}</td>
                  <td className="text-right font-num text-muted">{num(ti.competitor_density)}</td>
                  <td className="text-right font-num">{num(dialed)}</td>
                  <td className="text-right font-num text-accent">{num(convs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SubHead title="Level 2 sub industries" hint="top 60 by company count" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead><tr><th>Sub industry</th><th>NAICS</th><th className="text-right">Cos US</th><th>AI fit</th><th className="text-right">Comp density</th></tr></thead>
          <tbody>
            {subs.map((s: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{s.name}</td>
                <td className="font-num text-muted">{s.naics || "·"}</td>
                <td className="text-right font-num">{num(s.company_count_us)}</td>
                <td>{aiFit(s.ai_cx_fit)}</td>
                <td className="text-right font-num text-muted">{num(s.competitor_density)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHead title="Level 3 verticals" hint="top 60 by company count" />
      <div className="card overflow-hidden">
        <table className="data">
          <thead><tr><th>Vertical</th><th className="text-right">Cos US</th><th>AI fit</th><th className="text-right">Comp density</th><th>Top players</th></tr></thead>
          <tbody>
            {verts.map((v: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">{v.name}</td>
                <td className="text-right font-num">{num(v.company_count_us)}</td>
                <td>{aiFit(v.ai_cx_fit)}</td>
                <td className="text-right font-num text-muted">{num(v.competitor_density)}</td>
                <td className="text-[12px] text-muted">{(v.top_players || []).slice(0, 4).join(", ") || "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function num(v: any) { return v != null ? Number(v).toLocaleString() : "·"; }
function aiFit(f: string | null) {
  const map: Record<string, string> = { HIGH: "text-accent", MED: "text-warn", LOW: "text-loss", SKIP: "text-dim" };
  if (!f) return <span className="text-dim">·</span>;
  return <span className={`text-[11px] font-medium ${map[f] || "text-muted"}`}>{f}</span>;
}
