type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  source?: string;
  accent?: "accent" | "warn" | "info";
  actions?: React.ReactNode;
};

const dotColor: Record<string, string> = {
  accent: "bg-accent",
  warn: "bg-warn",
  info: "bg-info",
};

/**
 * Page-level header in the SaaS app shell.
 * Three weight levels per page: page title (here) > section header (SubHead) >
 * body. Title is Switzer semibold ~22px — deliberately understated so dense
 * data below has room to breathe.
 */
export function SectionHead({
  eyebrow,
  title,
  description,
  source,
  accent = "accent",
  actions,
}: Props) {
  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-2">
            <span className={`block w-1.5 h-1.5 rounded-full ${dotColor[accent]}`} />
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium font-num">
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
        <h1 className="text-[22px] leading-tight tracking-tight text-foreground font-semibold">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] leading-relaxed text-ink2 mt-2 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SubHead({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mt-8 mb-3 pb-2 border-b border-border">
      <div className="flex items-baseline gap-3 min-w-0">
        <h2 className="text-[12.5px] text-foreground font-semibold uppercase tracking-[0.06em]">
          {title}
        </h2>
        {hint && (
          <span className="text-[11px] text-dim font-num truncate">{hint}</span>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
