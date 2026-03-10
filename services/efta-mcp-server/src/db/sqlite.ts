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
let _concordance: Database.Database | null = null;
let _alteration: Database.Database | null = null;
let _imageAnalysis: Database.Database | null = null;
let _handwriting: Database.Database | null = null;
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
  _concordance = openReadOnly(join(dir, 'concordance_complete.db'), 'Concordance (DOJ metadata)');
  _alteration = openReadOnly(join(dir, 'alteration_results.db'), 'Alteration results');
  _imageAnalysis = openReadOnly(join(dir, 'image_analysis.db'), 'Image analysis');
  _handwriting = openReadOnly(join(dir, 'handwriting_transcriptions.db'), 'Handwriting transcriptions');
}

export function getCorpusDb(): Database.Database | null {
  initDatabases();
  return _corpus;
}

export function getRedactionDb(): Database.Database | null {
  initDatabases();
  return _redaction;
}

export function getConcordanceDb(): Database.Database | null {
  initDatabases();
  return _concordance;
}

export function getAlterationDb(): Database.Database | null {
  initDatabases();
  return _alteration;
}

export function getImageAnalysisDb(): Database.Database | null {
  initDatabases();
  return _imageAnalysis;
}

export function getHandwritingDb(): Database.Database | null {
  initDatabases();
  return _handwriting;
}
