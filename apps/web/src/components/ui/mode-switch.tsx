'use client'

import Link from 'next/link'

type Mode = 'newsroom' | 'evidence'

export function ModeSwitch({ mode }: { mode: Mode }) {
  return (
    <div className="bg-ink">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-center gap-1 py-1">
          <Link
            href="/"
            className={`
              flex items-center gap-2 px-4 py-1 text-[10px] font-sans font-bold tracking-[0.14em] uppercase transition-all duration-200
              ${mode === 'newsroom'
                ? 'bg-accent-gold text-ink'
                : 'text-background/40 hover:text-background/70'
              }
            `}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
            The Newsroom
          </Link>
          <Link
            href="/evidence"
            className={`
              flex items-center gap-2 px-4 py-1 text-[10px] font-sans font-bold tracking-[0.14em] uppercase transition-all duration-200
              ${mode === 'evidence'
                ? 'bg-[#e63950] text-white'
                : 'text-background/40 hover:text-background/70'
              }
            `}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            The Evidence Room
          </Link>
        </div>
      </div>
    </div>
  )
}
