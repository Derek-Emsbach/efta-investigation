import Database from 'better-sqlite3'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// SQLite corpus database — lazy-init singleton (read-only)
// ---------------------------------------------------------------------------

let _corpus: Database.Database | null = null
let _initAttempted = false

function corpusDbPath(): string {
  return (
    process.env.CORPUS_DB_PATH ||
    join(process.cwd(), '../../services/efta-mcp-server/data/full_text_corpus.db')
  )
}

export function getCorpusDb(): Database.Database | null {
  if (_initAttempted) return _corpus
  _initAttempted = true

  try {
    const db = new Database(corpusDbPath(), { readonly: true, fileMustExist: true })
    db.pragma('journal_mode = OFF')
    db.pragma('query_only = ON')
    _corpus = db
  } catch {
    console.error(
      `⚠️  Corpus DB not found at ${corpusDbPath()}. Corpus search will be unavailable.`
    )
    console.error('   Run: cd services/efta-mcp-server/data && ./download.sh')
  }

  return _corpus
}

// ---------------------------------------------------------------------------
// EFTA number utilities (mirrored from MCP server corpus.ts)
// ---------------------------------------------------------------------------

export const DATASET_RANGES: Array<{ ds: number; min: number; max: number }> = [
  { ds: 1, min: 1, max: 4521 },
  { ds: 2, min: 4522, max: 5586 },
  { ds: 3, min: 5705, max: 69044 },
  { ds: 4, min: 69045, max: 90321 },
  { ds: 5, min: 90322, max: 96905 },
  { ds: 6, min: 96906, max: 107252 },
  { ds: 7, min: 107253, max: 117395 },
  { ds: 8, min: 117396, max: 176563 },
  { ds: 9, min: 176564, max: 1243099 },
  { ds: 10, min: 1243100, max: 1524192 },
  { ds: 11, min: 1524193, max: 2640992 },
  { ds: 12, min: 2640993, max: 2858497 },
]

export function normalizeEfta(input: string): string {
  const stripped = input.replace(/^EFTA/i, '')
  const padded = stripped.padStart(8, '0')
  return `EFTA${padded}`
}

export function datasetFromEftaNumber(num: number): number | null {
  for (const r of DATASET_RANGES) {
    if (num >= r.min && num <= r.max) return r.ds
  }
  return null
}

export function numericEfta(efta: string): number {
  return parseInt(efta.replace(/^EFTA/i, ''), 10)
}

export function dojPdfUrl(efta: string): string {
  const padded = normalizeEfta(efta).replace(/^EFTA/, '')
  const num = parseInt(padded, 10)
  const ds = datasetFromEftaNumber(num)
  return `https://www.justice.gov/epstein/files/DataSet%20${ds}/EFTA${padded}.pdf`
}
