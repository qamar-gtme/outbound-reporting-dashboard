import { fetchTable } from "@/lib/supabase";
import { Stat } from "@/components/Stat";
import { SectionHead, SubHead } from "@/components/SectionHead";
import { MEGA_INDUSTRIES, resolveMega } from "@/lib/taxonomy";
import { MarketplaceBadge } from "@/components/PersonaCard";

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

  // Build v3 mega-coverage: which canonical megas already have rows in tam_industries.
  // Counts are pulled from the DB when present; null/missing → render `—`.
  const indByMega: Record<string, any> = {};
  for (const i of inds as any[]) {
    const mega = resolveMega(i.mega_industry || i.name);
    if (mega) {
      const cur = indByMega[mega.key];
      // Use the row with the largest company_count_us if multiple match.
      if (!cur || (i.company_count_us || 0) > (cur.company_count_us || 0)) {
        indByMega[mega.key] = i;
      }
    }
  }

  return (
    <div>
      <SectionHead
        eyebrow="Section C · v3"
        title="TAM Coverage"
        description="Hierarchical company-count map across 18 v3 mega industries, sub industries, and verticals. Counts are mid-range Census SUSB pulls; rows still pending the v3 refresh render as `—`."
        source="tam_*"
        accent="info"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
        <Stat n={totalCos} label="addressable cos US" tone="info" />
        <Stat n={MEGA_INDUSTRIES.length} label="v3 megas" tone="info" />
        <Stat n={inds.length} label="L1 industries (DB)" tone="info" />
        <Stat n={subs.length} label="L2 sub industries" tone="info" />
        <Stat n={verts.length} label="L3 verticals" tone="info" />
      </div>

      <SubHead title="v3 mega coverage" hint="18 MECE rows · `—` = pending Census refresh" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr>
              <th>Mega industry</th>
              <th>NAICS anchor</th>
              <th className="text-right">Cos US</th>
              <th className="text-right">Comp density</th>
              <th className="text-right">Dials</th>
              <th className="text-right">Convos</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MEGA_INDUSTRIES.map((m, i) => {
              const row = indByMega[m.key];
              const dialed = Object.values(indDials)
                .filter((d: any) => {
                  const mega = resolveMega(d.industry);
                  return mega?.key === m.key;
                })
                .reduce((a: number, d: any) => a + (d.dials || 0), 0);
              const convs = Object.values(indDials)
                .filter((d: any) => {
                  const mega = resolveMega(d.industry);
                  return mega?.key === m.key;
                })
                .reduce((a: number, d: any) => a + (d.conversations || 0), 0);
              return (
                <tr key={m.key}>
                  <td className="font-medium text-ink">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{m.label}</span>
                      {m.newInV3 && (
                        <span className="text-[8.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-accent/30 bg-accent/12 text-accent">
                          new
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted leading-snug mt-0.5 max-w-md">
                      {m.blurb}
                    </div>
                  </td>
                  <td className="font-num text-muted text-[11px]">{m.naics.join(", ")}</td>
                  <td className="text-right font-num">{num(row?.company_count_us)}</td>
                  <td className="text-right font-num text-muted">
                    {num(row?.competitor_density)}
                  </td>
                  <td className="text-right font-num">{dialed > 0 ? num(dialed) : "—"}</td>
                  <td className="text-right font-num text-accent">
                    {convs > 0 ? num(convs) : "—"}
                  </td>
                  <td>
                    {row ? (
                      <span className="text-[11px] text-accent">live</span>
                    ) : (
                      <span className="text-[11px] text-dim italic">pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SubHead title="Level 1 — raw DB rows" hint="all rows from tam_industries, ordered by company_count_us" />
      <div className="card overflow-hidden mb-2">
        <table className="data">
          <thead>
            <tr>
              <th>Industry</th>
              <th>Maps to v3 mega</th>
              <th className="text-right">Cos US</th>
              <th className="text-right">Competitor density</th>
              <th className="text-right">Dials</th>
              <th className="text-right">Convos</th>
            </tr>
          </thead>
          <tbody>
            {(inds as any[]).map((ti: any, i: number) => {
              const dialed = Object.values(indDials)
                .filter(
                  (d: any) =>
                    (ti.name || "").toLowerCase().split(" ")[0] ===
                    (d.industry || "").toLowerCase().split(" ")[0],
                )
                .reduce((a: number, d: any) => a + (d.dials || 0), 0);
              const convs = Object.values(indDials)
                .filter(
                  (d: any) =>
                    (ti.name || "").toLowerCase().split(" ")[0] ===
                    (d.industry || "").toLowerCase().split(" ")[0],
                )
                .reduce((a: number, d: any) => a + (d.conversations || 0), 0);
              const mapped = resolveMega(ti.mega_industry || ti.name);
              return (
                <tr key={i}>
                  <td className="font-medium text-ink">{ti.name}</td>
                  <td className="text-[11px]">
                    {mapped ? (
                      <span className="text-info">{mapped.label}</span>
                    ) : (
                      <span className="text-warn italic">unmapped</span>
                    )}
                  </td>
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
          <thead>
            <tr>
              <th>Sub industry</th>
              <th>NAICS</th>
              <th className="text-right">Cos US</th>
              <th>AI fit</th>
              <th className="text-right">Comp density</th>
            </tr>
          </thead>
          <tbody>
            {(subs as any[]).map((s: any, i: number) => (
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

      <SubHead title="Level 3 verticals" hint="top 60 by company count · ◇ = marketplace" />
      <div className="card overflow-hidden">
        <table className="data">
          <thead>
            <tr>
              <th>Vertical</th>
              <th className="text-right">Cos US</th>
              <th>AI fit</th>
              <th className="text-right">Comp density</th>
              <th>Top players</th>
            </tr>
          </thead>
          <tbody>
            {(verts as any[]).map((v: any, i: number) => (
              <tr key={i}>
                <td className="font-medium text-ink">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{v.name}</span>
                    {v.is_marketplace && <MarketplaceBadge size="xs" />}
                  </div>
                </td>
                <td className="text-right font-num">{num(v.company_count_us)}</td>
                <td>{aiFit(v.ai_cx_fit)}</td>
                <td className="text-right font-num text-muted">{num(v.competitor_density)}</td>
                <td className="text-[12px] text-muted">
                  {(v.top_players || []).slice(0, 4).join(", ") || "·"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function num(v: any) {
  return v != null ? Number(v).toLocaleString() : "—";
}

function aiFit(f: string | null) {
  const map: Record<string, string> = {
    HIGH: "text-accent",
    MED: "text-warn",
    LOW: "text-loss",
    SKIP: "text-dim",
  };
  if (!f) return <span className="text-dim">·</span>;
  return <span className={`text-[11px] font-medium ${map[f] || "text-muted"}`}>{f}</span>;
}
