import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check: does the entity profile API query get doc links?
// Replicate what /api/public/entities/[slug] does
const slug = 'leon-black';

// Direct count
const { data: entity } = await sb.from('entities').select('id,name').eq('slug', slug).single();
const { count } = await sb.from('entity_documents').select('*', { count: 'exact', head: true }).eq('entity_id', entity.id);
console.log(`${entity.name}: ${count} doc links in entity_documents table`);

// Now check what the API-style query returns
const { data: docs } = await sb.from('entity_documents')
  .select('document_id, role_in_document, excerpt, page_number, documents(id, bates_number, title, doc_type, severity)')
  .eq('entity_id', entity.id)
  .limit(5);

console.log(`\nAPI-style join query returns ${docs?.length || 0} rows (limit 5)`);
if (docs?.length) {
  console.log('Sample:', JSON.stringify(docs[0], null, 2));
}
