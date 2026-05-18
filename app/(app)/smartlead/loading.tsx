/**
 * Smartlead campaign inventory skeleton. Reserves space for the filter bar
 * and the campaigns table.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-3 w-24 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-48 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-[32rem] max-w-full rounded bg-surface2/70 animate-pulse" />
      </div>

      {/* Sticky filter bar placeholder — match height to prevent CLS */}
      <div className="sticky top-14 z-10 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-4 bg-background/85 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-64 rounded bg-surface2 animate-pulse" />
          <div className="h-px w-px" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-24 rounded-md bg-surface2/70 animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Campaigns table placeholder */}
      <div className="card overflow-hidden mb-3">
        <div className="h-9 bg-surface2/40 border-b border-border" />
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-3 py-3 flex items-center gap-4">
              <div className="h-2 w-2 rounded-full bg-surface2 animate-pulse" />
              <div className="h-3 flex-1 max-w-[24rem] rounded bg-surface2/70 animate-pulse" />
              <div className="h-5 w-16 rounded-md bg-surface2/60 animate-pulse" />
              <div className="h-3 w-20 rounded bg-surface2/60 animate-pulse" />
              <div className="h-3 w-16 rounded bg-surface2/60 animate-pulse" />
              <div className="h-3 w-12 rounded bg-surface2/60 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
