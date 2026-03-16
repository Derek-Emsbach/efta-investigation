import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, '../apps/web/.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const corpusPath = join(__dirname, '../services/efta-mcp-server/data/full_text_corpus.db');
const corpus = new Database(corpusPath, { readonly: true, fileMustExist: true });
corpus.pragma('journal_mode = OFF');
corpus.pragma('query_only = ON');

function countCorpus(name) {
  try {
    const row = corpus.prepare(`SELECT COUNT(*) as cnt FROM pages_fts WHERE pages_fts MATCH ?`).get(`"${name.replace(/"/g, '""')}"`);
    return row?.cnt || 0;
  } catch { return 0; }
}

const targets = ['Jim Kimsey', 'Ted Leonsis', 'Steve Case', 'Dan Snyder', 'Celina Edith Dubin', 'Gerd'];

for (const name of targets) {
  const { data: entity } = await sb.from('entities')
    .select('id,name,aliases,tier')
    .ilike('name', `%${name}%`)
    .single();

  if (!entity) { console.log(`${name}: NOT FOUND`); continue; }

  const { count: dbLinks } = await sb.from('entity_documents')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entity.id);

  console.log(`\n${entity.name} (T${entity.tier}):`);
  console.log(`  DB links: ${dbLinks}`);
  console.log(`  Aliases: ${JSON.stringify(entity.aliases)}`);

  // Search corpus for name and variants
  const names = [entity.name, ...(entity.aliases || [])];
  for (const n of names) {
    const hits = countCorpus(n);
    console.log(`  Corpus "${n}": ${hits} page hits`);
  }

  // Try partial names
  const parts = entity.name.split(' ');
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    if (lastName.length >= 5) {
      const lastHits = countCorpus(lastName);
      console.log(`  Corpus "${lastName}" (last name only): ${lastHits} page hits`);
    }
  }
}

corpus.close();
