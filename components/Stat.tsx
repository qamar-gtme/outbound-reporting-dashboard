type StatProps = {
  n: number | string | null | undefined;
  label: string;
  prefix?: string;
  suffix?: string;
  tone?: "default" | "warn" | "info" | "loss";
  hint?: string;
};

const toneClasses: Record<string, string> = {
  default: "text-accent",
  warn: "text-warn",
  info: "text-info",
  loss: "text-loss",
};

export function Stat({ n, label, prefix, suffix, tone = "default", hint }: StatProps) {
  const display = n == null || n === "" ? "0" : typeof n === "number" ? n.toLocaleString() : String(n);
  return (
    <div className="card px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted mb-2 font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-ink2 text-lg font-num">{prefix}</span>}
        <span className={`font-num text-[28px] font-semibold tracking-tight ${toneClasses[tone]} leading-none`}>
          {display}
        </span>
        {suffix && <span className="text-ink2 text-sm font-num ml-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[11px] text-dim mt-2">{hint}</div>}
    </div>
  );
}
