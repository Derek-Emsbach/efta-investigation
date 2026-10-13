import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NEWS_ALLOWED_DOMAINS, NEWS_CATEGORIES, hostAllowed, type NewsCategory } from '@/lib/news/sources'

/**
 * GET /api/cron/news-wire
 *
 * Daily autonomous News Wire refresh. Triggered by Vercel Cron (see vercel.json),
 * which sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Pipeline: Claude + server-side web_search (restricted to NEWS_ALLOWED_DOMAINS)
 * → JSON candidates → hard validation (URL must be allowlisted AND must have
 * actually appeared in the search results, i.e. no invented links) → dedupe on
 * source_url → insert into news_items → revalidate.
 *
 * Editorial guardrails live in the prompt AND in code. The site never states an
 * allegation in its own voice here: every item is attributed to the outlet.
 *
 * Manual run: curl -H "Authorization: Bearer $CRON_SECRET" https://theepsteincrimes.com/api/cron/news-wire
 * Dry run (no DB writes): append ?dry=1
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_ITEMS_PER_RUN = 6

const SYSTEM_PROMPT = `You are the wire editor for "The Epstein Crimes", an independent, document-driven investigation site about the Jeffrey Epstein case and the Epstein Files Transparency Act (EFTA) releases.

Your job: find genuinely NEW, significant news from the last 48 hours about the Epstein case and write short, strictly neutral wire items that link out to the original reporting.

IN SCOPE: DOJ/EFTA document releases and redaction disputes; court rulings, filings, unsealings, and docket activity (e.g. SDNY 19-cr-490, Giuffre v. Maxwell 15-cv-7433, estate/bank litigation); Congressional oversight actions (subpoenas, hearings, letters, votes); Ghislaine Maxwell legal/custody developments; official investigations, resignations, or institutional actions explicitly tied to Epstein; significant investigative reporting from major outlets.

OUT OF SCOPE — skip entirely: opinion/editorial/analysis-only columns, celebrity gossip, social-media rumor, conspiracy content, re-hashes of old news with no new development, anything older than ~72 hours.

WRITING RULES (non-negotiable — this content publishes automatically with no human review):
1. Attribute everything. The summary must name the outlet ("Reuters reports...", "According to court filings reported by AP..."). Never state a contested fact in your own voice.
2. Restate ONLY what the linked article says. Add no context, inference, or characterization of your own.
3. Use the outlet's legal precision: "alleged", "accused", "charged", "named in documents", "denies". Never imply guilt beyond what the source states. If a person named has denied wrongdoing and the article says so, include the denial.
4. Never name or identify a victim/survivor unless they are publicly self-identified AND named in the article.
5. Headline: factual, max ~110 characters, no clickbait, no ALL CAPS, no exclamation points.
6. Summary: 1–2 sentences, 40–320 characters.
7. If the same development is covered by several outlets, include it ONCE, preferring AP or Reuters, then court/government primary sources.
8. Quality over quantity. Returning zero items on a slow day is correct.

OUTPUT: After searching, respond with ONLY a JSON array (no prose, no code fences). Max ${MAX_ITEMS_PER_RUN} items. Each item:
{"headline": string, "summary": string, "source_name": string, "source_url": string, "published_at": "YYYY-MM-DD" | null, "category": "news" | "court" | "congress" | "doj-release" | "investigation"}
source_url must be the exact article URL from your search results.`

interface Candidate {
  headline: string
  summary: string
  source_name: string
  source_url: string
  published_at: string | null
  category: NewsCategory
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    // strip tracking params
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'ref' || key === 'smid' || key === 'taid') u.searchParams.delete(key)
    }
    return u.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

function parseCandidates(text: string): unknown[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function validate(raw: unknown, seenInSearch: Set<string>): { ok: Candidate } | { reject: string } {
  if (!isRecord(raw)) return { reject: 'not an object' }
  const { headline, summary, source_name, source_url, published_at, category } = raw
  if (typeof headline !== 'string' || headline.length < 10 || headline.length > 220) return { reject: 'bad headline' }
  if (typeof summary !== 'string' || summary.length < 20 || summary.length > 600) return { reject: 'bad summary' }
  if (typeof source_name !== 'string' || source_name.length < 2) return { reject: 'bad source_name' }
  if (typeof source_url !== 'string' || !/^https:\/\//.test(source_url)) return { reject: 'bad url' }
  if (!hostAllowed(source_url)) return { reject: `domain not allowlisted: ${source_url}` }
  const norm = normalizeUrl(source_url)
  if (!seenInSearch.has(norm)) return { reject: `url not in search results (possible fabrication): ${source_url}` }
  if (/!/.test(headline) || headline === headline.toUpperCase()) return { reject: 'sensational headline' }
  const cat: NewsCategory = NEWS_CATEGORIES.includes(category as NewsCategory) ? (category as NewsCategory) : 'news'
  let pub: string | null = null
  if (typeof published_at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(published_at)) {
    const d = new Date(published_at)
    if (!Number.isNaN(d.getTime())) {
      // Reject anything older than 5 days — the wire is for new developments only.
      if (Date.now() - d.getTime() > 5 * 24 * 3600 * 1000) return { reject: 'stale' }
      pub = d.toISOString()
    }
  }
  return {
    ok: {
      headline: headline.trim(),
      summary: summary.trim(),
      source_name: source_name.trim(),
      source_url: norm,
      published_at: pub,
      category: cat,
    },
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const dryRun = new URL(request.url).searchParams.get('dry') === '1'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  )

  // Recent items → tell the model what we already have, so it skips repeats.
  const { data: recent } = await supabase
    .from('news_items')
    .select('headline, source_url')
    .order('created_at', { ascending: false })
    .limit(40)

  const existingUrls = new Set((recent ?? []).map((r) => normalizeUrl(r.source_url)))
  const recentHeadlines = (recent ?? []).map((r) => `- ${r.headline}`).join('\n') || '(none yet)'

  const today = new Date().toISOString().slice(0, 10)
  const anthropic = new Anthropic()

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Today is ${today}. Search for Epstein case news from the last 48 hours (try several queries: "Epstein files", "Epstein DOJ release", "Maxwell court", "Epstein subpoena Congress", "Epstein estate lawsuit").

Already on the wire — do NOT repeat these developments even from a different outlet:
${recentHeadlines}

Return the JSON array only.`,
    },
  ]

  const seenInSearch = new Set<string>()
  let finalText = ''

  try {
    // Server tools can return stop_reason "pause_turn"; continue up to 3 times.
    for (let turn = 0; turn < 4; turn++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 8,
            allowed_domains: [...NEWS_ALLOWED_DOMAINS],
          },
        ],
      })

      for (const block of res.content) {
        if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content) seenInSearch.add(normalizeUrl(r.url))
        }
        if (block.type === 'text') finalText += block.text
      }

      if (res.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: res.content })
      finalText = ''
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Anthropic request failed'
    console.error('[news-wire] model error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const accepted: Candidate[] = []
  const rejected: string[] = []
  for (const raw of parseCandidates(finalText)) {
    const v = validate(raw, seenInSearch)
    if ('reject' in v) {
      rejected.push(v.reject)
      continue
    }
    if (existingUrls.has(v.ok.source_url) || accepted.some((a) => a.source_url === v.ok.source_url)) {
      rejected.push(`duplicate: ${v.ok.source_url}`)
      continue
    }
    accepted.push(v.ok)
    if (accepted.length >= MAX_ITEMS_PER_RUN) break
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, accepted, rejected, searchedUrls: seenInSearch.size })
  }

  let inserted = 0
  if (accepted.length > 0) {
    const { data, error } = await supabase
      .from('news_items')
      .upsert(
        accepted.map((a) => ({ ...a, created_by: 'news-wire-cron' })),
        { onConflict: 'source_url', ignoreDuplicates: true },
      )
      .select('id')
    if (error) {
      console.error('[news-wire] insert error:', error.message)
      return NextResponse.json({ error: error.message, accepted, rejected }, { status: 500 })
    }
    inserted = data?.length ?? 0
    revalidatePath('/')
    revalidatePath('/news')
  }

  console.log(`[news-wire] inserted=${inserted} rejected=${rejected.length}`)
  return NextResponse.json({ inserted, rejected, searchedUrls: seenInSearch.size })
}
