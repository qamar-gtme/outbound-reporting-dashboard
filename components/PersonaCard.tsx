import { Persona, functionClass } from "@/lib/taxonomy";

/**
 * v3 persona card. Renders the canonical (normalized) Persona shape.
 *
 * Variable-length — render 3–7 of these inside a flex/grid wrapper at the
 * call site. Color-coded by function. Distinct badges for economic buyers
 * and champions. Falls back gracefully for v2 rows (no function/seniority).
 */
export function PersonaCard({ p }: { p: Persona }) {
  const fnLabel = (p.function || "").toString();
  const badgeClass = functionClass(fnLabel);
  const seniority = p.seniority || "";

  return (
    <div className="card-tight p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-medium text-[13px] text-ink leading-tight">{p.role}</div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {p.is_economic_buyer && (
            <span
              className="text-[8.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-warn/30 bg-warn/12 text-warn"
              title="Economic buyer — controls budget"
            >
              $ buyer
            </span>
          )}
          {p.is_champion && (
            <span
              className="text-[8.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-accent/30 bg-accent/12 text-accent"
              title="Champion — internal advocate"
            >
              champion
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {fnLabel && (
          <span
            className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${badgeClass}`}
          >
            {fnLabel}
          </span>
        )}
        {seniority && (
          <span className="text-[10px] text-dim font-num uppercase tracking-wider">
            {seniority}
          </span>
        )}
        {/* legacy v2 fit class — render only when no v3 function present */}
        {!fnLabel && p.fit && (
          <span className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border bg-surface3 text-muted border-line">
            {p.fit}
          </span>
        )}
      </div>

      {p.notes && (
        <div className="text-[11.5px] text-muted leading-snug">{p.notes}</div>
      )}
    </div>
  );
}

export function MarketplaceBadge({ size = "sm" }: { size?: "sm" | "xs" }) {
  const cls =
    size === "xs"
      ? "text-[9px] px-1.5 py-0.5"
      : "text-[10px] px-2 py-0.5";
  return (
    <span
      className={`${cls} uppercase tracking-wider font-medium rounded border border-info/30 bg-info/12 text-info`}
      title="Marketplace / multi-sided business model"
    >
      marketplace
    </span>
  );
}
