import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { NewsWire } from '@/components/publication/home/news-wire'
import { NewsletterSignup } from '@/components/publication/newsletter-signup'
import type { NewsItem } from '@/lib/news/sources'

export const metadata: Metadata = {
  title: 'News Wire — The Epstein Crimes',
  description:
    'Daily roundup of new developments in the Epstein case: DOJ releases, court rulings, Congressional action, and major reporting, linked to the original sources.',
  openGraph: {
    title: 'Epstein Files News Wire',
    description: 'Daily roundup of Epstein case developments, linked to original reporting.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=News%20Wire&type=home'],
  },
}

export const revalidate = 600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function NewsPage() {
  const { data } = await supabase
    .from('news_items')
    .select('id, headline, summary, source_name, source_url, published_at, category, is_pinned, related_story_slug, created_at')
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const items = (data ?? []) as (NewsItem & { created_at: string })[]

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-12 pb-6">
        <nav className="mb-8 font-mono text-xs text-text-muted">
          <Link href="/" className="hover:text-text-secondary transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">News Wire</span>
        </nav>
        <p className="font-sans text-[12px] font-semibold tracking-[0.12em] uppercase text-accent-red mb-2">News Wire</p>
        <h1 className="font-display text-4xl font-bold text-text-primary">The latest on the Epstein files</h1>
        <p className="mt-4 font-body text-base text-text-secondary leading-relaxed">
          New developments in the case, collected each day from established news organizations and court and government sources.
          Each item is attributed and links to the original report. These are summaries of outside reporting, not findings of this
          investigation. Our own document-sourced work is in{' '}
          <Link href="/stories" className="underline underline-offset-2 hover:text-text-primary">Stories</Link> and{' '}
          <Link href="/case-files" className="underline underline-offset-2 hover:text-text-primary">Case Files</Link>.
        </p>
        <div className="mt-6 h-[3px] w-16 bg-accent-red" />
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-12">
        {items.length > 0 ? (
          <NewsWire items={items} variant="full" />
        ) : (
          <p className="font-body text-text-secondary py-12">The wire is warming up. Check back soon.</p>
        )}
      </div>

      <NewsletterSignup source="news" />
    </div>
  )
}
