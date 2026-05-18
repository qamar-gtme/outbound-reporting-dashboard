/**
 * TAM page skeleton — 5 stats + a long table for the v3 mega coverage.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-3 w-20 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-72 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-[28rem] max-w-full rounded bg-surface2/70 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card-stat px-4 py-3">
            <div className="h-2.5 w-16 rounded bg-surface2 animate-pulse mb-3" />
            <div className="h-6 w-20 rounded bg-surface2 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-8 mb-3 pb-2 border-b border-border">
        <div className="h-3 w-40 rounded bg-surface2 animate-pulse" />
      </div>

      <div className="card overflow-hidden mb-2">
        <div className="h-9 bg-surface2/40 border-b border-border" />
        <div className="divide-y divide-border">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="px-3 py-3 flex gap-6 items-center">
              <div className="h-3 w-48 rounded bg-surface2/70 animate-pulse" />
              <div className="h-3 flex-1 rounded bg-surface2/50 animate-pulse" />
              <div className="h-3 w-12 rounded bg-surface2/60 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
