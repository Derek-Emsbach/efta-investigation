'use client'

import { useState } from 'react'

interface TabDef {
  id: string
  label: string
  count: number
}

interface ProfileTabsProps {
  tabs: TabDef[]
  children: Record<string, React.ReactNode>
}

export function ProfileTabs({ tabs, children }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-border-default overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-accent-red text-accent-red font-semibold'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 font-mono text-[10px] opacity-60">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6 animate-fade-in">
        {children[activeTab]}
      </div>
    </div>
  )
}
