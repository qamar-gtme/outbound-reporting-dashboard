/**
 * ICP coverage matrix skeleton. Reserves the 5-stat header + depth/campaign
 * chip bar + a wide matrix table so layout doesn't shift.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-3 w-44 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-64 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-[36rem] max-w-full rounded bg-surface2/70 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card-stat px-4 py-3">
            <div className="h-2.5 w-16 rounded bg-surface2 animate-pulse mb-3" />
            <div className="h-6 w-20 rounded bg-surface2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Depth / campaign chip bar */}
      <div className="card-tight px-3 py-2.5 mb-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-20 rounded-md bg-surface2/70 animate-pulse"
          />
        ))}
      </div>

      {/* Matrix */}
      <div className="card overflow-hidden">
        <div className="h-9 bg-surface2/40 border-b border-border" />
        <div className="divide-y divide-border">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5 flex gap-6">
              <div className="h-3 w-48 rounded bg-surface2/70 animate-pulse" />
              <div className="h-3 flex-1 rounded bg-surface2/50 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
