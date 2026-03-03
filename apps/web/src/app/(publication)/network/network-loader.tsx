'use client'

import dynamic from 'next/dynamic'

const NetworkClient = dynamic(() => import('./network-client'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-muted mt-3">Loading network map&hellip;</p>
      </div>
    </div>
  ),
})

export default function NetworkLoader() {
  return <NetworkClient />
}
