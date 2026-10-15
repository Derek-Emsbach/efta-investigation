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
  'abcnews.com',
  'foxnews.com',
  'aljazeera.com',
  'law360.com',
  'bloomberglaw.com',
  'scotusblog.com',
  'cbsnews.com',
  'politico.com',
  'axios.com',
  'thehill.com',
  'miamiherald.com',
  'propublica.org',
  'latimes.com',
  'usatoday.com',
  'usnews.com',
  'cnbc.com',
  'courthousenews.com',
  'ft.com',
  'courtlistener.com',
  'justice.gov',
  'uscourts.gov',
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

/**
 * Display name for the outlet, derived from the URL — NEVER from the model.
 * (The model has labeled a House press release "NPR" and a Reason.com post
 * "Reuters". Attribution must match the link a reader will click.)
 */
const SOURCE_NAMES: Record<string, string> = {
  'apnews.com': 'AP', 'reuters.com': 'Reuters', 'nytimes.com': 'The New York Times',
  'washingtonpost.com': 'The Washington Post', 'wsj.com': 'The Wall Street Journal',
  'bloomberg.com': 'Bloomberg', 'bloomberglaw.com': 'Bloomberg Law', 'npr.org': 'NPR',
  'pbs.org': 'PBS', 'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'theguardian.com': 'The Guardian',
  'cnn.com': 'CNN', 'nbcnews.com': 'NBC News', 'abcnews.go.com': 'ABC News', 'abcnews.com': 'ABC News',
  'cbsnews.com': 'CBS News', 'foxnews.com': 'Fox News', 'aljazeera.com': 'Al Jazeera',
  'politico.com': 'Politico', 'axios.com': 'Axios', 'thehill.com': 'The Hill',
  'miamiherald.com': 'Miami Herald', 'propublica.org': 'ProPublica', 'latimes.com': 'Los Angeles Times',
  'usatoday.com': 'USA Today', 'usnews.com': 'U.S. News & World Report', 'cnbc.com': 'CNBC',
  'courthousenews.com': 'Courthouse News', 'ft.com': 'Financial Times', 'law360.com': 'Law360',
  'scotusblog.com': 'SCOTUSblog', 'courtlistener.com': 'CourtListener (court docket)',
  'justice.gov': 'U.S. Department of Justice', 'uscourts.gov': 'U.S. Courts (court record)',
  'senate.gov': 'U.S. Senate', 'house.gov': 'U.S. House of Representatives',
}

export function sourceNameFor(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'Source'
  }
  const match = Object.keys(SOURCE_NAMES)
    .filter((d) => host === d || host.endsWith(`.${d}`))
    .sort((a, b) => b.length - a.length)[0]
  if (!match) return host
  // Member/committee sites: "dean.house.gov" → "U.S. House (dean.house.gov)" so it reads as an official release.
  if ((match === 'house.gov' || match === 'senate.gov') && host !== match) {
    return `${SOURCE_NAMES[match]} — ${host}`
  }
  return SOURCE_NAMES[match]
}
