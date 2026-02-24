import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// SQLite corpus databases — lazy-init singleton (read-only)
// ---------------------------------------------------------------------------

let _corpus: Database.Database | null = null;
let _redaction: Database.Database | null = null;
let _initAttempted = false;

function dataDir(): string {
  return process.env.CORPUS_DATA_DIR || join(__dirname, '../../data');
}

function openReadOnly(filePath: string, label: string): Database.Database | null {
  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    db.pragma('journal_mode = OFF');
    db.pragma('query_only = ON');
    console.error(`✅ ${label} loaded (${filePath})`);
    return db;
  } catch {
    console.error(`⚠️  ${label} not found at ${filePath}`);
    console.error('   Run: cd services/efta-mcp-server/data && ./download.sh');
    return null;
  }
}

function initDatabases(): void {
  if (_initAttempted) return;
  _initAttempted = true;

  const dir = dataDir();
  _corpus = openReadOnly(join(dir, 'full_text_corpus.db'), 'Full text corpus');
  _redaction = openReadOnly(join(dir, 'redaction_analysis_v2.db'), 'Redaction analysis');
}

export function getCorpusDb(): Database.Database | null {
  initDatabases();
  return _corpus;
}

export function getRedactionDb(): Database.Database | null {
  initDatabases();
  return _redaction;
}
