import Link from 'next/link'
import { StripeButton } from '@/components/publication/support/stripe-buttons'

const KOFI_MEMBERSHIP_URL = 'https://ko-fi.com/theepsteincrimes/tiers'

/**
 * Homepage support band. Leads with MONTHLY support — recurring income is what
 * actually pays for hosting, the database, and the daily news job.
 */
export function MonthlySupportBand({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="bg-ink text-background">
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-12 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-3">
            Reader-funded · No paywall · No ads from the people we investigate
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
            This investigation runs on readers.
          </h2>
          <p className="mt-4 font-body text-[17px] leading-relaxed text-background/80 max-w-xl">
            One person built this, reading millions of DOJ pages on nights and weekends. Hosting, the
            document database, and the daily news wire cost money every month. If this site has been useful to you,
            a few dollars a month keeps it online and keeps the documents public.
          </p>
        </div>
        <div className="space-y-3">
          <StripeButton type="supporter_monthly" isAuthenticated={isAuthenticated} />
          <a
            href={KOFI_MEMBERSHIP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center font-sans text-sm font-bold uppercase tracking-[0.08em] border border-background/40 px-8 py-3.5 hover:bg-background/10 transition-colors"
          >
            Become a Ko-fi member
          </a>
          <p className="text-center font-sans text-xs text-background/60">
            Prefer a one-time gift?{' '}
            <Link href="/support" className="underline underline-offset-2 hover:text-background">
              See all the ways to support
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
