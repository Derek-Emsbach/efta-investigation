import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Stories', href: '/stories' },
  { label: 'Entities', href: '/entities' },
  { label: 'Case Files', href: '/case-files' },
  { label: 'Evidence Room', href: '/evidence' },
  { label: 'About', href: '/about' },
]

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-default bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-text-primary">
            The Epstein Record
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
