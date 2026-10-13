import Link from 'next/link'
import type { NewsItem } from '@/lib/news/sources'

const CATEGORY_LABELS: Record<NewsItem['category'], string> = {
  news: 'News',
  court: 'Court',
  congress: 'Congress',
  'doj-release': 'DOJ Release',
  investigation: 'Investigation',
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffH = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  const d = Math.floor(diffH / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface NewsWireProps {
  items: (NewsItem & { created_at?: string })[]
  /** compact = homepage strip; full = /news archive */
  variant?: 'compact' | 'full'
}

export function NewsWire({ items, variant = 'compact' }: NewsWireProps) {
  if (items.length === 0) return null

  return (
    <section aria-labelledby="news-wire-heading" className={variant === 'compact' ? 'py-8 border-b border-border-default' : ''}>
      {variant === 'compact' && (
        <div className="flex items-baseline justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-red opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-red" />
            </span>
            <h2 id="news-wire-heading" className="font-sans text-[12px] font-semibold tracking-[0.12em] uppercase text-accent-red">
              News Wire
            </h2>
            <span className="font-sans text-[11px] text-text-muted">· Updated daily from outside reporting</span>
          </div>
          <Link href="/news" className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary hover:text-text-primary">
            All news &rarr;
          </Link>
        </div>
      )}

      <ol className={variant === 'compact' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6' : 'divide-y divide-border-default'}>
        {items.map((item) => (
          <li key={item.id} className={variant === 'full' ? 'py-6' : ''}>
            <div className="flex items-center gap-2 mb-1.5 font-sans text-[11px] uppercase tracking-[0.08em]">
              <span className="font-semibold text-text-secondary">{CATEGORY_LABELS[item.category]}</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">{timeAgo(item.published_at ?? item.created_at ?? null)}</span>
            </div>
            <h3 className={`font-display font-semibold leading-snug text-text-primary ${variant === 'full' ? 'text-xl' : 'text-[17px]'}`}>
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:underline hover:underline-offset-[3px]"
              >
                {item.headline}
              </a>
            </h3>
            <p className="mt-1.5 font-body text-[15px] leading-relaxed text-text-secondary">{item.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 font-sans text-xs">
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-semibold text-text-primary hover:text-accent-gold"
              >
                Read at {item.source_name} &#8599;
              </a>
              {item.related_story_slug && (
                <Link href={`/stories/${item.related_story_slug}`} className="text-accent-gold hover:underline">
                  Our related investigation &rarr;
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
