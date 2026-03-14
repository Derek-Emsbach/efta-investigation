/** A single page-level hit from the FTS5 corpus search */
export interface CorpusSearchHit {
  efta_number: string
  page_number: number
  snippet: string
  dataset: number | null
}

/** Supabase enrichment data for a corpus document */
export interface CorpusEnrichment {
  title: string | null
  document_type: string | null
  severity: string | null
  original_date: string | null
  page_count: number | null
  entities: string[]
}

/** Response from /api/public/evidence/corpus-search */
export interface CorpusSearchResponse {
  results: CorpusSearchHit[]
  enrichment: Record<string, CorpusEnrichment>
  query: string
  total: number
  offset: number
  limit: number
}
