import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Events count
const { count: eventCount } = await sb.from('events').select('*', { count: 'exact', head: true });
console.log(`Total events: ${eventCount}`);

// Event-entity links
const { count: linkCount } = await sb.from('entity_events').select('*', { count: 'exact', head: true });
console.log(`Entity-event links: ${linkCount}`);

// Case files
const { data: caseFiles } = await sb.from('case_files').select('id,title,slug,is_published');
const { data: openQuestions } = await sb.from('open_questions').select('id,case_file_id,priority');

console.log(`\n─── CASE FILES ────────────────────────────────────────────────`);
for (const cf of caseFiles) {
  const qs = openQuestions.filter(q => q.case_file_id === cf.id);
  console.log(`  ${cf.is_published ? '✓' : '✗'} ${cf.title.padEnd(50)} questions:${qs.length}`);
}

// Document links total
const { count: docLinkCount } = await sb.from('entity_documents').select('*', { count: 'exact', head: true });
console.log(`\nTotal entity-document links: ${docLinkCount}`);

// Entities with published profiles
const { data: published } = await sb.from('entities')
  .select('id,name,tier')
  .eq('profile_published', true)
  .order('tier').order('name');

// Get doc counts per published entity
for (const e of published) {
  const { count } = await sb.from('entity_documents').select('*', { count: 'exact', head: true }).eq('entity_id', e.id);
  if (count > 0) {
    // already printed in main audit
  }
}

// Check entities with events
const entitiesWithEvents = new Set();
// Get a sample of entity_events
const { data: eeLinks } = await sb.from('entity_events').select('entity_id').limit(5000);
if (eeLinks) eeLinks.forEach(l => entitiesWithEvents.add(l.entity_id));

const noEvents = published.filter(e => !entitiesWithEvents.has(e.id));
console.log(`\n⚠ Published entities with 0 events: ${noEvents.length}`);
noEvents.forEach(e => console.log(`  T${e.tier} ${e.name}`));
