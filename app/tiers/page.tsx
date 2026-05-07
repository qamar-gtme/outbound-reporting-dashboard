import { fetchTable } from "@/lib/supabase";

export const revalidate = 60;

export default async function TiersPage() {
  const tiers = await fetchTable("segmentation_tiers?order=tier.asc");
  const byTier: Record<string, any[]> = { "Tier 1": [], "Tier 2": [], "Tier 3": [] };
  tiers.forEach((t: any) => byTier[t.tier]?.push(t));
  const total = tiers.reduce((a: number, t: any) => a + (t.est_companies_us || 0), 0);

  const tierColor: any = { "Tier 1": "accent", "Tier 2": "warn", "Tier 3": "loss" };

  return (
    <div>
      <h1 className="font-display font-bold text-4xl mb-3">Segmentation Tiers</h1>
      <p className="text-ink2 max-w-3xl mb-6">
        {tiers.length} verticals tiered by competitive landscape + reasoning (NOT SDR perf data).
        5-factor scoring: competitor density · closed-won match · AI-CX fit · TAM size · industry growth.
        Total addressable: <span className="text-accent">~{total.toLocaleString()}</span> US cos.
      </p>

      {(["Tier 1", "Tier 2", "Tier 3"] as const).map((tn) => (
        <section key={tn} className="mb-8">
          <h2 className={`font-display font-bold text-2xl mb-2 text-${tierColor[tn]}`}>{tn}</h2>
          <p className="text-sm text-muted mb-3">{byTier[tn].length} verticals · ~{byTier[tn].reduce((a, t: any) => a + (t.est_companies_us || 0), 0).toLocaleString()} cos</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                {["Vertical", "Persona / Title", "Emp band", "Est cos", "Rationale"].map(h => (
                  <th key={h} className="text-left font-display font-bold text-[11px] uppercase tracking-wider text-ink2 bg-panel px-3 py-2 border-b border-border">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {byTier[tn].map((t: any, i: number) => (
                  <tr key={t.id} className={i % 2 ? "bg-panel2" : ""}>
                    <td className="px-3 py-2 border-b border-border"><b>{t.vertical}</b><div className="text-xs text-muted">{t.subindustry}</div></td>
                    <td className="px-3 py-2 border-b border-border">{t.persona}<div className="text-xs text-muted">{t.title}</div></td>
                    <td className="px-3 py-2 border-b border-border">{t.emp_band}</td>
                    <td className="px-3 py-2 border-b border-border font-mono">{(t.est_companies_us || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 border-b border-border text-xs text-muted max-w-md">{t.rationale}</td>
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
