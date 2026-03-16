import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── 1. All entities with their stats ──────────────────────────────────────────
const { data: entities } = await sb.from('entities')
  .select('id,name,slug,tier,category,status,profile_published,profile_image_url,metadata')
  .order('tier').order('name');

// ── 2. All connections ────────────────────────────────────────────────────────
const { data: connections } = await sb.from('entity_connections')
  .select('id,entity_a,entity_b,relationship_type,evidence_strength,description');

// ── 3. All stories ────────────────────────────────────────────────────────────
const { data: stories } = await sb.from('stories')
  .select('id,title,slug,section,is_published');

// ── 4. Story citations count per story ────────────────────────────────────────
const { data: citations } = await sb.from('story_citations')
  .select('story_id');

// ── 5. Story-entity links ─────────────────────────────────────────────────────
const { data: storyEntities } = await sb.from('story_entities')
  .select('story_id,entity_id,is_primary');

// ── 6. Entity-document link counts ────────────────────────────────────────────
const { data: docLinks } = await sb.from('entity_documents')
  .select('entity_id');

// ── 7. Entity-event link counts ───────────────────────────────────────────────
const { data: eventLinks } = await sb.from('entity_events')
  .select('entity_id,event_id');

// ── 8. All events ─────────────────────────────────────────────────────────────
const { data: events } = await sb.from('events')
  .select('id,title,event_date,event_type');

// ── 9. Case files ─────────────────────────────────────────────────────────────
const { data: caseFiles } = await sb.from('case_files')
  .select('id,title,slug,is_published');

// ── 10. Open questions ────────────────────────────────────────────────────────
const { data: openQuestions } = await sb.from('open_questions')
  .select('id,case_file_id,question,priority');

// ── Build entity lookup ───────────────────────────────────────────────────────
const entityById = Object.fromEntries(entities.map(e => [e.id, e]));
const entityByName = Object.fromEntries(entities.map(e => [e.name, e]));

// ── Aggregate counts per entity ───────────────────────────────────────────────
const docCountByEntity = {};
docLinks.forEach(d => { docCountByEntity[d.entity_id] = (docCountByEntity[d.entity_id] || 0) + 1; });

const eventCountByEntity = {};
eventLinks.forEach(e => { eventCountByEntity[e.entity_id] = (eventCountByEntity[e.entity_id] || 0) + 1; });

const connectionCountByEntity = {};
connections.forEach(c => {
  connectionCountByEntity[c.entity_a] = (connectionCountByEntity[c.entity_a] || 0) + 1;
  connectionCountByEntity[c.entity_b] = (connectionCountByEntity[c.entity_b] || 0) + 1;
});

const storyCountByEntity = {};
storyEntities.forEach(se => { storyCountByEntity[se.entity_id] = (storyCountByEntity[se.entity_id] || 0) + 1; });

const citCountByStory = {};
citations.forEach(c => { citCountByStory[c.story_id] = (citCountByStory[c.story_id] || 0) + 1; });

// ══════════════════════════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════');
console.log('  EFTA INVESTIGATION — DATABASE AUDIT');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── ENTITIES ──────────────────────────────────────────────────────────────────
console.log('─── ENTITIES ──────────────────────────────────────────────────');
const published = entities.filter(e => e.profile_published);
const unpublished = entities.filter(e => !e.profile_published);
const tierCounts = {};
entities.forEach(e => { tierCounts[e.tier] = (tierCounts[e.tier] || 0) + 1; });
const pubTierCounts = {};
published.forEach(e => { pubTierCounts[e.tier] = (pubTierCounts[e.tier] || 0) + 1; });

console.log(`Total: ${entities.length} | Published: ${published.length} | Unpublished: ${unpublished.length}`);
console.log(`By tier: ${Object.entries(tierCounts).map(([t,c]) => `T${t}:${c}`).join('  ')}`);
console.log(`Published by tier: ${Object.entries(pubTierCounts).map(([t,c]) => `T${t}:${c}`).join('  ')}`);

// Entities missing key data
console.log('\n  ⚠ PUBLISHED entities missing data:');
published.forEach(e => {
  const issues = [];
  if (!e.profile_image_url) issues.push('no photo');
  if (!e.metadata?.evidence_summary) issues.push('no evidence_summary');
  if (!e.metadata?.bio) issues.push('no bio');
  const docs = docCountByEntity[e.id] || 0;
  const evts = eventCountByEntity[e.id] || 0;
  const conns = connectionCountByEntity[e.id] || 0;
  const stories = storyCountByEntity[e.id] || 0;
  if (docs === 0) issues.push('0 doc links');
  if (evts === 0) issues.push('0 events');
  if (conns === 0) issues.push('0 connections');
  if (stories === 0) issues.push('0 stories');
  if (issues.length > 0) {
    console.log(`    T${e.tier} ${e.name.padEnd(30)} ${issues.join(', ')}`);
  }
});

// Full entity table
console.log('\n  FULL ENTITY TABLE (published):');
console.log('  ' + 'Name'.padEnd(30) + 'Tier  Docs    Events  Conns   Stories Photo Bio  EvSum');
published.sort((a,b) => a.tier - b.tier || a.name.localeCompare(b.name)).forEach(e => {
  const docs = docCountByEntity[e.id] || 0;
  const evts = eventCountByEntity[e.id] || 0;
  const conns = connectionCountByEntity[e.id] || 0;
  const stories = storyCountByEntity[e.id] || 0;
  const photo = e.profile_image_url ? '✓' : '✗';
  const bio = e.metadata?.bio ? '✓' : '✗';
  const evSum = e.metadata?.evidence_summary ? '✓' : '✗';
  console.log(`  ${e.name.padEnd(30)} T${e.tier}   ${String(docs).padEnd(7)} ${String(evts).padEnd(7)} ${String(conns).padEnd(7)} ${String(stories).padEnd(7)} ${photo}     ${bio}    ${evSum}`);
});

// Unpublished entities worth publishing
console.log('\n  UNPUBLISHED entities (candidates for publishing):');
unpublished.sort((a,b) => a.tier - b.tier || a.name.localeCompare(b.name)).forEach(e => {
  const docs = docCountByEntity[e.id] || 0;
  const conns = connectionCountByEntity[e.id] || 0;
  console.log(`    T${e.tier} ${e.name.padEnd(35)} cat:${(e.category||'?').padEnd(15)} docs:${docs}  conns:${conns}  slug:${e.slug || 'NONE'}`);
});

// ── CONNECTIONS ───────────────────────────────────────────────────────────────
console.log('\n─── CONNECTIONS ───────────────────────────────────────────────');
console.log(`Total: ${connections.length}`);
const strengthCounts = {};
connections.forEach(c => { strengthCounts[c.evidence_strength] = (strengthCounts[c.evidence_strength] || 0) + 1; });
console.log(`By strength: ${Object.entries(strengthCounts).map(([s,c]) => `${s}:${c}`).join('  ')}`);
const typeCounts = {};
connections.forEach(c => { typeCounts[c.relationship_type] = (typeCounts[c.relationship_type] || 0) + 1; });
console.log(`By type: ${Object.entries(typeCounts).map(([t,c]) => `${t}:${c}`).join('  ')}`);

// Entities with 0 connections
const noConnections = published.filter(e => (connectionCountByEntity[e.id] || 0) === 0);
if (noConnections.length > 0) {
  console.log(`\n  ⚠ ${noConnections.length} published entities with 0 connections:`);
  noConnections.forEach(e => console.log(`    T${e.tier} ${e.name}`));
}

// ── STORIES ───────────────────────────────────────────────────────────────────
console.log('\n─── STORIES ───────────────────────────────────────────────────');
console.log(`Total: ${stories.length} | Published: ${stories.filter(s => s.is_published).length}`);
const sectionCounts = {};
stories.filter(s => s.is_published).forEach(s => { sectionCounts[s.section] = (sectionCounts[s.section] || 0) + 1; });
console.log(`By section: ${Object.entries(sectionCounts).map(([s,c]) => `${s}:${c}`).join('  ')}`);

stories.forEach(s => {
  const cits = citCountByStory[s.id] || 0;
  const ents = storyEntities.filter(se => se.story_id === s.id).length;
  const pub = s.is_published ? '✓' : '✗';
  console.log(`  ${pub} ${s.title.padEnd(50)} cit:${String(cits).padEnd(4)} ent:${ents}  [${s.section}]`);
});

// ── EVENTS ────────────────────────────────────────────────────────────────────
console.log('\n─── EVENTS ────────────────────────────────────────────────────');
console.log(`Total events: ${events.length}`);
console.log(`Entity-event links: ${eventLinks.length}`);
const eventTypeCounts = {};
events.forEach(e => { eventTypeCounts[e.event_type || 'null'] = (eventTypeCounts[e.event_type || 'null'] || 0) + 1; });
console.log(`By type: ${Object.entries(eventTypeCounts).map(([t,c]) => `${t}:${c}`).join('  ')}`);

// Events with no entity links
const linkedEventIds = new Set(eventLinks.map(el => el.event_id));
const orphanEvents = events.filter(e => !linkedEventIds.has(e.id));
if (orphanEvents.length > 0) {
  console.log(`\n  ⚠ ${orphanEvents.length} events with no entity links (orphaned)`);
}

// ── CASE FILES ────────────────────────────────────────────────────────────────
console.log('\n─── CASE FILES ────────────────────────────────────────────────');
caseFiles.forEach(cf => {
  const qs = openQuestions.filter(q => q.case_file_id === cf.id);
  console.log(`  ${cf.is_published ? '✓' : '✗'} ${cf.title.padEnd(50)} questions:${qs.length}`);
});

// ── DOCUMENT LINKS ────────────────────────────────────────────────────────────
console.log('\n─── DOCUMENT LINKS ────────────────────────────────────────────');
console.log(`Total entity-document links: ${docLinks.length}`);
const topByDocs = published.map(e => ({ name: e.name, tier: e.tier, count: docCountByEntity[e.id] || 0 }))
  .sort((a,b) => b.count - a.count).slice(0, 15);
console.log('  Top 15 by doc links:');
topByDocs.forEach(e => console.log(`    T${e.tier} ${e.name.padEnd(30)} ${e.count} docs`));

const zeroDocs = published.filter(e => (docCountByEntity[e.id] || 0) === 0);
if (zeroDocs.length > 0) {
  console.log(`\n  ⚠ ${zeroDocs.length} published entities with 0 document links:`);
  zeroDocs.forEach(e => console.log(`    T${e.tier} ${e.name}`));
}

// ── GAP ANALYSIS ──────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  GAP ANALYSIS & RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════════════════\n');

// High-tier entities with thin profiles
console.log('1. HIGH-PRIORITY ENRICHMENT NEEDED (T1-T2, missing key data):');
published.filter(e => e.tier <= 2).forEach(e => {
  const gaps = [];
  if (!e.profile_image_url) gaps.push('photo');
  if (!e.metadata?.evidence_summary) gaps.push('evidence_summary');
  if (!e.metadata?.bio) gaps.push('bio');
  if ((eventCountByEntity[e.id] || 0) < 3) gaps.push(`only ${eventCountByEntity[e.id] || 0} events`);
  if ((connectionCountByEntity[e.id] || 0) < 2) gaps.push(`only ${connectionCountByEntity[e.id] || 0} connections`);
  if (gaps.length > 0) {
    console.log(`  T${e.tier} ${e.name.padEnd(30)} needs: ${gaps.join(', ')}`);
  }
});

// Story coverage gaps
console.log('\n2. STORY COVERAGE GAPS:');
const entitiesInStories = new Set(storyEntities.map(se => se.entity_id));
const t1t2NoStory = published.filter(e => e.tier <= 2 && !entitiesInStories.has(e.id));
if (t1t2NoStory.length > 0) {
  console.log('  T1-T2 entities not referenced in any story:');
  t1t2NoStory.forEach(e => console.log(`    T${e.tier} ${e.name}`));
}
const t3NoStory = published.filter(e => e.tier === 3 && !entitiesInStories.has(e.id));
if (t3NoStory.length > 0) {
  console.log(`  T3 entities not in any story (${t3NoStory.length}):`);
  t3NoStory.forEach(e => console.log(`    ${e.name}`));
}

// Connection density
console.log('\n3. CONNECTION NETWORK GAPS:');
const avgConns = published.reduce((s,e) => s + (connectionCountByEntity[e.id] || 0), 0) / published.length;
console.log(`  Average connections per published entity: ${avgConns.toFixed(1)}`);
console.log('  Entities with fewer connections than expected for their tier:');
published.filter(e => {
  const expected = e.tier <= 2 ? 5 : e.tier === 3 ? 3 : 2;
  return (connectionCountByEntity[e.id] || 0) < expected;
}).sort((a,b) => a.tier - b.tier).forEach(e => {
  console.log(`    T${e.tier} ${e.name.padEnd(30)} has ${connectionCountByEntity[e.id] || 0} (expected ${e.tier <= 2 ? '5+' : e.tier === 3 ? '3+' : '2+'})`);
});

// Section balance
console.log('\n4. STORY SECTION BALANCE:');
['the-cover-up', 'the-network', 'follow-the-money', 'the-operation'].forEach(sec => {
  const count = sectionCounts[sec] || 0;
  console.log(`  ${sec.padEnd(20)} ${count} stories`);
});

console.log('\n═══════════════════════════════════════════════════════════════');
