type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  source?: string;
  accent?: "accent" | "warn" | "info";
};

const dotColor: Record<string, string> = {
  accent: "bg-accent",
  warn: "bg-warn",
  info: "bg-info",
};

export function SectionHead({ eyebrow, title, description, source, accent = "accent" }: Props) {
  return (
    <div className="mb-8 max-w-3xl">
      {eyebrow && (
        <div className="flex items-center gap-2 mb-3">
          <span className={`block w-1.5 h-1.5 rounded-full ${dotColor[accent]}`} />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">{eyebrow}</span>
          {source && (
            <>
              <span className="text-dim">·</span>
              <span className="kbd">{source}</span>
            </>
          )}
        </div>
      )}
      <h1 className="font-display text-[44px] leading-[1.05] tracking-tightest text-ink font-medium">
        {title}
      </h1>
      {description && (
        <p className="text-[15px] leading-relaxed text-ink2 mt-3 max-w-2xl">{description}</p>
      )}
    </div>
  );
}

export function SubHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mt-12 mb-4 pb-3 border-b border-line">
      <h2 className="font-display text-[22px] tracking-tight text-ink font-medium">{title}</h2>
      {hint && <span className="text-[11px] text-dim font-num">{hint}</span>}
    </div>
  );
}
