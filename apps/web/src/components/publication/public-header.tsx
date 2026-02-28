'use client'

import { useState } from 'react'
import Link from 'next/link'

const SECTION_NAV = [
  { label: 'Home', href: '/' },
  { label: 'The Network', href: '/network' },
  { label: 'Follow the Money', href: '/stories?section=follow-the-money' },
  { label: 'The Cover-Up', href: '/stories?section=the-cover-up' },
  { label: 'The Operation', href: '/stories?section=the-operation' },
  { label: 'Voices', href: '/stories?section=voices' },
  { label: 'The Case Files', href: '/case-files' },
  { label: 'Evidence Room', href: '/evidence' },
]

const UTILITY_NAV = [
  { label: 'About This Investigation', href: '/about' },
  { label: 'Methodology', href: '/about' },
  { label: 'Evidence Room', href: '/evidence' },
]

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Top bar — dark strip */}
      <div className="hidden md:block bg-ink text-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-1.5 font-sans text-[11px] tracking-[0.05em] uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-red opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-red" />
              </span>
              <span>Investigation Active</span>
            </div>
            <div className="flex items-center gap-5">
              {UTILITY_NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="font-sans text-[11px] tracking-[0.05em] uppercase text-background/70 hover:text-background transition-opacity"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main navigation — sticky */}
      <nav className="sticky top-0 z-40 border-t border-b border-border-default bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between md:justify-center h-11">
            {/* Desktop: centered section links with dividers */}
            <div className="hidden md:flex items-stretch overflow-x-auto scrollbar-hide">
              {SECTION_NAV.map((item, i) => (
                <div key={item.label} className="flex items-stretch">
                  {i > 0 && (
                    <div className="w-px bg-border-default my-2" />
                  )}
                  <Link
                    href={item.href}
                    className="relative font-sans text-[12px] font-semibold tracking-[0.08em] uppercase text-text-secondary hover:text-text-primary whitespace-nowrap px-4 py-3 transition-colors group"
                  >
                    {item.label}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-accent-red transition-all duration-300 group-hover:w-full" />
                  </Link>
                </div>
              ))}
            </div>

            {/* Mobile: site name + hamburger */}
            <Link href="/" className="md:hidden font-display text-lg font-bold text-text-primary">
              The Epstein Record
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M16 4L4 16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 5h14M3 10h14M3 15h14" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-border-default bg-background">
            <div className="mx-auto max-w-7xl px-6 py-3 flex flex-col gap-1">
              {SECTION_NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-2 font-sans text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-border-default mt-2 pt-2">
                {UTILITY_NAV.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 font-sans text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
