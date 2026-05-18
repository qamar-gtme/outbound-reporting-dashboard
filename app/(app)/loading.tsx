/**
 * Default loading skeleton for the app shell. Shown by Next.js while a
 * Server Component is suspending (e.g. waiting on a cache miss). Matches
 * the home page shape so there's no layout jump when the real content
 * paints.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Section head */}
      <div className="mb-6">
        <div className="h-3 w-28 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-72 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-96 rounded bg-surface2/70 animate-pulse" />
      </div>

      {/* KPI grid — 6 tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-stat px-4 py-3">
            <div className="h-2.5 w-16 rounded bg-surface2 animate-pulse mb-3" />
            <div className="h-6 w-20 rounded bg-surface2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Two-column block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="h-3 w-32 rounded bg-surface2 animate-pulse mb-2" />
            <div className="h-2.5 w-56 rounded bg-surface2/70 animate-pulse" />
          </div>
          <div className="p-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-surface2/60 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="h-3 w-24 rounded bg-surface2 animate-pulse mb-2" />
            <div className="h-2.5 w-40 rounded bg-surface2/70 animate-pulse" />
          </div>
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-3 w-full rounded bg-surface2/60 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
