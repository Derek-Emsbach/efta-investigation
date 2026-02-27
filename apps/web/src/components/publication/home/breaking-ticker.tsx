'use client'

const TICKER_ITEMS = [
  'Dataset 9 analysis reveals unreported DANY-SDNY email chain showing inter-agency coordination failures',
  'New documents show DOJ redacted names of individuals identified in authenticated victim journals',
  'Investigation identifies three processing pipelines used in EFTA document production — forensic implications under review',
]

export function BreakingNewsTicker() {
  return (
    <div className="relative overflow-hidden bg-accent-red text-white" style={{ padding: '10px 0' }}>
      {/* "Breaking" label — fixed left */}
      <div
        className="absolute left-0 top-0 bottom-0 z-[2] flex items-center gap-2 px-4"
        style={{ background: 'var(--color-accent-red-dark, #9b1830)' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        <span className="font-[var(--font-sans)] text-[11px] font-bold uppercase tracking-[0.15em]">
          Breaking
        </span>
        {/* Gradient fade on right edge */}
        <div
          className="absolute right-[-40px] top-0 bottom-0 w-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, var(--color-accent-red-dark, #9b1830), transparent)',
          }}
        />
      </div>

      {/* Scrolling ticker track */}
      <div
        className="flex animate-ticker-scroll"
        style={{ paddingLeft: '140px' }}
      >
        {/* Render items twice for seamless loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-[var(--font-sans)] text-[13px] font-medium"
            style={{ padding: '0 40px' }}
          >
            <span className="mr-3 text-[8px] opacity-60">◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
