type StatProps = {
  n: number | string | null | undefined;
  label: string;
  prefix?: string;
  suffix?: string;
  tone?: "default" | "warn" | "info" | "loss";
  hint?: string;
  /**
   * Optional delta vs prior period, as a fraction (e.g. 0.12 = +12%).
   * If null/undefined the chip is hidden — never fake a trend.
   */
  delta?: number | null;
  /** Inverts the delta color (e.g. unsubscribes — going down is "good"). */
  invertDelta?: boolean;
};

// In the SaaS shell we keep a single brand accent and let secondary tones
// fall back to the neutral foreground; this avoids the rainbow look. Only
// `loss` keeps its tint for negative-signal numbers.
const toneClasses: Record<string, string> = {
  default: "text-foreground",
  warn: "text-foreground",
  info: "text-foreground",
  loss: "text-danger",
};

export function Stat({
  n,
  label,
  prefix,
  suffix,
  tone = "default",
  hint,
  delta,
  invertDelta,
}: StatProps) {
  const display =
    n == null || n === ""
      ? "0"
      : typeof n === "number"
        ? n.toLocaleString()
        : String(n);

  return (
    <div className="card-stat px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted font-medium truncate">
          {label}
        </div>
        {typeof delta === "number" && isFinite(delta) ? (
          <TrendChip value={delta} invert={!!invertDelta} />
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className="text-ink2 text-[13px] font-num">{prefix}</span>
        )}
        <span
          className={`font-num text-[22px] font-semibold tracking-tight leading-none ${toneClasses[tone]}`}
        >
          {display}
        </span>
        {suffix && (
          <span className="text-ink2 text-[12px] font-num ml-1">{suffix}</span>
        )}
      </div>
      {hint && <div className="text-[11px] text-dim mt-1.5">{hint}</div>}
    </div>
  );
}

function TrendChip({ value, invert }: { value: number; invert: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const cls = positive
    ? "text-accent bg-accent/10"
    : negative
      ? "text-danger bg-danger/10"
      : "text-muted bg-surface2";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "—";
  const pct = `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-num text-[10px] px-1.5 py-0.5 leading-none ${cls}`}
      title="vs prior period"
    >
      <span className="text-[8px]">{arrow}</span>
      <span>{pct}</span>
    </span>
  );
}
