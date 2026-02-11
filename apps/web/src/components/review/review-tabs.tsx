'use client'

interface ReviewTabsProps {
  activeTab: 'form' | 'archer'
  onTabChange: (tab: 'form' | 'archer') => void
  archerMessageCount?: number
}

export default function ReviewTabs({
  activeTab,
  onTabChange,
  archerMessageCount = 0,
}: ReviewTabsProps) {
  return (
    <div className="flex border-b border-border-default bg-surface">
      <button
        onClick={() => onTabChange('form')}
        className={`relative px-4 py-2 text-xs font-medium transition-colors ${
          activeTab === 'form'
            ? 'text-text-primary'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Review Form
        {activeTab === 'form' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-info" />
        )}
      </button>

      <button
        onClick={() => onTabChange('archer')}
        className={`relative flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
          activeTab === 'archer'
            ? 'text-text-primary'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
        </svg>
        Archer
        {archerMessageCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-info/20 px-1 text-[10px] font-medium text-info">
            {archerMessageCount}
          </span>
        )}
        {activeTab === 'archer' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-info" />
        )}
      </button>
    </div>
  )
}
