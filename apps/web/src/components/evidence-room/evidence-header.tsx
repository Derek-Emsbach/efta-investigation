import Link from 'next/link'

export function EvidenceHeader() {
  return (
    <header className="sticky top-0 z-40 h-12 border-b border-border-default bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
            The Epstein Crimes
          </Link>
          <span className="text-border-default">/</span>
          <Link href="/evidence" className="font-mono text-sm font-bold tracking-wider text-critical">
            EVIDENCE ROOM
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] tracking-wider text-text-muted">
            {/* Mode switch bar handles navigation */}
          </span>
        </div>
      </div>
    </header>
  )
}
