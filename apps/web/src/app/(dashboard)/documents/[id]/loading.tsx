export default function DocumentDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 pb-6 sm:px-6 sm:pb-8 md:pt-8 lg:px-8 animate-fade-in">
      {/* Breadcrumb skeleton */}
      <div className="h-4 w-48 skeleton-shimmer rounded mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document header skeleton */}
          <div className="flex items-start gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-6 w-40 skeleton-shimmer rounded" />
              <div className="h-8 w-72 skeleton-shimmer rounded" />
            </div>
            <div className="h-6 w-20 skeleton-shimmer rounded" />
          </div>

          {/* Metadata grid skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-16 skeleton-shimmer rounded mb-1" />
                <div className="h-4 w-24 skeleton-shimmer rounded" />
              </div>
            ))}
          </div>

          {/* Document viewer skeleton */}
          <div className="bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default">
              <div className="h-4 w-16 skeleton-shimmer rounded" />
              <div className="h-4 w-16 skeleton-shimmer rounded" />
            </div>
            <div className="h-[500px] skeleton-shimmer" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border-default rounded-lg p-5">
              <div className="h-4 w-28 skeleton-shimmer rounded mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="h-3 w-3 skeleton-shimmer rounded-full" />
                    <div className="h-3 w-32 skeleton-shimmer rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
