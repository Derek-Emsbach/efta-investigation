'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SubscriptionTier } from '@efta/shared'
import { getRankAbbreviation } from '@/lib/access-control'

interface AuthState {
  displayName: string | null
  subscriptionTier: SubscriptionTier | null
  rank: string | null
  role: string | null
}

const SECTION_NAV = [
  { label: 'Home', href: '/' },
  { label: 'The Network', href: '/network' },
  { label: 'Follow the Money', href: '/sections/follow-the-money' },
  { label: 'The Cover-Up', href: '/sections/the-cover-up' },
  { label: 'The Operation', href: '/sections/the-operation' },
  { label: 'Trump', href: '/sections/trump' },
  { label: 'Voices', href: '/sections/voices' },
  { label: 'The Case Files', href: '/case-files' },
]

const UTILITY_NAV = [
  { label: 'About This Investigation', href: '/about' },
  { label: 'Methodology', href: '/about' },
  { label: 'Evidence Room', href: '/evidence' },
]

export function PublicHeader({ authState }: { authState: AuthState | null }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Top bar — dark strip */}
      <div className="hidden md:block bg-ink text-background">
        <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
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
              {/* Auth controls */}
              <div className="h-3 w-px bg-background/20" />
              {authState ? (
                <div className="flex items-center gap-3">
                  {authState.role === 'admin' && (
                    <Link
                      href="/dashboard"
                      className="rounded bg-background/10 px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-widest uppercase text-background/90 hover:bg-background/20 transition-colors"
                    >
                      Dashboard
                    </Link>
                  )}
                  {authState.subscriptionTier === 'investigator' && authState.rank && (
                    <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-widest uppercase text-accent-gold">
                      {getRankAbbreviation(authState.rank)}
                    </span>
                  )}
                  <span className="font-sans text-[11px] text-background/80">
                    {authState.displayName ?? 'Account'}
                  </span>
                  <Link
                    href={authState.subscriptionTier === 'investigator' ? '/investigate' : '/account'}
                    className="font-sans text-[11px] tracking-[0.05em] uppercase text-background/70 hover:text-background transition-opacity"
                  >
                    {authState.subscriptionTier === 'investigator' ? 'Workspace' : 'Account'}
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link
                    href="/login"
                    className="font-sans text-[11px] tracking-[0.05em] uppercase text-background/70 hover:text-background transition-opacity"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded bg-accent-red px-2.5 py-1 font-sans text-[11px] font-semibold tracking-[0.05em] uppercase text-white hover:bg-accent-red/90 transition-colors"
                  >
                    Join
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main navigation — sticky */}
      <nav className="sticky top-0 z-40 border-t border-b border-border-default bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6">
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
              The Epstein Crimes
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-3 text-text-secondary hover:text-text-primary transition-colors"
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
                <div className="border-t border-border-default mt-2 pt-2 flex items-center gap-3">
                  {authState ? (
                    <>
                      {authState.role === 'admin' && (
                        <Link
                          href="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="font-sans text-xs font-semibold text-accent-red"
                        >
                          Dashboard
                        </Link>
                      )}
                      <Link
                        href={authState.subscriptionTier === 'investigator' ? '/investigate' : '/account'}
                        onClick={() => setMenuOpen(false)}
                        className="font-sans text-xs font-semibold text-text-primary"
                      >
                        {authState.displayName ?? 'Account'} →
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setMenuOpen(false)}
                        className="font-sans text-xs text-text-secondary hover:text-text-primary transition-colors"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setMenuOpen(false)}
                        className="rounded bg-accent-red px-2.5 py-1 font-sans text-xs font-semibold text-white hover:bg-accent-red/90 transition-colors"
                      >
                        Join →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
