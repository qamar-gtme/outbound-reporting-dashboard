import { fetchTable } from "@/lib/supabase";
import { SectionHead, SubHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";

export const revalidate = 60;

export default async function IntentPage() {
  const signals = await fetchTable("intent_signals?order=category.asc,precision_score.desc");
  const byCat: Record<string, any[]> = {};
  signals.forEach((s: any) => (byCat[s.category] ||= []).push(s));

  const costClasses: Record<string, string> = {
    Free: "bg-accent/15 text-accent border-accent/25",
    Mid: "bg-warn/15 text-warn border-warn/25",
    Paid: "bg-loss/15 text-loss border-loss/25",
  };

  return (
    <div>
      <SectionHead
        eyebrow="Intent"
        title="Signals &amp; triggers."
        description="GTM intent signal catalog. Precision scores how often a signal correlates with buying intent. Recall scores how often the signal is detectable."
        source="intent_signals"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        <Stat n={signals.length} label="total signals" />
        <Stat n={Object.keys(byCat).length} label="categories" />
        <Stat n={signals.filter((s: any) => s.cost_tier === "Free").length} label="free sources" />
        <Stat n={signals.filter((s: any) => s.cost_tier === "Paid").length} label="paid sources" tone="loss" />
        <Stat n={signals.filter((s: any) => (s.precision_score || 0) >= 9).length} label="precision 9+" tone="warn" />
      </div>

      {Object.entries(byCat).map(([cat, rows]) => (
        <section key={cat} className="mb-8">
          <SubHead title={cat} hint={`${rows.length} signals`} />
          <div className="card overflow-hidden">
            <table className="data">
              <thead><tr><th>Signal</th><th>Description</th><th>Source</th><th>Stage</th><th className="text-right">Precision</th><th className="text-right">Recall</th><th>Cost</th></tr></thead>
              <tbody>
                {rows.map((s: any) => (
                  <tr key={s.id}>
                    <td className="font-medium text-ink">{s.signal_name}</td>
                    <td className="text-[12px] text-ink2 max-w-xs">{s.description}</td>
                    <td className="text-[11.5px] text-muted">{s.source}</td>
                    <td className="text-[11.5px] text-muted">{s.buying_stage}</td>
                    <td className="text-right font-num text-accent font-semibold">{s.precision_score ?? "·"}</td>
                    <td className="text-right font-num text-muted">{s.recall_score ?? "·"}</td>
                    <td>
                      <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border ${costClasses[s.cost_tier] || ""}`}>
                        {s.cost_tier}
                      </span>
                    </td>
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
