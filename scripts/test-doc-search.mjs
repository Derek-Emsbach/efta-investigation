import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Test FTS for various entity names
const testNames = [
  'Bill Richardson',
  'Ghislaine Maxwell',
  'Lesley Groff',
  'Alan Dershowitz',
  'Prince Andrew',
  'Dan Snyder',
  'Steve Case',
  'Leon Black',
  'Harvey Weinstein',
];

console.log('=== Supabase FTS Tests ===\n');

for (const name of testNames) {
  // Try plainto_tsquery
  const {count, error} = await sb.from('documents')
    .select('*', {count: 'exact', head: true})
    .textSearch('search_vector', name, { type: 'plain' });

  // Also try title ilike
  const {count: titleCount} = await sb.from('documents')
    .select('*', {count: 'exact', head: true})
    .ilike('title', `%${name}%`);

  console.log(`  ${name.padEnd(25)} FTS: ${count ?? 'err:' + error?.message}  title_ilike: ${titleCount ?? 0}`);
}

// Check what a typical document looks like (does it have extracted text?)
console.log('\n=== Sample Documents (search_vector stats) ===');
const {count: totalDocs} = await sb.from('documents').select('*', {count: 'exact', head: true});
console.log(`Total documents: ${totalDocs}`);

// Check how many have non-null search_vector
const {data: sample} = await sb.from('documents').select('bates_number,title,document_type,page_count').limit(5).order('created_at', {ascending: false});
console.log('\nRecent 5 docs:');
for (const d of (sample||[])) console.log(`  ${d.bates_number} | ${d.title?.substring(0,60) || 'null'} | ${d.document_type} | ${d.page_count} pages`);

// Check docs with titles containing names
const {data: namedDocs} = await sb.from('documents').select('bates_number,title').ilike('title', '%Richardson%').limit(10);
console.log('\n=== Docs with "Richardson" in title ===');
for (const d of (namedDocs||[])) console.log(`  ${d.bates_number}: ${d.title?.substring(0,80)}`);
