export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export function SkeletonStatCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-panel border border-line rounded-lg p-5 flex flex-col gap-3">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-7 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel({ className = 'h-64' }) {
  return (
    <div className={`bg-panel border border-line rounded-lg p-5 ${className}`}>
      <SkeletonBlock className="h-full w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-panel rounded-xl border border-line overflow-hidden">
      <div className="p-5 flex flex-col gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 flex-1" />
            <SkeletonBlock className="h-4 w-20 hidden sm:block" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonProjectDetail() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-24">
      <SkeletonBlock className="h-3.5 w-28" />

      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-7 w-2/3" />
      </div>

      <div className="bg-panel border border-line rounded-lg p-4">
        <SkeletonBlock className="h-24 w-full" />
      </div>

      <div className="flex gap-1.5 border-b border-line pb-2.5">
        <SkeletonBlock className="h-8 w-24 rounded-t-md" />
        <SkeletonBlock className="h-8 w-20 rounded-t-md" />
        <SkeletonBlock className="h-8 w-32 rounded-t-md" />
        <SkeletonBlock className="h-8 w-40 rounded-t-md" />
      </div>

      <div className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
        <SkeletonBlock className="h-4 w-28" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
