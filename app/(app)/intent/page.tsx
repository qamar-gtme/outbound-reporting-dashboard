import { fetchTable } from "@/lib/supabase";
import { SectionHead, SubHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";

export const revalidate = 60;

export default async function IntentPage() {
  const signals = await fetchTable("intent_signals?order=category.asc,precision_score.desc");
  const byCat: Record<string, any[]> = {};
  signals.forEach((s: any) => (byCat[s.category] ||= []).push(s));

  const costClasses: Record<string, string> = {
    Free: "bg-accent/12 text-accent",
    Mid: "bg-warn/15 text-warn",
    Paid: "bg-danger/12 text-danger",
  };

  return (
    <div>
      <SectionHead
        eyebrow="Intent"
        title="Signals and triggers"
        description="GTM intent signal catalog. Precision scores how often a signal correlates with buying intent. Recall scores how often the signal is detectable."
        source="intent_signals"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat n={signals.length} label="Total signals" />
        <Stat n={Object.keys(byCat).length} label="Categories" />
        <Stat
          n={signals.filter((s: any) => s.cost_tier === "Free").length}
          label="Free sources"
        />
        <Stat
          n={signals.filter((s: any) => s.cost_tier === "Paid").length}
          label="Paid sources"
        />
        <Stat
          n={signals.filter((s: any) => (s.precision_score || 0) >= 9).length}
          label="Precision 9+"
        />
      </div>

      {Object.keys(byCat).length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No intent signals yet</div>
            <div className="empty-state-hint">
              Seed <code className="kbd">intent_signals</code> to populate this view.
            </div>
          </div>
        </div>
      )}

      {Object.entries(byCat).map(([cat, rows]) => (
        <section key={cat} className="mb-8">
          <SubHead title={cat} hint={`${rows.length} signals`} />
          <div className="card overflow-hidden">
            <table className="data">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Description</th>
                  <th>Source</th>
                  <th>Stage</th>
                  <th className="text-right">Precision</th>
                  <th className="text-right">Recall</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: any) => (
                  <tr key={s.id}>
                    <td className="font-medium text-ink">{s.signal_name}</td>
                    <td className="text-[12px] text-ink2 max-w-xs">
                      {s.description}
                    </td>
                    <td className="text-[11.5px] text-muted">{s.source}</td>
                    <td className="text-[11.5px] text-muted">
                      {s.buying_stage}
                    </td>
                    <td className="text-right font-num text-foreground font-semibold">
                      {s.precision_score ?? "·"}
                    </td>
                    <td className="text-right font-num text-muted">
                      {s.recall_score ?? "·"}
                    </td>
                    <td>
                      <span
                        className={`pill-cell ${costClasses[s.cost_tier] || "bg-surface2 text-muted"}`}
                      >
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
