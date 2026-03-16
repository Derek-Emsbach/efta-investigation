import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get a sample of entity_documents links
const { data: sample } = await sb.from('entity_documents')
  .select('entity_id, document_id')
  .limit(10);

console.log('Sample entity_documents links:');
for (const link of sample) {
  // Check if document exists
  const { data: doc, error } = await sb.from('documents')
    .select('id, bates_number')
    .eq('id', link.document_id)
    .single();

  console.log(`  doc_id: ${link.document_id} → ${doc ? `EXISTS (${doc.bates_number})` : `MISSING (${error?.code})`}`);
}

// Check: is entity_documents.document_id a UUID or something else?
console.log('\nSample document_id format:', sample[0]?.document_id);

// Check: what does a real documents.id look like?
const { data: realDoc } = await sb.from('documents').select('id, bates_number').limit(1);
console.log('Real documents.id format:', realDoc[0]?.id);

// Check if there's a foreign key constraint
const { data: fkCheck } = await sb.rpc('exec_sql', { sql: `
  SELECT conname, conrelid::regclass, confrelid::regclass
  FROM pg_constraint
  WHERE conrelid = 'entity_documents'::regclass AND contype = 'f'
` }).catch(() => null);
console.log('\nFK constraints:', fkCheck);

// Count orphaned links
const { count: totalLinks } = await sb.from('entity_documents').select('*', { count: 'exact', head: true });

// Try to find docs that DO match
const { data: workingLinks } = await sb.from('entity_documents')
  .select('document_id, documents!inner(id)')
  .limit(5);
console.log(`\nLinks with valid document join: ${workingLinks?.length || 0} (of first 5 attempted)`);
