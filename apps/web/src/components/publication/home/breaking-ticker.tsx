'use client'

import Link from 'next/link'

const TICKER_ITEMS: { text: string; href: string }[] = [
  {
    text: 'Deutsche Bank flagged Epstein transactions 150+ times — exposed in "Normal for This Client"',
    href: '/stories/normal-for-this-client',
  },
  {
    text: 'Lesley Groff identified as Epstein\'s primary scheduler for 18 years — charging analysis entirely redacted',
    href: '/stories/the-scheduler',
  },
  {
    text: 'Bill Richardson\'s Zorro Ranch connections confirmed through pilot testimony and campaign finance records',
    href: '/stories/the-governors-ranch',
  },
  {
    text: 'Cape Town 2002: Clinton, Spacey, and Tucker present during victim recruitment — identities resolved from corpus',
    href: '/stories/the-recruitment-trip',
  },
  {
    text: 'Evidence against Leon Black: $158M in payments, forensic journals, multiple victims — AUSA wrote nothing up',
    href: '/stories/the-billion-dollar-blind-eye',
  },
  {
    text: 'NPA blanket immunity shielded 4 named co-conspirators from prosecution — exposed in "The Four Names"',
    href: '/stories/the-four-names',
  },
  {
    text: '30+ shell companies controlled by 5-person signer pool — $577M estate mapped in "The Architecture of Opacity"',
    href: '/stories/the-architecture-of-opacity',
  },
  {
    text: '17 investigative stories published — 233 citations sourced to primary EFTA documents',
    href: '/stories',
  },
]

export function LatestFindingsTicker() {
  return (
    <div className="relative overflow-hidden bg-accent-red text-white" style={{ padding: '10px 0' }}>
      {/* "Latest Findings" label — fixed left */}
      <div
        className="absolute left-0 top-0 bottom-0 z-[2] flex items-center gap-2 px-2 sm:px-4"
        style={{ background: 'var(--color-accent-red-dark, #9b1830)' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        <span className="hidden sm:inline font-sans text-[11px] font-bold uppercase tracking-[0.15em]">
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
        className="flex animate-ticker-scroll pl-12 sm:pl-[180px]"
      >
        {/* Render items twice for seamless loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="whitespace-nowrap font-sans text-[13px] font-medium text-white hover:text-white/80 transition-colors"
            style={{ padding: '0 40px' }}
          >
            <span className="mr-3 text-[8px] opacity-60">◆</span>
            {item.text}
          </Link>
        ))}
      </div>
    </div>
  )
}
