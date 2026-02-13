'use client'

import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'

const InvestigatePanel = dynamic(() => import('./investigate-panel'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-text-muted border-l border-border-default bg-surface w-[380px]">
      Loading...
    </div>
  ),
})

interface EntityProfileLayoutProps {
  entityId: string
  entityName: string
  children: ReactNode
}

export function EntityProfileLayout({ entityId, entityName, children }: EntityProfileLayoutProps) {
  const [showInvestigate, setShowInvestigate] = useState(false)

  return (
    <div className={`flex ${showInvestigate ? 'gap-0' : ''}`}>
      {/* Main content */}
      <div className={`flex-1 min-w-0 ${showInvestigate ? 'max-w-[calc(100%-380px)]' : ''}`}>
        {/* Investigate button — injected at the top */}
        {!showInvestigate && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowInvestigate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-info/10 border border-info/20 px-4 py-2 text-sm font-medium text-info hover:bg-info/20 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
              </svg>
              Investigate with Archer
            </button>
          </div>
        )}

        {children}
      </div>

      {/* Investigate panel — right side */}
      {showInvestigate && (
        <div className="w-[380px] shrink-0 h-[calc(100vh-4rem)] sticky top-16">
          <InvestigatePanel
            entityId={entityId}
            entityName={entityName}
            onClose={() => setShowInvestigate(false)}
          />
        </div>
      )}
    </div>
  )
}
