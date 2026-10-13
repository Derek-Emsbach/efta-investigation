/**
 * Outlets the News Wire is allowed to cite. Anything outside this list is dropped,
 * even if the model returns it. Keep this to outlets with real editorial standards
 * and primary-source government/court sites — this is our defamation firewall.
 */
export const NEWS_ALLOWED_DOMAINS = [
  'apnews.com',
  'reuters.com',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'bloomberg.com',
  'npr.org',
  'pbs.org',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'cnn.com',
  'nbcnews.com',
  'abcnews.go.com',
  'cbsnews.com',
  'politico.com',
  'axios.com',
  'thehill.com',
  'miamiherald.com',
  'propublica.org',
  'latimes.com',
  'usatoday.com',
  'ft.com',
  'courtlistener.com',
  'justice.gov',
  'house.gov',
  'senate.gov',
] as const

export function hostAllowed(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return false
  }
  return NEWS_ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
}

export const NEWS_CATEGORIES = ['news', 'court', 'congress', 'doj-release', 'investigation'] as const
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

export interface NewsItem {
  id: string
  headline: string
  summary: string
  source_name: string
  source_url: string
  published_at: string | null
  category: NewsCategory
  is_pinned: boolean
  related_story_slug: string | null
}
