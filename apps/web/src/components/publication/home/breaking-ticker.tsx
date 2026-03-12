'use client'

const TICKER_ITEMS = [
  'Lesley Groff identified as Epstein\'s primary scheduler for 18 years — charging analysis entirely redacted',
  'Bill Richardson\'s Zorro Ranch connections confirmed through pilot testimony and campaign finance records',
  'Cape Town 2002: Clinton, Spacey, and Tucker present during victim recruitment — identities resolved from corpus',
  'Evidence against Leon Black: $158M in payments, forensic journals, multiple victims — AUSA wrote nothing up',
  '7 investigative stories published — 103 citations sourced to primary EFTA documents',
  '153,000+ documents analyzed in Lesley Groff corpus sweep across Datasets 9-11',
]

export function LatestFindingsTicker() {
  return (
    <div className="relative overflow-hidden bg-accent-red text-white" style={{ padding: '10px 0' }}>
      {/* "Latest Findings" label — fixed left */}
      <div
        className="absolute left-0 top-0 bottom-0 z-[2] flex items-center gap-2 px-4"
        style={{ background: 'var(--color-accent-red-dark, #9b1830)' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        <span className="font-sans text-[11px] font-bold uppercase tracking-[0.15em]">
          Latest Findings
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
        style={{ paddingLeft: '180px' }}
      >
        {/* Render items twice for seamless loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-sans text-[13px] font-medium"
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
