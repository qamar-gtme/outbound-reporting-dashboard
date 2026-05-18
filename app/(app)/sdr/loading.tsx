/**
 * SDR page skeleton. Mirrors the headline KPI grid + a tall scorecard table
 * so there's no shift when the real content arrives.
 */
export default function Loading() {
  return (
    <div>
      {/* Section head */}
      <div className="mb-6">
        <div className="h-3 w-16 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-56 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-[28rem] max-w-full rounded bg-surface2/70 animate-pulse" />
      </div>

      {/* Sub head */}
      <div className="flex items-baseline justify-between gap-3 mt-8 mb-3 pb-2 border-b border-border">
        <div className="h-3 w-40 rounded bg-surface2 animate-pulse" />
        <div className="h-2.5 w-32 rounded bg-surface2/60 animate-pulse" />
      </div>

      {/* 8-tile KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card-stat px-4 py-3">
            <div className="h-2.5 w-16 rounded bg-surface2 animate-pulse mb-3" />
            <div className="h-6 w-16 rounded bg-surface2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Scorecard */}
      <div className="flex items-baseline justify-between gap-3 mt-8 mb-3 pb-2 border-b border-border">
        <div className="h-3 w-44 rounded bg-surface2 animate-pulse" />
      </div>
      <div className="card overflow-hidden mb-2">
        <div className="px-3 py-2 border-b border-border h-9 bg-surface2/40" />
        <div className="divide-y divide-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5 flex gap-6">
              <div className="h-3 w-24 rounded bg-surface2/70 animate-pulse" />
              <div className="h-3 flex-1 max-w-[60ch] rounded bg-surface2/60 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
