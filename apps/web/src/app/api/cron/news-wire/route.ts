import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NEWS_ALLOWED_DOMAINS, NEWS_CATEGORIES, hostAllowed, sourceNameFor, type NewsCategory } from '@/lib/news/sources'

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

Your job: find genuinely NEW, significant news from the lookback window given in the user message about the Epstein case and write short, strictly neutral wire items that link out to the original reporting.

IN SCOPE: DOJ/EFTA document releases and redaction disputes; court rulings, filings, unsealings, and docket activity (e.g. SDNY 19-cr-490, Giuffre v. Maxwell 15-cv-7433, estate/bank litigation); Congressional oversight actions (subpoenas, hearings, letters, votes); Ghislaine Maxwell legal/custody developments; official investigations, resignations, or institutional actions explicitly tied to Epstein; significant investigative reporting from major outlets.

OUT OF SCOPE — skip entirely: opinion/editorial/analysis-only columns, celebrity gossip, social-media rumor, conspiracy content, re-hashes of old news with no new development, anything older than the lookback window.

WRITING RULES (non-negotiable — this content publishes automatically with no human review):
1. Attribute everything. The summary must name the outlet ("Reuters reports...", "According to court filings reported by AP..."). Never state a contested fact in your own voice.
2. Restate ONLY what the linked article says. Add no context, inference, or characterization of your own.
3. Use the outlet's legal precision: "alleged", "accused", "charged", "named in documents", "denies". Never imply guilt beyond what the source states. If a person named has denied wrongdoing and the article says so, include the denial.
4. Never name or identify a victim/survivor unless they are publicly self-identified AND named in the article.
5. The headline and summary may contain ONLY facts stated in the specific article at source_url. Do not merge in facts from other articles (e.g. a later resignation) — if you want to report that, pick the article that reports it.
6. Headline: factual, max ~110 characters, no clickbait, no ALL CAPS, no exclamation points.
7. Summary: 1–2 sentences, 40–320 characters.
8. If the same development is covered by several outlets, include it ONCE, preferring AP or Reuters, then court/government primary sources.
9. Quality over quantity. Returning zero items on a slow day is correct.

ACCEPTED SOURCES: only items whose URL is on one of these domains will be published; anything else is discarded, so don't waste picks on other sites: ${NEWS_ALLOWED_DOMAINS.join(', ')}.

OUTPUT: Keep any reasoning brief. End your reply with the final JSON array wrapped in <items></items> tags, e.g. <items>[...]</items>, or <items>[]</items> if nothing qualifies. Only the LAST <items> block is read. Max ${MAX_ITEMS_PER_RUN} items. Each item:
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

/**
 * Host-insensitive match key: models often rewrite edition.cnn.com → www.cnn.com
 * or drop "amp."/"m." prefixes. Same site + same path = same article.
 */
function matchKey(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^(www|edition|amp|m|mobile|news)\./, '')
    return `${host}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}

function parseCandidates(text: string): unknown[] {
  const tryParse = (chunk: string): unknown[] | null => {
    try {
      const v: unknown = JSON.parse(chunk.trim())
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }
  // 1. Preferred: the LAST <items>…</items> block (the model reasons in prose first).
  const tagged = [...text.matchAll(/<items>([\s\S]*?)<\/items>/g)]
  if (tagged.length > 0) {
    const parsed = tryParse(tagged[tagged.length - 1][1])
    if (parsed) return parsed
  }
  // 2. Last fenced ```json block.
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)]
  for (let i = fenced.length - 1; i >= 0; i--) {
    const parsed = tryParse(fenced[i][1])
    if (parsed && parsed.length > 0) return parsed
  }
  // 3. Fallback: walk "[" positions from the end, closing at the last "]".
  const close = text.lastIndexOf(']')
  for (let i = text.lastIndexOf('[', close); i >= 0; i = text.lastIndexOf('[', i - 1)) {
    const parsed = tryParse(text.slice(i, close + 1))
    if (parsed && parsed.length > 0) return parsed
  }
  return []
}

function validate(raw: unknown, seenInSearch: Set<string>, maxAgeDays: number): { ok: Candidate } | { reject: string } {
  if (!isRecord(raw)) return { reject: 'not an object' }
  const { headline, summary, source_name, source_url, published_at, category } = raw
  if (typeof headline !== 'string' || headline.length < 10 || headline.length > 220) return { reject: 'bad headline' }
  if (typeof summary !== 'string' || summary.length < 20 || summary.length > 600) return { reject: 'bad summary' }
  if (typeof source_name !== 'string' || source_name.length < 2) return { reject: 'bad source_name' }
  if (typeof source_url !== 'string' || !/^https:\/\//.test(source_url)) return { reject: 'bad url' }
  if (!hostAllowed(source_url)) return { reject: `domain not allowlisted: ${source_url}` }
  const norm = normalizeUrl(source_url)
  if (!seenInSearch.has(matchKey(norm))) return { reject: `url not in search results (possible fabrication): ${source_url}` }
  if (/!/.test(headline) || headline === headline.toUpperCase()) return { reject: 'sensational headline' }
  const cat: NewsCategory = NEWS_CATEGORIES.includes(category as NewsCategory) ? (category as NewsCategory) : 'news'
  let pub: string | null = null
  if (typeof published_at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(published_at)) {
    const d = new Date(published_at)
    if (!Number.isNaN(d.getTime())) {
      // Reject anything older than the window (+1 day slack for timezones).
      if (Date.now() - d.getTime() > (maxAgeDays + 1) * 24 * 3600 * 1000) return { reject: `stale: ${source_url}` }
      pub = d.toISOString()
    }
  }
  return {
    ok: {
      headline: headline.trim(),
      summary: summary.trim(),
      // Attribution comes from the URL, not the model (see sourceNameFor).
      source_name: sourceNameFor(norm),
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

  const params = new URL(request.url).searchParams
  const dryRun = params.get('dry') === '1'
  // Lookback window. Daily cron uses the default; ?days=7 is for seeding / catching up.
  const days = Math.min(Math.max(Number(params.get('days')) || 3, 1), 14)

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
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const anthropic = new Anthropic()

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Today is ${today}. Search for Epstein case news from the last ${days} days Generic queries return old explainer pages, so search like a news desk: include the current month and year (e.g. "Epstein ${monthYear}") and event words. Run at least 6 varied queries, e.g. "Epstein resigns ${monthYear}", "Epstein ruling judge ${monthYear}", "Epstein files Congress subpoena ${monthYear}", "Maxwell ${monthYear}", "Epstein lawsuit bank estate ${monthYear}", "Epstein DOJ release ${monthYear}". Check each result's date; ignore anything outside the window.

Already on the wire — do NOT repeat these developments even from a different outlet:
${recentHeadlines}

Finish with the <items>[...]</items> block.`,
    },
  ]

  const seenInSearch = new Set<string>()
  let finalText = ''
  let stopReason: string | null = null

  try {
    // Server tools can return stop_reason "pause_turn"; continue up to 3 times.
    for (let turn = 0; turn < 4; turn++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 12,
            // NOTE: no allowed_domains here. The API rejects the whole request if any
            // listed domain blocks Anthropic's crawler (AP, Reuters, NYT, etc. do), and
            // that list changes over time. The allowlist is enforced in code instead
            // (validate() → hostAllowed), which is the real safety gate anyway.
          },
        ],
      })

      for (const block of res.content) {
        if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content) seenInSearch.add(matchKey(normalizeUrl(r.url)))
        }
        if (block.type === 'text') finalText += block.text
      }

      stopReason = res.stop_reason
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
    const v = validate(raw, seenInSearch, days)
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
    const searchedDomains = [...new Set([...seenInSearch].map((k) => k.split('/')[0]))]
    return NextResponse.json({
      dryRun: true,
      days,
      accepted,
      rejected,
      searchedUrls: seenInSearch.size,
      searchedDomains,
      stopReason,
      modelOutput: finalText.slice(-2500),
    })
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
