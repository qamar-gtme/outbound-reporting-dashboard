/**
 * Tiers page skeleton — a head + a long list of tier cards.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-3 w-32 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-56 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-[34rem] max-w-full rounded bg-surface2/70 animate-pulse" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <div className="h-3 w-40 rounded bg-surface2 animate-pulse" />
              <div className="h-3 w-20 rounded bg-surface2/60 animate-pulse" />
            </div>
            <div className="h-2.5 w-full max-w-[40ch] rounded bg-surface2/50 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
