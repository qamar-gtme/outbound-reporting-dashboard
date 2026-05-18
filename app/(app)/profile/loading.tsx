/**
 * Profile page skeleton — short account summary card + a form card.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-3 w-20 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-6 w-32 rounded bg-surface2 animate-pulse mb-3" />
        <div className="h-3 w-[28rem] max-w-full rounded bg-surface2/70 animate-pulse" />
      </div>

      <section className="card p-5 mb-4 max-w-lg">
        <div className="h-3 w-24 rounded bg-surface2 animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <div className="h-2.5 w-24 rounded bg-surface2/70 animate-pulse" />
              <div className="h-3 w-40 rounded bg-surface2/60 animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 max-w-lg">
        <div className="h-3 w-32 rounded bg-surface2 animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded bg-surface2/60 animate-pulse" />
          ))}
        </div>
      </section>
    </div>
  );
}
