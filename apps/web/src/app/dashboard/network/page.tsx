'use client'

import dynamic from 'next/dynamic'
import MainContent from '@/components/layout/main-content'
import { Skeleton } from '@/components/ui/skeleton'

const NetworkClient = dynamic(() => import('./network-client'), {
  ssr: false,
  loading: () => (
    <MainContent>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="flex flex-wrap gap-4 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-28" />
        ))}
      </div>
      <Skeleton className="w-full h-[500px] rounded-lg" />
    </MainContent>
  ),
})

export default function NetworkPage() {
  return <NetworkClient />
}
