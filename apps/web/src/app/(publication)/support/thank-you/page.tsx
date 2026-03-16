import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Thank You — The Epstein Crimes',
  robots: { index: false },
}

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <div className="border border-accent-gold/30 bg-accent-gold/5 p-10">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-4">
          Thank You
        </p>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">
          Your support makes a difference
        </h1>
        <p className="font-body text-text-secondary leading-relaxed mb-8">
          Your account has been upgraded. The investigation continues because of
          people like you. Every document analyzed, every connection mapped, every
          story published — you made it possible.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/account"
            className="font-sans text-sm font-bold uppercase tracking-[0.08em] bg-accent-gold text-ink px-6 py-3 hover:bg-accent-gold/90 transition-colors"
          >
            View Your Account
          </Link>
          <Link
            href="/"
            className="font-sans text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
