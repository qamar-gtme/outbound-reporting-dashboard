type StatProps = {
  n: number | string | null | undefined;
  label: string;
  prefix?: string;
  suffix?: string;
  tone?: "default" | "warn" | "info" | "loss";
  hint?: string;
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

export function Stat({ n, label, prefix, suffix, tone = "default", hint }: StatProps) {
  const display = n == null || n === "" ? "0" : typeof n === "number" ? n.toLocaleString() : String(n);
  return (
    <div className="card px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.10em] text-muted mb-1.5 font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-ink2 text-[13px] font-num">{prefix}</span>}
        <span
          className={`font-num text-[22px] font-semibold tracking-tight leading-none ${toneClasses[tone]}`}
        >
          {display}
        </span>
        {suffix && <span className="text-ink2 text-[12px] font-num ml-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[11px] text-dim mt-1.5">{hint}</div>}
    </div>
  );
}
