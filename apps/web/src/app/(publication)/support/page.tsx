import type { Metadata } from 'next'
import Link from 'next/link'

// TODO: Replace with your actual Ko-fi username once created
const KOFI_USERNAME = 'theepsteincrimes'
const KOFI_URL = `https://ko-fi.com/${KOFI_USERNAME}`

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

      {/* Donate via Ko-fi */}
      <section className="mb-14">
        <div className="border border-accent-gold/30 bg-accent-gold/5 p-8 text-center">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-4">
            Donate Securely via Ko-fi
          </p>
          <p className="font-body text-sm text-text-secondary leading-relaxed max-w-md mx-auto mb-6">
            Ko-fi charges no platform fees. 100% of your donation goes directly
            to funding this investigation. One-time or monthly — every amount helps.
          </p>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 font-sans text-sm font-bold uppercase tracking-[0.08em] bg-accent-gold text-ink px-8 py-3.5 hover:bg-accent-gold/90 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
            </svg>
            Support on Ko-fi
          </a>
        </div>

        {/* Additional ways */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-border-default p-5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-primary mb-2">
              Share the Investigation
            </h3>
            <p className="font-body text-sm text-text-secondary leading-relaxed">
              Sharing stories and entity profiles with journalists, researchers, and
              on social media amplifies the investigation at no cost.
            </p>
          </div>
          <div className="border border-border-default p-5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-primary mb-2">
              Contribute Research
            </h3>
            <p className="font-body text-sm text-text-secondary leading-relaxed">
              If you have expertise in financial forensics, legal analysis, or
              document review, your skills are as valuable as any donation.
            </p>
          </div>
        </div>
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
