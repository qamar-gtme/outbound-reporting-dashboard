import { fetchTable } from "@/lib/supabase";
import { SectionHead } from "@/components/SectionHead";
import { Stat } from "@/components/Stat";

export const revalidate = 60;

type Persona = { title: string; seniority?: string; fit?: string; why?: string };

const fitClasses: Record<string, string> = {
  primary: "bg-accent/12 text-accent border-accent/20",
  strong: "bg-warn/12 text-warn border-warn/20",
  adj: "bg-info/12 text-info border-info/20",
  signal: "bg-loss/12 text-loss border-loss/20",
};

export default async function TiersPage() {
  const tiers = await fetchTable("segmentation_tiers?order=tier.asc");
  const byTier: Record<string, any[]> = { "Tier 1": [], "Tier 2": [], "Tier 3": [] };
  tiers.forEach((t: any) => byTier[t.tier]?.push(t));
  const total = tiers.reduce((a: number, t: any) => a + (t.est_companies_us || 0), 0);
  const totalPersonas = tiers.reduce((a: number, t: any) => a + (Array.isArray(t.personas) ? t.personas.length : 0), 0);

  const tierColor: Record<string, { text: string; bar: string }> = {
    "Tier 1": { text: "text-accent", bar: "bg-accent" },
    "Tier 2": { text: "text-warn", bar: "bg-warn" },
    "Tier 3": { text: "text-loss", bar: "bg-loss" },
  };

  return (
    <div>
      <SectionHead
        eyebrow="Segmentation"
        title="Priority tiers."
        description="27 verticals tiered by competitive landscape and reasoning, not SDR perf data. Each vertical lists the full buyer persona stack with fit class and rationale."
        source="segmentation_tiers"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        <Stat n={tiers.length} label="verticals" />
        <Stat n={byTier["Tier 1"].length} label="Tier 1" />
        <Stat n={byTier["Tier 2"].length} label="Tier 2" tone="warn" />
        <Stat n={totalPersonas} label="buyer personas mapped" />
        <Stat n={total} label="addressable cos" tone="info" />
      </div>

      {(["Tier 1", "Tier 2", "Tier 3"] as const).map((tn) => {
        const c = tierColor[tn];
        const cnt = byTier[tn].reduce((a, t: any) => a + (t.est_companies_us || 0), 0);
        return (
          <section key={tn} className="mb-12">
            <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-line">
              <div className="flex items-baseline gap-3">
                <span className={`block w-2.5 h-2.5 rounded-full ${c.bar}`} />
                <h2 className={`font-display text-[26px] tracking-tight font-medium ${c.text}`}>{tn}</h2>
                <span className="text-[12px] text-dim font-num">
                  {byTier[tn].length} verticals · ~{cnt.toLocaleString()} cos
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {byTier[tn].map((t: any) => {
                const personas: Persona[] = Array.isArray(t.personas) ? t.personas : [];
                return (
                  <div key={t.id} className="card p-6">
                    <div className="flex items-start justify-between gap-6 mb-4">
                      <div className="flex-1">
                        <div className="font-display text-[20px] tracking-tight text-ink mb-1">{t.vertical}</div>
                        <div className="text-[12px] text-muted">{t.subindustry}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-num text-[22px] text-accent font-semibold leading-none">
                          {(t.est_companies_us || 0).toLocaleString()}
                        </div>
                        <div className="text-[10.5px] uppercase tracking-[0.12em] text-dim mt-1">cos US</div>
                      </div>
                    </div>

                    <div className="text-[12.5px] text-ink2 leading-relaxed mb-5 max-w-2xl">{t.rationale}</div>

                    <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted mb-3 font-medium">
                      Buyer personas <span className="text-dim font-num normal-case tracking-normal">({personas.length})</span>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {personas.map((p, i) => (
                        <div key={i} className="card-tight p-3">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-medium text-[13px] text-ink leading-tight">{p.title}</div>
                            {p.fit && (
                              <span
                                className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${fitClasses[p.fit] || "bg-surface3 text-muted border-line"}`}
                              >
                                {p.fit}
                              </span>
                            )}
                          </div>
                          {p.seniority && (
                            <div className="text-[10px] text-dim font-num uppercase tracking-wider mb-1.5">
                              {p.seniority}
                            </div>
                          )}
                          {p.why && <div className="text-[11.5px] text-muted leading-snug">{p.why}</div>}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-line flex items-center gap-4 text-[11px] text-dim font-num">
                      <span>Emp band: <span className="text-muted">{t.emp_band || "·"}</span></span>
                      <span>Status: <span className="text-muted">{t.status || "active"}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="mt-16 card p-6">
        <h3 className="font-display text-[18px] text-ink mb-3">Persona fit class legend</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div><span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${fitClasses.primary}`}>primary</span><div className="text-muted mt-1.5">Direct buyer or decision owner. Lead outreach here.</div></div>
          <div><span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${fitClasses.strong}`}>strong</span><div className="text-muted mt-1.5">High-influence stakeholder. Strong second-touch target.</div></div>
          <div><span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${fitClasses.adj}`}>adj</span><div className="text-muted mt-1.5">Adjacent owner. Loop in on multi-thread.</div></div>
          <div><span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${fitClasses.signal}`}>signal</span><div className="text-muted mt-1.5">Triggered only when specific signal fires.</div></div>
        </div>
      </section>
    </div>
  );
}
