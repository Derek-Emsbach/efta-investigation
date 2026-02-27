export default function EntityProfileLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 pb-6 sm:px-6 sm:pb-8 md:pt-8 lg:px-8 animate-fade-in">
      {/* Breadcrumb skeleton */}
      <div className="h-4 w-40 skeleton-shimmer rounded mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero skeleton */}
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full skeleton-shimmer shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-8 w-56 skeleton-shimmer rounded" />
              <div className="h-4 w-36 skeleton-shimmer rounded" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-border-default rounded-lg p-5">
                <div className="h-3 w-16 skeleton-shimmer rounded mb-3" />
                <div className="h-7 w-10 skeleton-shimmer rounded" />
              </div>
            ))}
          </div>

          {/* Bio skeleton */}
          <div className="bg-surface border border-border-default rounded-lg p-6">
            <div className="h-5 w-32 skeleton-shimmer rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full skeleton-shimmer rounded" />
              <div className="h-3 w-5/6 skeleton-shimmer rounded" />
              <div className="h-3 w-4/6 skeleton-shimmer rounded" />
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="flex border-b border-border-default px-4 py-3 gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 w-20 skeleton-shimmer rounded" />
              ))}
            </div>
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 skeleton-shimmer rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border-default rounded-lg p-5">
              <div className="h-4 w-24 skeleton-shimmer rounded mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full skeleton-shimmer rounded" />
                <div className="h-3 w-4/5 skeleton-shimmer rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
