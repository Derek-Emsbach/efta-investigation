import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const slug = 'leon-black';
const { data: entity } = await sb.from('entities').select('id,name').eq('slug', slug).single();
console.log(`Entity: ${entity.name} (${entity.id})`);

// Test 1: simple select from entity_documents
const { data: links, count } = await sb.from('entity_documents')
  .select('*', { count: 'exact' })
  .eq('entity_id', entity.id)
  .limit(3);
console.log(`\nTest 1 - Direct query: ${count} links`);
if (links?.length) console.log('  Sample:', JSON.stringify(links[0]));

// Test 2: join with documents (the failing query)
const { data: joined, error: joinErr } = await sb.from('entity_documents')
  .select('document_id, role_in_document, documents(id, bates_number)')
  .eq('entity_id', entity.id)
  .limit(3);
console.log(`\nTest 2 - Join query: ${joined?.length || 0} rows, error: ${joinErr?.message || 'none'}`);
if (joined?.length) console.log('  Sample:', JSON.stringify(joined[0]));

// Test 3: reverse join from documents
const docId = links?.[0]?.document_id;
if (docId) {
  const { data: doc } = await sb.from('documents').select('id, bates_number').eq('id', docId).single();
  console.log(`\nTest 3 - Direct document lookup: ${doc ? doc.bates_number : 'NOT FOUND'}`);

  // Test 4: query entity_documents with explicit inner join
  const { data: inner, error: innerErr } = await sb.from('entity_documents')
    .select('document_id, documents!inner(id, bates_number)')
    .eq('entity_id', entity.id)
    .limit(3);
  console.log(`\nTest 4 - Inner join: ${inner?.length || 0} rows, error: ${innerErr?.message || 'none'}`);
  if (inner?.length) console.log('  Sample:', JSON.stringify(inner[0]));
}

// Test 5: Check if there's a relationship hint issue
const { data: test5, error: err5 } = await sb.from('entity_documents')
  .select('*, documents(*)')
  .eq('entity_id', entity.id)
  .limit(3);
console.log(`\nTest 5 - Select all with join: ${test5?.length || 0} rows, error: ${err5?.message || 'none'}`);
if (test5?.length) {
  const sample = test5[0];
  console.log('  Has documents?', sample.documents !== null);
  console.log('  Sample keys:', Object.keys(sample));
}
