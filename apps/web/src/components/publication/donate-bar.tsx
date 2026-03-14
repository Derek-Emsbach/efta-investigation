import Link from 'next/link'

// TODO: Replace with your actual Ko-fi username once created
const KOFI_USERNAME = 'theepsteincrimes'
const KOFI_URL = `https://ko-fi.com/${KOFI_USERNAME}`

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
          <div className="flex items-center gap-3">
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-sans text-[11px] font-bold uppercase tracking-[0.1em] bg-accent-gold text-ink px-4 py-1.5 hover:bg-accent-gold/90 transition-colors"
            >
              Donate on Ko-fi
            </a>
            <Link
              href="/support"
              className="shrink-0 font-sans text-[11px] tracking-[0.04em] text-background/60 hover:text-background/90 transition-colors"
            >
              Learn more
            </Link>
          </div>
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
        <div className="flex items-center justify-center gap-4">
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.08em] bg-accent-gold text-ink px-8 py-3 hover:bg-accent-gold/90 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
            </svg>
            Donate on Ko-fi
          </a>
          <Link
            href="/support"
            className="font-sans text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Learn more
          </Link>
        </div>
      </div>
    </section>
  )
}
