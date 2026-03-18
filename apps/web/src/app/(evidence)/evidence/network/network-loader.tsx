'use client'

import dynamic from 'next/dynamic'

const EvidenceNetworkClient = dynamic(() => import('./network-client'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-8">
      <div className="h-8 w-48 bg-surface rounded animate-pulse" />
      <div className="h-4 w-80 bg-surface rounded animate-pulse mt-2" />
      <div className="flex flex-wrap gap-4 mt-6 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 w-28 bg-surface rounded animate-pulse" />
        ))}
      </div>
      <div className="w-full h-[600px] bg-surface rounded-lg animate-pulse" />
    </div>
  ),
})

export function EvidenceNetworkLoader() {
  return <EvidenceNetworkClient />
}
