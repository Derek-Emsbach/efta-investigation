'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overview', href: '/investigate', icon: 'overview' },
  { label: 'Notes', href: '/investigate/notes', icon: 'notes' },
  { label: 'Detective', href: '/investigate/detective', icon: 'detective' },
  { label: 'Submit', href: '/investigate/submit', icon: 'submit' },
  { label: 'Ranks', href: '/investigate/ranks', icon: 'ranks' },
] as const

const ICONS: Record<string, React.ReactNode> = {
  overview: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  notes: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  detective: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  submit: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
    </svg>
  ),
  ranks: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
}

export default function InvestigateInnerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === '/investigate') return pathname === '/investigate'
    return pathname.startsWith(href)
  }

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-40 h-12 border-b border-border-default bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              The Epstein Crimes
            </Link>
            <span className="text-border-default">/</span>
            <Link href="/investigate" className="font-mono text-sm font-bold tracking-wider text-critical">
              INVESTIGATOR WORKSPACE
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/evidence"
              className="font-mono text-[10px] tracking-wider text-text-muted hover:text-text-secondary transition-colors"
            >
              EVIDENCE ROOM
            </Link>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="border-b border-border-default bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map((tab) => {
              const active = isActive(tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-mono tracking-wide transition-colors whitespace-nowrap border-b-2
                    ${active
                      ? 'border-critical text-critical'
                      : 'border-transparent text-text-muted hover:text-text-secondary hover:border-border-default'
                    }
                  `}
                >
                  {ICONS[tab.icon]}
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Page content */}
      {children}
    </div>
  )
}
