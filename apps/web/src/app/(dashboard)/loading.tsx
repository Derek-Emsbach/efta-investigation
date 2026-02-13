export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 pb-6 sm:px-6 sm:pb-8 md:pt-8 lg:px-8 animate-fade-in">
      {/* Page header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 skeleton-shimmer rounded" />
        <div className="h-4 w-72 skeleton-shimmer rounded mt-2" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border-default rounded-lg p-5">
            <div className="h-3 w-20 skeleton-shimmer rounded mb-3" />
            <div className="h-7 w-16 skeleton-shimmer rounded" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface border border-border-default rounded-lg p-5">
            <div className="flex items-center gap-4">
              <div className="h-4 w-32 skeleton-shimmer rounded" />
              <div className="h-4 w-20 skeleton-shimmer rounded" />
              <div className="h-4 w-24 skeleton-shimmer rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
