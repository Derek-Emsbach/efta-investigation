import Link from 'next/link'

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-default px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="font-display text-sm font-semibold text-text-primary hover:text-info transition-colors"
          >
            The Epstein Crimes
          </Link>
          <nav className="flex gap-4 text-xs text-text-muted">
            <Link href="/about" className="hover:text-text-secondary transition-colors">About</Link>
            <Link href="/disclaimer" className="hover:text-text-secondary transition-colors">Disclaimer</Link>
            <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
