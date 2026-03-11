'use client'

import Image from 'next/image'
import { useRef, useEffect, useState } from 'react'

interface CyclopsPromoProps {
  variant: 'inline' | 'sidebar' | 'footer-banner'
}

/** Detects whether the component lives inside a dark theme (evidence-room or dashboard). */
function useIsDarkTheme() {
  const ref = useRef<HTMLSpanElement>(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const el = ref.current?.closest('[data-theme]')
    const theme = el?.getAttribute('data-theme')
    setIsDark(theme === 'evidence-room' || !theme)
  }, [])

  return { ref, isDark }
}

function CyclopsHorizontalLogo({ height, className }: { height: number; className?: string }) {
  const { ref, isDark } = useIsDarkTheme()
  const src = isDark
    ? '/images/cyclops-digital/CyclopsDigitalHorizontalLight.svg'
    : '/images/cyclops-digital/CyclopsDigitalHorizontalDark.svg'

  return (
    <span ref={ref} className={className}>
      <Image
        src={src}
        alt="Cyclops Digital"
        width={height * 3.5}
        height={height}
        className="h-auto"
        style={{ height, width: 'auto' }}
      />
    </span>
  )
}

function CyclopsVerticalLogo({ height, className }: { height: number; className?: string }) {
  const { ref, isDark } = useIsDarkTheme()
  const src = isDark
    ? '/images/cyclops-digital/CyclopsDigitalVerticalLight.svg'
    : '/images/cyclops-digital/CyclopsDigitalVerticalDark.svg'

  return (
    <span ref={ref} className={className}>
      <Image
        src={src}
        alt="Cyclops Digital"
        width={height * 0.8}
        height={height}
        className="h-auto"
        style={{ height, width: 'auto' }}
      />
    </span>
  )
}

function CyclopsIconLogo({ size, className }: { size: number; className?: string }) {
  return (
    <Image
      src="/images/cyclops-digital/CyclopsDigitalLogoOnly.svg"
      alt="Cyclops Digital"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}

export function CyclopsPromo({ variant }: CyclopsPromoProps) {
  if (variant === 'footer-banner') {
    return (
      <div data-component="cyclops-promo" className="border-t border-border-default bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <CyclopsHorizontalLogo height={32} className="shrink-0" />
            <p className="font-body text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">Custom platforms, AI tools &amp; data-driven apps.</span>{' '}
              Let&apos;s build something powerful together.
            </p>
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
          <CyclopsVerticalLogo height={100} />

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
            <CyclopsIconLogo size={40} />
          </div>
          <div className="hidden md:block">
            <CyclopsHorizontalLogo height={36} />
          </div>
        </div>

        {/* Mobile: show horizontal logo */}
        <div className="md:hidden">
          <CyclopsHorizontalLogo height={28} />
        </div>

        {/* Copy */}
        <div className="flex-1 text-center md:text-left">
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
