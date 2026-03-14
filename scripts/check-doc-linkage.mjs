import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get all published entities and their document counts
const {data: entities} = await sb.from('entities').select('id,name,slug,tier').eq('profile_published', true).order('tier').order('name');

console.log('=== Published Entity Document Linkage ===\n');

let totalDocs = 0;
let entitiesWithDocs = 0;

for (const e of entities) {
  // Check evidence_items linked to this entity
  const {count: evidenceCount} = await sb.from('evidence_items')
    .select('*', {count: 'exact', head: true})
    .eq('entity_id', e.id);

  // Check entity_documents if it exists
  const {count: entityDocCount, error: edErr} = await sb.from('entity_documents')
    .select('*', {count: 'exact', head: true})
    .eq('entity_id', e.id);

  const docCount = (evidenceCount || 0) + (edErr ? 0 : (entityDocCount || 0));
  totalDocs += docCount;
  if (docCount > 0) entitiesWithDocs++;

  console.log(`  T${e.tier} ${e.name.padEnd(35)} evidence_items: ${evidenceCount || 0}${edErr ? '' : `  entity_docs: ${entityDocCount || 0}`}`);
}

console.log(`\n=== Summary ===`);
console.log(`Total published entities: ${entities.length}`);
console.log(`Entities with linked docs: ${entitiesWithDocs}`);
console.log(`Total doc links: ${totalDocs}`);
console.log(`Entities with NO docs: ${entities.length - entitiesWithDocs}`);
