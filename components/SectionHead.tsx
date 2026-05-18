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

/**
 * Page-level header in the SaaS app shell.
 * Title is a Switzer semibold ~26px (was a giant Sentient editorial display).
 * Eyebrow + source chip kept for context.
 */
export function SectionHead({ eyebrow, title, description, source, accent = "accent" }: Props) {
  return (
    <div className="mb-6 max-w-3xl">
      {eyebrow && (
        <div className="flex items-center gap-2 mb-2">
          <span className={`block w-1.5 h-1.5 rounded-full ${dotColor[accent]}`} />
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium">
            {eyebrow}
          </span>
          {source && (
            <>
              <span className="text-dim">·</span>
              <span className="kbd">{source}</span>
            </>
          )}
        </div>
      )}
      <h1 className="text-[24px] leading-tight tracking-tight text-foreground font-semibold">
        {title}
      </h1>
      {description && (
        <p className="text-[13px] leading-relaxed text-ink2 mt-2 max-w-2xl">{description}</p>
      )}
    </div>
  );
}

export function SubHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mt-8 mb-3 pb-2 border-b border-border">
      <h2 className="text-[14px] tracking-tight text-foreground font-semibold">{title}</h2>
      {hint && <span className="text-[11px] text-dim font-num">{hint}</span>}
    </div>
  );
}
