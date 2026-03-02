import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Support — The Epstein Crimes',
  description:
    'Support the independent investigation of 1.38 million EFTA documents. Free and open to everyone.',
  openGraph: {
    title: 'Support The Epstein Crimes',
    description:
      'Help fund the independent investigation of EFTA documents. No paywalls, no tiers — completely free.',
    type: 'website',
    siteName: 'The Epstein Crimes',
  },
}

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Breadcrumb */}
      <nav className="mb-10 font-mono text-xs text-text-muted">
        <Link href="/" className="hover:text-text-secondary transition-colors">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Support</span>
      </nav>

      {/* Hero */}
      <header className="text-center mb-14">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-3">
          Support Independent Investigation
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary leading-tight">
          Help Us Hold Power Accountable
        </h1>
        <div className="mt-4 h-[3px] w-16 mx-auto bg-accent-red" />
        <p className="mt-6 font-body text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
          This platform is completely free. No paywalls. No tiers. Every document,
          every story, every entity profile is accessible to everyone. Your contribution
          keeps the investigation going.
        </p>
      </header>

      {/* What your support funds */}
      <section className="mb-14">
        <h2 className="font-display text-2xl font-bold text-text-primary mb-6">
          What Your Support Funds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              label: 'Document Analysis',
              desc: 'Forensic review of 1.38 million DOJ documents. Every claim sourced to specific EFTA Bates numbers.',
            },
            {
              label: 'Infrastructure',
              desc: 'Database hosting, search indexing, and platform maintenance to keep the archive online.',
            },
            {
              label: 'Investigation',
              desc: 'New investigation threads, cross-referencing, entity analysis, and open question tracking.',
            },
            {
              label: 'Open Access',
              desc: 'No paywalls, no advertising, no data harvesting. The evidence stays free.',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-border-default p-5"
            >
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-gold mb-2">
                {item.label}
              </h3>
              <p className="font-body text-sm text-text-secondary leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Donation methods — placeholder */}
      <section className="mb-14 border border-accent-gold/30 bg-accent-gold/5 p-8 text-center">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-3">
          Donation Methods Coming Soon
        </p>
        <p className="font-body text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
          We are setting up secure donation methods. Check back soon for options
          to support this investigation directly.
        </p>
      </section>

      {/* About Cyclops Digital */}
      <section className="border-t border-border-default pt-10">
        <h2 className="font-display text-2xl font-bold text-text-primary mb-4">
          About the Builder
        </h2>
        <p className="font-body text-sm text-text-secondary leading-relaxed mb-4">
          The Epstein Crimes is built and maintained by Cyclops Digital — a digital
          development studio specializing in data-driven investigation platforms,
          full-stack web applications, and AI-powered document analysis.
        </p>
        <a
          href="https://cyclops-digital.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-sans text-sm font-bold text-accent-gold hover:text-accent-gold/80 transition-colors"
        >
          Visit cyclops-digital.com
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 10l6-6M4.5 4H10v5.5" />
          </svg>
        </a>
      </section>
    </div>
  )
}
