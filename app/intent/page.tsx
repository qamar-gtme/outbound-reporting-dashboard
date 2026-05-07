import { fetchTable } from "@/lib/supabase";

export const revalidate = 60;

export default async function IntentPage() {
  const signals = await fetchTable("intent_signals?order=category.asc,precision_score.desc");
  const byCat: Record<string, any[]> = {};
  signals.forEach((s: any) => (byCat[s.category] ||= []).push(s));

  const costColor = (c: string) => ({ Free: "text-accent bg-accent/20", Mid: "text-warn bg-warn/20", Paid: "text-loss bg-loss/20" } as any)[c] || "";

  return (
    <div>
      <h1 className="font-display font-bold text-4xl mb-3">GTM Intent Signals &amp; Triggers</h1>
      <p className="text-ink2 max-w-3xl mb-6">
        {signals.length} signals across {Object.keys(byCat).length} categories.
        Precision = signal correlates w/ buying intent. Recall = how often detectable. Cost = source data tier.
      </p>

      {Object.entries(byCat).map(([cat, rows]) => (
        <section key={cat} className="mb-8">
          <h2 className="font-display font-bold text-xl mb-2">
            {cat} <span className="text-muted text-sm font-mono">{rows.length} signals</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                {["Signal", "Description", "Source", "Stage", "Precision", "Recall", "Cost"].map(h => (
                  <th key={h} className="text-left font-display font-bold text-[11px] uppercase tracking-wider text-ink2 bg-panel px-3 py-2 border-b border-border">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((s: any, i: number) => (
                  <tr key={s.id} className={i % 2 ? "bg-panel2" : ""}>
                    <td className="px-3 py-2 border-b border-border"><b>{s.signal_name}</b></td>
                    <td className="px-3 py-2 border-b border-border text-xs text-muted max-w-xs">{s.description}</td>
                    <td className="px-3 py-2 border-b border-border text-xs">{s.source}</td>
                    <td className="px-3 py-2 border-b border-border text-xs">{s.buying_stage}</td>
                    <td className="px-3 py-2 border-b border-border font-mono text-accent font-bold">{s.precision_score ?? "—"}</td>
                    <td className="px-3 py-2 border-b border-border font-mono text-accent font-bold">{s.recall_score ?? "—"}</td>
                    <td className="px-3 py-2 border-b border-border"><span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${costColor(s.cost_tier)}`}>{s.cost_tier}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
