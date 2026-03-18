/**
 * Proxy helper for remote corpus API calls.
 * Used by public API routes when local SQLite is unavailable (Vercel production).
 */

const CORPUS_API_URL = process.env.CORPUS_API_URL
const CORPUS_API_KEY = process.env.CORPUS_API_KEY

export function isCorpusApiConfigured(): boolean {
  return !!CORPUS_API_URL
}

export async function corpusApiFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  if (!CORPUS_API_URL) {
    throw new Error('CORPUS_API_URL not configured')
  }

  const url = new URL(path, CORPUS_API_URL)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }

  const headers: Record<string, string> = {}
  if (CORPUS_API_KEY) {
    headers['X-Api-Key'] = CORPUS_API_KEY
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Corpus API returned ${res.status}`)
  }

  return res.json() as Promise<T>
}
