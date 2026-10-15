import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createButtondownDraft } from '@/lib/newsletter/buttondown'

/**
 * GET /api/cron/weekly-briefing — Monday morning (see vercel.json).
 *
 * Builds "The Weekly Briefing" from the past 7 days of News Wire items and
 * published/updated stories, then creates a DRAFT in Buttondown. Nothing is
 * sent: Derek reviews it in Buttondown and presses Send.
 *
 * Deterministic: no AI writes newsletter copy. Every line is either our own
 * already-published headline or a News Wire item that is already attributed and linked.
 *
 * Manual: curl -H "Authorization: Bearer $CRON_SECRET" "https://www.theepsteincrimes.com/api/cron/weekly-briefing?dry=1"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SITE = 'https://www.theepsteincrimes.com'

interface StoryRow { slug: string; title: string; deck: string | null; published_at: string | null; updated_at: string | null }
interface NewsRow { headline: string; summary: string; source_name: string; source_url: string; published_at: string | null; created_at: string }

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Denver' })
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dryRun = new URL(request.url).searchParams.get('dry') === '1'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  )
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [newsRes, newStoriesRes, updatedStoriesRes] = await Promise.all([
    supabase
      .from('news_items')
      .select('headline, summary, source_name, source_url, published_at, created_at')
      .eq('is_published', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('stories')
      .select('slug, title, deck, published_at, updated_at')
      .eq('is_published', true)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(8),
    supabase
      .from('stories')
      .select('slug, title, deck, published_at, updated_at')
      .eq('is_published', true)
      .lt('published_at', since)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const news = (newsRes.data ?? []) as NewsRow[]
  const newStories = (newStoriesRes.data ?? []) as StoryRow[]
  const updatedStories = (updatedStoriesRes.data ?? []) as StoryRow[]

  if (news.length === 0 && newStories.length === 0 && updatedStories.length === 0) {
    return NextResponse.json({ skipped: 'nothing new this week' })
  }

  const today = new Date()
  const weekOf = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' })
  const isoDay = today.toISOString().slice(0, 10)

  const lines: string[] = []
  lines.push(`*The week in the Epstein files: new developments, and what we published.*`)
  lines.push('')

  if (newStories.length > 0) {
    lines.push('## New from our investigation')
    lines.push('')
    for (const s of newStories) {
      lines.push(`**[${s.title}](${SITE}/stories/${s.slug})**  `)
      if (s.deck) lines.push(s.deck)
      lines.push('')
    }
  }

  if (updatedStories.length > 0) {
    lines.push('## Updated with new evidence')
    lines.push('')
    for (const s of updatedStories) lines.push(`- [${s.title}](${SITE}/stories/${s.slug})`)
    lines.push('')
  }

  if (news.length > 0) {
    lines.push('## News Wire')
    lines.push('')
    lines.push('*Outside reporting, summarized and linked. Not findings of this investigation.*')
    lines.push('')
    for (const n of news) {
      lines.push(`**${n.headline}**  `)
      lines.push(`${n.summary} [Read at ${n.source_name} →](${n.source_url}) · ${fmtDate(n.published_at ?? n.created_at)}`)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('**This investigation is reader-funded.** No paywall, no ads from the people we investigate. If this briefing is useful, a few dollars a month keeps the documents public and the site online.')
  lines.push('')
  lines.push(`[Support monthly →](${SITE}/support) · [Ko-fi](https://ko-fi.com/theepsteincrimes) · Forward this to someone who should read it.`)

  const body = lines.join('\n')
  const lead = newStories[0]?.title ?? news[0]?.headline ?? 'This week'
  const subject = `The Weekly Briefing: ${lead}`.slice(0, 140)
  const draft = {
    subject,
    body,
    slug: `weekly-briefing-${isoDay}`,
    description: `The Epstein Crimes weekly briefing, week of ${weekOf}.`,
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, counts: { news: news.length, newStories: newStories.length, updatedStories: updatedStories.length }, ...draft })
  }

  const result = await createButtondownDraft(draft)
  if (!result.ok) {
    console.error('[weekly-briefing] draft failed', result.status, result.error)
    return NextResponse.json({ error: 'Buttondown draft failed', status: result.status, detail: result.error }, { status: 502 })
  }
  return NextResponse.json({ draftCreated: true, id: result.id, subject })
}
