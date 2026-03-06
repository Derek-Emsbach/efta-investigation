'use client'

import type { SourceConfig } from './source-configs'

interface SourceAdProps {
  source: SourceConfig
  variant: 'display' | 'sidebar' | 'inline-banner'
}

export function SourceAd({ source, variant }: SourceAdProps) {
  if (variant === 'inline-banner') {
    return (
      <div
        data-component="source-ad"
        className="border-y border-border-default bg-surface"
      >
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center gap-6">
          {/* Logo area */}
          <div className="shrink-0 flex items-center gap-3">
            <SourceBadge source={source} size="lg" />
            <div className="hidden sm:block">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Research Source
              </p>
              <p className="font-display text-lg font-bold text-text-primary">
                {source.name}
              </p>
            </div>
          </div>

          {/* Copy */}
          <div className="flex-1 text-center sm:text-left">
            <p className="sm:hidden font-display text-lg font-bold text-text-primary mb-1">
              {source.name}
            </p>
            <p className="font-display text-base font-semibold text-text-primary leading-snug mb-1">
              {source.tagline}
            </p>
            <p className="font-body text-xs text-text-secondary leading-relaxed max-w-md">
              {source.description}
            </p>
          </div>

          {/* CTA */}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-sans text-xs font-bold uppercase tracking-[0.1em] px-6 py-2.5 border-2 transition-colors"
            style={{
              borderColor: source.accentColor,
              color: source.accentColor,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.backgroundColor = source.accentColor
              el.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.backgroundColor = 'transparent'
              el.style.color = source.accentColor
            }}
          >
            {source.ctaLabel} &rarr;
          </a>
        </div>
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div
        data-component="source-ad"
        className="border border-border-default bg-surface p-4 space-y-3"
        style={{ borderLeftColor: source.accentColor, borderLeftWidth: 3 }}
      >
        <div className="flex items-start justify-between gap-2">
          <SourceBadge source={source} size="md" />
          <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Source
          </span>
        </div>

        <p className="font-display text-sm font-bold text-text-primary leading-snug">
          {source.tagline}
        </p>

        <p className="font-body text-xs text-text-secondary leading-relaxed">
          {source.description}
        </p>

        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-sans text-[10px] font-bold uppercase tracking-[0.1em] px-4 py-1.5 transition-colors"
          style={{
            backgroundColor: source.accentColor,
            color: '#ffffff',
          }}
        >
          {source.ctaLabel} &rarr;
        </a>
      </div>
    )
  }

  // variant === 'display'
  return (
    <div
      data-component="source-ad"
      className="border border-border-default bg-surface p-6 space-y-4"
    >
      <div className="flex items-start justify-between">
        <SourceBadge source={source} size="lg" />
        <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Source
        </span>
      </div>

      <div>
        <p className="font-display text-lg font-bold text-text-primary leading-snug mb-2">
          {source.tagline}
        </p>
        <p className="font-body text-sm text-text-secondary leading-relaxed">
          {source.description}
        </p>
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-[0.08em] px-5 py-2.5 transition-colors"
        style={{
          backgroundColor: source.accentColor,
          color: '#ffffff',
        }}
      >
        {source.ctaLabel}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 8.5l5-5M4 3.5h5v5" />
        </svg>
      </a>

      <p className="font-mono text-[8px] text-text-muted uppercase tracking-[0.15em] pt-1 border-t border-border-default">
        Research Source Attribution
      </p>
    </div>
  )
}

/**
 * Renders the source's logo or a text-based fallback badge.
 */
function SourceBadge({ source, size }: { source: SourceConfig; size: 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'

  if (source.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.logoUrl}
        alt={source.logoAlt ?? source.name}
        className={`${dimensions} object-contain`}
      />
    )
  }

  // Text-based fallback: first letter in a colored square
  const fontSize = size === 'lg' ? 'text-base' : 'text-xs'
  return (
    <div
      className={`${dimensions} flex items-center justify-center font-sans ${fontSize} font-bold text-white shrink-0`}
      style={{ backgroundColor: source.accentColor }}
    >
      {source.shortName.charAt(0).toUpperCase()}
    </div>
  )
}
