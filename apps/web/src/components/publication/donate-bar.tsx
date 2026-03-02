import Link from 'next/link'

interface DonateBarProps {
  variant: 'top' | 'bottom'
}

export function DonateBar({ variant }: DonateBarProps) {
  if (variant === 'top') {
    return (
      <div data-component="donate-bar" className="bg-ink text-background">
        <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-between">
          <p className="font-sans text-[11px] tracking-[0.04em] text-background/80">
            This investigation is free and open to everyone.
          </p>
          <Link
            href="/support"
            className="shrink-0 font-sans text-[11px] font-bold uppercase tracking-[0.1em] bg-accent-gold text-ink px-4 py-1.5 hover:bg-accent-gold/90 transition-colors"
          >
            Support This Work
          </Link>
        </div>
      </div>
    )
  }

  return (
    <section data-component="donate-bar" className="border-t border-border-default bg-elevated/30">
      <div className="mx-auto max-w-7xl px-6 py-10 text-center">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-3">
          Support Independent Investigation
        </p>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
          Help Us Analyze More Documents
        </h2>
        <p className="font-body text-sm text-text-secondary max-w-lg mx-auto mb-6 leading-relaxed">
          This platform is completely free. No paywalls. No tiers. Every document, every story,
          every entity profile is accessible to everyone. Your donations keep the investigation going.
        </p>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.08em] bg-accent-gold text-ink px-8 py-3 hover:bg-accent-gold/90 transition-colors"
        >
          Donate / Support
        </Link>
      </div>
    </section>
  )
}
