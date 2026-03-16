import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Total count
const { count: totalLinks } = await sb.from('entity_documents').select('*', { count: 'exact', head: true });
console.log(`Total entity_documents links: ${totalLinks}\n`);

// Page through ALL links in 1000-row batches (Supabase PostgREST default limit)
const entityDocCounts = {};
let offset = 0;
const BATCH = 999; // Supabase max per request
while (offset < totalLinks) {
  const { data, error } = await sb.from('entity_documents')
    .select('entity_id')
    .range(offset, offset + BATCH);
  if (error) { console.error('Error:', error.message); break; }
  if (!data || data.length === 0) break;
  data.forEach(d => { entityDocCounts[d.entity_id] = (entityDocCounts[d.entity_id] || 0) + 1; });
  offset += data.length;
  if (offset % 10000 < 1000) process.stdout.write(`  fetched ${offset} / ${totalLinks}...\n`);
}
console.log(`\nFetched ${offset} links total`);
console.log(`Distinct entities with doc links: ${Object.keys(entityDocCounts).length}\n`);

// Get all entities
const { data: allEntities } = await sb.from('entities')
  .select('id,name,tier,profile_published')
  .order('tier').order('name');
const entityById = Object.fromEntries(allEntities.map(e => [e.id, e]));

// Show entities with links, sorted by count
console.log('─── TOP 40 ENTITIES BY DOC LINKS ─────────────────────────────');
const sorted = Object.entries(entityDocCounts).sort((a, b) => b[1] - a[1]);
for (const [id, count] of sorted.slice(0, 40)) {
  const e = entityById[id];
  if (e) {
    console.log(`  ${e.profile_published ? 'PUB' : '   '} T${e.tier} ${e.name.padEnd(35)} ${count}`);
  } else {
    console.log(`  ???  ${id.substring(0, 8).padEnd(35)} ${count} (NOT IN ENTITIES TABLE)`);
  }
}

// Published entities with links vs without
const published = allEntities.filter(e => e.profile_published);
const pubWith = published.filter(e => entityDocCounts[e.id]);
const pubWithout = published.filter(e => !entityDocCounts[e.id]);
console.log(`\nPublished with links: ${pubWith.length} / ${published.length}`);
console.log(`Published without links: ${pubWithout.length}`);
if (pubWithout.length > 0) {
  console.log('\n─── PUBLISHED ENTITIES WITH 0 DOC LINKS ──────────────────────');
  pubWithout.forEach(e => console.log(`  T${e.tier} ${e.name}`));
}
