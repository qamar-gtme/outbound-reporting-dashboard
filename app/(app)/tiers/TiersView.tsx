"use client";

import { useMemo, useState } from "react";
import {
  MEGA_INDUSTRIES,
  MegaIndustry,
  Persona,
  normalizePersona,
  resolveMega,
} from "@/lib/taxonomy";
import { MarketplaceBadge, PersonaCard } from "@/components/PersonaCard";
import { Stat } from "@/components/Stat";

type TierRow = {
  id: string | number;
  tier?: string | null;
  vertical?: string | null;
  subindustry?: string | null;
  mega_industry?: string | null;
  industry?: string | null;
  rationale?: string | null;
  emp_band?: string | null;
  status?: string | null;
  est_companies_us?: number | null;
  is_marketplace?: boolean | null;
  business_model?: string | null;
  personas?: any;
};

const TIER_ORDER = ["Tier 1", "Tier 2", "Tier 3"] as const;
type TierName = (typeof TIER_ORDER)[number];

const tierColor: Record<string, { text: string; bar: string }> = {
  "Tier 1": { text: "text-accent", bar: "bg-accent" },
  "Tier 2": { text: "text-warn", bar: "bg-warn" },
  "Tier 3": { text: "text-loss", bar: "bg-loss" },
};

export function TiersView({ tiers }: { tiers: TierRow[] }) {
  const [marketplaceOnly, setMarketplaceOnly] = useState(false);

  const filtered = useMemo(
    () => (marketplaceOnly ? tiers.filter((t) => t.is_marketplace === true) : tiers),
    [tiers, marketplaceOnly],
  );

  // Group rows by mega-industry (resolved from DB row's industry/mega_industry/vertical).
  // Verticals that don't resolve land in an "Unmapped" bucket so we can see them.
  const byMega = useMemo(() => {
    const map: Record<string, TierRow[]> = {};
    for (const m of MEGA_INDUSTRIES) map[m.key] = [];
    const unmapped: TierRow[] = [];
    for (const row of filtered) {
      const candidate = row.mega_industry || row.industry || row.subindustry || row.vertical;
      const mega = resolveMega(candidate);
      if (mega) map[mega.key].push(row);
      else unmapped.push(row);
    }
    return { map, unmapped };
  }, [filtered]);

  const byTier: Record<TierName, TierRow[]> = {
    "Tier 1": [],
    "Tier 2": [],
    "Tier 3": [],
  };
  filtered.forEach((t) => {
    const k = (t.tier as TierName) || "Tier 3";
    if (byTier[k]) byTier[k].push(t);
  });

  const totalCos = filtered.reduce((a, t) => a + (t.est_companies_us || 0), 0);
  const totalPersonas = filtered.reduce(
    (a, t) => a + (Array.isArray(t.personas) ? t.personas.length : 0),
    0,
  );
  const marketplaceCount = tiers.filter((t) => t.is_marketplace === true).length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Stat n={MEGA_INDUSTRIES.length} label="v3 megas" />
        <Stat n={filtered.length} label="Verticals" />
        <Stat n={byTier["Tier 1"].length} label="Tier 1" />
        <Stat n={byTier["Tier 2"].length} label="Tier 2" />
        <Stat n={totalPersonas} label="Personas" />
        <Stat n={totalCos} label="Addressable cos" />
      </div>

      {/* Marketplace filter toggle */}
      <div className="card px-4 py-3 mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[13px] text-foreground font-medium mb-0.5">
            Marketplace filter
          </div>
          <div className="text-[12px] text-muted leading-snug max-w-xl">
            Marketplace is a horizontal business-model flag, not a mega-industry row.
            Overlay <span className="text-info">is_marketplace</span> across all megas.
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-dim font-num">
            {marketplaceCount} flagged
          </span>
          <button
            onClick={() => setMarketplaceOnly((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border ${
              marketplaceOnly
                ? "bg-info/20 border-info/40"
                : "bg-surface3 border-border-strong"
            }`}
            aria-pressed={marketplaceOnly}
            aria-label="Toggle marketplace filter"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                marketplaceOnly
                  ? "translate-x-6 bg-info"
                  : "translate-x-1 bg-muted"
              }`}
            />
          </button>
          <span className="text-[11px] text-muted font-num w-24">
            {marketplaceOnly ? "Marketplaces only" : "All verticals"}
          </span>
        </div>
      </div>

      {/* Tier view (preserves the legacy tiered grouping) */}
      {TIER_ORDER.map((tn) => {
        const rows = byTier[tn];
        if (rows.length === 0 && marketplaceOnly) return null;
        const c = tierColor[tn];
        const cnt = rows.reduce((a, t) => a + (t.est_companies_us || 0), 0);
        return (
          <section key={tn} className="mb-10">
            <div className="flex items-baseline justify-between mt-8 mb-4 pb-2 border-b border-border">
              <div className="flex items-baseline gap-3">
                <span className={`block w-2 h-2 rounded-full ${c.bar}`} />
                <h2 className={`text-[14px] tracking-tight font-semibold ${c.text}`}>
                  {tn}
                </h2>
                <span className="text-[11px] text-dim font-num">
                  {rows.length} verticals · ~{cnt.toLocaleString()} cos
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {rows.length === 0 && (
                <div className="text-[12px] text-dim italic">
                  No verticals at this tier under the current filter.
                </div>
              )}
              {rows.map((t) => <VerticalCard key={String(t.id)} row={t} />)}
            </div>
          </section>
        );
      })}

      {/* v3 mega coverage matrix — shows which canonical megas have data yet */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mt-8 mb-4 pb-2 border-b border-border">
          <div className="flex items-baseline gap-3">
            <span className="block w-2 h-2 rounded-full bg-info" />
            <h2 className="text-[14px] tracking-tight font-semibold text-info">
              v3 mega coverage
            </h2>
            <span className="text-[11px] text-dim font-num">
              18 MECE rows · grouped by canonical mega
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {MEGA_INDUSTRIES.map((m) => {
            const rows = byMega.map[m.key] || [];
            const cos = rows.reduce((a, r) => a + (r.est_companies_us || 0), 0);
            return (
              <div key={m.key} className="card p-4">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className="text-[13px] font-semibold tracking-tight text-foreground">
                      {m.label}
                    </div>
                    {m.newInV3 && (
                      <span className="text-[8.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-accent/30 bg-accent/12 text-accent">
                        new in v3
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-num text-[14px] text-ink">{rows.length}</div>
                    <div className="text-[9px] uppercase tracking-wider text-dim">verticals</div>
                  </div>
                </div>
                <div className="text-[11px] text-muted leading-snug mb-2">{m.blurb}</div>
                <div className="flex items-center justify-between gap-2 text-[10.5px] font-num text-dim">
                  <span className="font-mono">{m.naics.join(" · ")}</span>
                  <span>
                    {cos > 0 ? `~${cos.toLocaleString()} cos` : "— no rows yet"}
                  </span>
                </div>
                {rows.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rows.slice(0, 6).map((r) => (
                      <span
                        key={String(r.id)}
                        className="text-[10.5px] px-1.5 py-0.5 rounded border border-line text-ink2 bg-surface3"
                      >
                        {r.vertical || r.subindustry || "·"}
                        {r.is_marketplace && (
                          <span className="ml-1 text-info">◇</span>
                        )}
                      </span>
                    ))}
                    {rows.length > 6 && (
                      <span className="text-[10.5px] text-dim self-center">
                        +{rows.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {byMega.unmapped.length > 0 && (
          <div className="mt-6 card p-4 border-warn/30">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="block w-1.5 h-1.5 rounded-full bg-warn" />
              <div className="text-[12px] uppercase tracking-wider text-warn font-medium">
                Unmapped to v3 taxonomy
              </div>
              <span className="text-[11px] text-dim font-num">
                {byMega.unmapped.length} rows
              </span>
            </div>
            <div className="text-[11.5px] text-muted mb-3 leading-snug">
              These rows didn't match any v3 mega. Likely v2 legacy strings
              (consumer-services, marketplaces-as-row, etc) — needs backfill.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {byMega.unmapped.map((r) => (
                <span
                  key={String(r.id)}
                  className="text-[10.5px] px-1.5 py-0.5 rounded border border-line text-muted bg-surface3"
                >
                  {r.vertical || r.subindustry || r.industry || "·"}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10 card p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">
          Persona legend
        </h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div>
            <span className="text-[8.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-warn/30 bg-warn/12 text-warn">
              $ buyer
            </span>
            <div className="text-muted mt-1.5">Economic buyer — owns budget.</div>
          </div>
          <div>
            <span className="text-[8.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-accent/30 bg-accent/12 text-accent">
              champion
            </span>
            <div className="text-muted mt-1.5">Internal advocate, drives the deal forward.</div>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border bg-accent/12 text-accent border-accent/25">
              cx
            </span>
            <div className="text-muted mt-1.5">Function color tag — green = cx/product.</div>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border bg-loss/12 text-loss border-loss/25">
              compliance
            </span>
            <div className="text-muted mt-1.5">Red = compliance/clinical/legal — usually blockers.</div>
          </div>
        </div>
      </section>
    </>
  );
}

function VerticalCard({ row }: { row: TierRow }) {
  const rawPersonas = Array.isArray(row.personas) ? row.personas : [];
  const personas: Persona[] = rawPersonas.map(normalizePersona);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="text-[15px] font-semibold tracking-tight text-foreground">
              {row.vertical || "·"}
            </div>
            {row.is_marketplace && <MarketplaceBadge size="xs" />}
            {row.business_model && row.business_model !== "first-party" && (
              <span className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border border-border text-dim bg-surface2 font-num">
                {row.business_model}
              </span>
            )}
          </div>
          <div className="text-[12px] text-muted">{row.subindustry || "·"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-num text-[18px] text-foreground font-semibold leading-none tabular-nums">
            {row.est_companies_us != null
              ? row.est_companies_us.toLocaleString()
              : "—"}
          </div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-dim mt-1 font-num">
            cos US
          </div>
        </div>
      </div>

      {row.rationale && (
        <div className="text-[12.5px] text-ink2 leading-relaxed mb-4 max-w-2xl">
          {row.rationale}
        </div>
      )}

      <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-3 font-medium font-num">
        Buyer personas{" "}
        <span className="text-dim normal-case tracking-normal">
          ({personas.length})
        </span>
        {personas.length === 0 && (
          <span className="text-dim normal-case tracking-normal italic ml-2">
            — pending v3 enrichment
          </span>
        )}
      </div>
      {personas.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {personas.map((p, i) => (
            <PersonaCard key={i} p={p} />
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-[11px] text-dim font-num flex-wrap">
        <span>
          Emp band:{" "}
          <span className="text-muted">{row.emp_band || "·"}</span>
        </span>
        <span>
          Status:{" "}
          <span className="text-muted">{row.status || "active"}</span>
        </span>
        {row.is_marketplace && (
          <span>
            Model: <span className="text-info">marketplace</span>
          </span>
        )}
      </div>
    </div>
  );
}
