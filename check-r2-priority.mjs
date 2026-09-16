import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('../apps/web/.env.local','utf8').split('\n')
    .filter(l=>l&&!l.startsWith('#'))
    .map(l=>{const i=l.indexOf('=');return i>0?[l.substring(0,i).trim(),l.substring(i+1).trim()]:null})
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Docs linked to published entities that have a real R2 key (not corpus:pending)
const {data: entityDocs, error: e1} = await sb
  .from('entity_documents')
  .select('document_id, documents:document_id(id,bates_number,r2_key,title)')
  .not('documents.r2_key','is',null)
  .not('documents.r2_key','like','corpus:%')
  .limit(5);

// Count docs linked to published entities with R2 PDFs
const {data: publishedEntities} = await sb
  .from('entities')
  .select('id')
  .eq('profile_published', true);

const entityIds = publishedEntities.map(e=>e.id);

// Get all entity_documents for published entities
const {count: totalLinked} = await sb
  .from('entity_documents')
  .select('document_id', {count:'exact', head:true})
  .in('entity_id', entityIds);

// Docs with actual R2 PDFs
const {data: docsWithR2} = await sb
  .from('entity_documents')
  .select('document_id')
  .in('entity_id', entityIds);

if (docsWithR2) {
  const docIds = [...new Set(docsWithR2.map(d=>d.document_id))];
  const {count: r2Count} = await sb
    .from('documents')
    .select('id', {count:'exact', head:true})
    .in('id', docIds.slice(0,500))
    .not('r2_key','is',null);
  console.log('Published entity linked docs:', docIds.length);
  console.log('Sample with R2 keys (first 500 checked):', r2Count);
}

console.log('Total entity_documents for published entities:', totalLinked);
console.log('\nSample entity docs with R2:', entityDocs?.slice(0,3).map(d=>({bates:d.documents?.bates_number, r2:d.documents?.r2_key?.slice(0,40)})));
