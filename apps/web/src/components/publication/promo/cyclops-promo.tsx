'use client'

interface CyclopsPromoProps {
  variant: 'inline' | 'sidebar' | 'footer-banner'
}

export function CyclopsPromo({ variant }: CyclopsPromoProps) {
  if (variant === 'footer-banner') {
    return (
      <div data-component="cyclops-promo" className="border-t border-border-default bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CyclopsLogoMark className="w-8 h-8 text-accent-gold shrink-0" />
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.1em] text-text-primary">
                Built by Cyclops Digital
              </p>
              <p className="font-body text-xs text-text-secondary mt-0.5">
                Custom platforms, AI tools &amp; data-driven applications.
              </p>
            </div>
          </div>
          <a
            href="https://cyclops-digital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-sans text-[11px] font-bold uppercase tracking-[0.1em] bg-accent-gold text-ink px-5 py-2 hover:bg-accent-gold/90 transition-colors"
          >
            Free Quote &rarr;
          </a>
        </div>
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div
        data-component="cyclops-promo"
        className="relative overflow-hidden border border-accent-gold/30 bg-surface p-5 animate-border-glow"
      >
        {/* Shimmer overlay */}
        <div
          className="pointer-events-none absolute inset-0 animate-gold-shimmer"
          style={{
            background:
              'linear-gradient(90deg, transparent 25%, rgba(184,134,11,0.06) 50%, transparent 75%)',
            backgroundSize: '200% 100%',
          }}
        />

        <div className="relative space-y-3">
          <CyclopsLogoMark className="w-7 h-7 text-accent-gold" />

          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-accent-gold">
            Built by
          </p>
          <p className="font-display text-base font-bold text-text-primary leading-tight">
            Cyclops Digital
          </p>

          <p className="font-body text-xs text-text-secondary leading-relaxed">
            Get help building custom solutions for your business or projects.
          </p>

          <a
            href="https://cyclops-digital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-sans text-[10px] font-bold uppercase tracking-[0.1em] bg-accent-gold text-ink px-4 py-2 hover:bg-accent-gold/90 transition-colors"
          >
            Free Quote &rarr;
          </a>
        </div>
      </div>
    )
  }

  // variant === 'inline'
  return (
    <section
      data-component="cyclops-promo"
      className="relative overflow-hidden border-y border-accent-gold/20 bg-surface"
    >
      {/* Shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 animate-gold-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent 25%, rgba(184,134,11,0.05) 50%, transparent 75%)',
          backgroundSize: '200% 100%',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
        {/* Logo + branding */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="animate-border-glow rounded-full p-3 border border-accent-gold/30">
            <CyclopsLogoMark className="w-10 h-10 text-accent-gold" />
          </div>
          <div className="hidden md:block">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-gold">
              Built by
            </p>
            <p className="font-display text-xl font-bold text-text-primary">
              Cyclops Digital
            </p>
          </div>
        </div>

        {/* Copy */}
        <div className="flex-1 text-center md:text-left">
          <p className="md:hidden font-display text-lg font-bold text-text-primary mb-1">
            Cyclops Digital
          </p>
          <p className="font-body text-sm text-text-secondary leading-relaxed max-w-md">
            Get help building custom platforms, AI-powered tools, and data-driven
            applications for your business or projects.
          </p>
        </div>

        {/* CTA */}
        <a
          href="https://cyclops-digital.com"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-sans text-xs font-bold uppercase tracking-[0.1em] bg-accent-gold text-ink px-7 py-3 hover:bg-accent-gold/90 transition-colors animate-subtle-pulse"
        >
          Free Quote &rarr;
        </a>
      </div>
    </section>
  )
}

/**
 * Minimal cyclops eye logo mark (SVG).
 * Placeholder until the user provides their Canva-exported logo.
 */
function CyclopsLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cyclops Digital"
    >
      {/* Outer eye shape */}
      <ellipse
        cx="20"
        cy="20"
        rx="18"
        ry="12"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Iris */}
      <circle
        cx="20"
        cy="20"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Pupil */}
      <circle cx="20" cy="20" r="3.5" fill="currentColor" />
      {/* Highlight */}
      <circle cx="22" cy="18" r="1.5" fill="var(--color-surface, #ffffff)" opacity="0.8" />
    </svg>
  )
}
