import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Total entity_documents links
const { count: totalLinks } = await sb.from('entity_documents').select('*', { count: 'exact', head: true });
console.log(`Total entity_documents links: ${totalLinks}\n`);

// 2. Get all distinct entity_ids that have doc links
const entityDocCounts = {};
let offset = 0;
while (true) {
  const { data } = await sb.from('entity_documents').select('entity_id').range(offset, offset + 4999);
  if (!data || data.length === 0) break;
  data.forEach(d => { entityDocCounts[d.entity_id] = (entityDocCounts[d.entity_id] || 0) + 1; });
  offset += data.length;
  if (data.length < 5000) break;
  process.stdout.write(`  fetched ${offset} links...\r`);
}
console.log(`Distinct entities with doc links: ${Object.keys(entityDocCounts).length}\n`);

// 3. Get all published entities
const { data: published } = await sb.from('entities')
  .select('id,name,tier,profile_published')
  .eq('profile_published', true)
  .order('tier').order('name');

// 4. Get all entities (to check if linked ones are unpublished)
const { data: allEntities } = await sb.from('entities')
  .select('id,name,tier,profile_published')
  .order('tier').order('name');
const entityById = Object.fromEntries(allEntities.map(e => [e.id, e]));

// 5. Show which entities have links
console.log('─── ENTITIES WITH DOC LINKS ───────────────────────────────────');
const sorted = Object.entries(entityDocCounts).sort((a, b) => b[1] - a[1]);
for (const [id, count] of sorted) {
  const e = entityById[id];
  if (e) {
    console.log(`  ${e.profile_published ? 'PUB' : '   '} T${e.tier} ${e.name.padEnd(35)} ${count} links`);
  } else {
    console.log(`  ???  ${id.padEnd(35)} ${count} links (entity not found!)`);
  }
}

// 6. Show published entities with 0 links
console.log('\n─── PUBLISHED ENTITIES WITH 0 DOC LINKS ──────────────────────');
const pubWithZero = published.filter(e => !entityDocCounts[e.id]);
pubWithZero.forEach(e => console.log(`  T${e.tier} ${e.name} (${e.id})`));
console.log(`\nTotal: ${pubWithZero.length} of ${published.length} published entities have 0 doc links`);
