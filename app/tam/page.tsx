import { fetchTable } from "@/lib/supabase";

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
      <div className="flex items-baseline gap-3 mb-2">
        <h1 className="font-display font-bold text-3xl text-info">Section C — TAM Coverage</h1>
        <span className="font-mono text-[10px] uppercase tracking-wider text-dim bg-panel px-2 py-1 rounded">source: tam_*</span>
      </div>
      <p className="text-ink2 max-w-3xl mb-6">
        Hierarchical company-count map: {inds.length} industries → {subs.length} sub-industries → {verts.length} verticals.
        Total US firms 50+ emp (CX-sellable): <span className="text-info">{totalCos.toLocaleString()}</span>.
      </p>

      <h2 className="font-display font-bold text-xl mt-8 mb-3 pb-2 border-b border-border">Level 1 — Industries</h2>
      <Tbl head={["Industry", "Cos US", "Competitor density", "Dials", "Convos"]}
        rows={inds.map((ti: any) => {
          const dialed = Object.values(indDials).filter((d: any) => (ti.name || "").toLowerCase().split(" ")[0] === (d.industry || "").toLowerCase().split(" ")[0]).reduce((a: number, d: any) => a + (d.dials || 0), 0);
          const convs = Object.values(indDials).filter((d: any) => (ti.name || "").toLowerCase().split(" ")[0] === (d.industry || "").toLowerCase().split(" ")[0]).reduce((a: number, d: any) => a + (d.conversations || 0), 0);
          return [<b key="n">{ti.name}</b>, num(ti.company_count_us), num(ti.competitor_density), num(dialed), num(convs)];
        })}
      />

      <h2 className="font-display font-bold text-xl mt-10 mb-3 pb-2 border-b border-border">Level 2 — Sub-industries (top 60)</h2>
      <Tbl head={["Sub-industry", "NAICS", "Cos US", "AI fit", "Competitor density"]}
        rows={subs.map((s: any) => [<b key="n">{s.name}</b>, s.naics, num(s.company_count_us), s.ai_cx_fit, num(s.competitor_density)])}
      />

      <h2 className="font-display font-bold text-xl mt-10 mb-3 pb-2 border-b border-border">Level 3 — Verticals (top 60)</h2>
      <Tbl head={["Vertical", "Cos US", "AI fit", "Competitor density", "Top players"]}
        rows={verts.map((v: any) => [<b key="n">{v.name}</b>, num(v.company_count_us), v.ai_cx_fit, num(v.competitor_density), <span key="t" className="text-xs text-muted">{(v.top_players || []).slice(0, 4).join(", ")}</span>])}
      />
    </div>
  );
}

function num(v: any) { return v != null ? Number(v).toLocaleString() : "—"; }

function Tbl({ head, rows }: { head: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead><tr>{head.map((h) => <th key={h} className="text-left font-display font-bold text-[11px] uppercase tracking-wider text-ink2 bg-panel px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className={i % 2 ? "bg-panel2" : ""}>{r.map((c, j) => <td key={j} className="px-3 py-2 border-b border-border align-top">{c == null || c === "" ? "—" : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
