/**
 * Entity Profile Batch Enrichment Script
 *
 * Phase 1: Cleanup — unpublish stubs, delete test entity
 * Phase 2: Connection generation — create connections from document co-occurrence
 * Phase 3: Audit — re-run richness audit with corrected column names
 *
 * Usage: node scripts/enrich-entities.mjs [--dry-run] [--phase=1|2|3|all]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const phaseArg = args.find(a => a.startsWith('--phase='))?.split('=')[1] || 'all';

if (dryRun) console.log('*** DRY RUN — no database changes will be made ***\n');

// ─── Phase 1: Cleanup ────────────────────────────────────────────────────────

async function phase1Cleanup() {
  console.log('═══ PHASE 1: CLEANUP ═══\n');

  const { data: published, error: pubErr } = await sb.from('entities')
    .select('id, name, tier, category, bio, metadata')
    .eq('profile_published', true)
    .order('name');

  if (pubErr) { console.log('Error fetching entities:', pubErr.message); return; }
  if (!published) { console.log('No published entities found'); return; }

  // Identify stub entities to unpublish
  // Surname-only stubs from victim journals, plus test entities
  // Explicit list to avoid catching legitimate entities like "The Blackstone Group"
  const STUB_NAMES = new Set([
    'Bill S.', 'Federal Worker', 'Mr. Atkins', 'Mr. Caruthers', 'Mr. Cecchi',
    'Mr. Colgan', 'Mr. Conway', 'Mr. Dana', 'Mr. Ein', 'Mr. Goodlatte',
    'Mr. Islam', 'Mr. Jacobson', 'Mr. Krauss', 'Mr. Ludwig', 'Mr. Mody',
    'Mr. Mora', 'Mr. Novak', 'Mr. Rails', 'Mr. Sant', 'Mr. Vradenberg',
    'The Gregorys',
  ]);
  const stubs = published.filter(e => {
    return STUB_NAMES.has(e.name) || e.name.toLowerCase().includes('test');
  });

  console.log(`Found ${stubs.length} stub/test entities to unpublish:`);
  for (const s of stubs) {
    console.log(`  [T${s.tier}] ${s.name}`);
  }

  if (!dryRun && stubs.length > 0) {
    const ids = stubs.map(s => s.id);
    const { error } = await sb.from('entities')
      .update({ profile_published: false })
      .in('id', ids);
    if (error) {
      console.log(`  ERROR: ${error.message}`);
    } else {
      console.log(`\n  ✓ Unpublished ${stubs.length} stub entities`);
    }
  }

  // Delete test entity entirely
  const testEntity = published.find(e => e.name.toLowerCase().includes('test'));
  if (testEntity) {
    console.log(`\n  Test entity to delete: "${testEntity.name}" (${testEntity.id})`);
    if (!dryRun) {
      const { error } = await sb.from('entities').delete().eq('id', testEntity.id);
      if (error) console.log(`  ERROR deleting: ${error.message}`);
      else console.log(`  ✓ Deleted test entity`);
    }
  }

  console.log('');
}

// ─── Phase 2: Connection Generation ──────────────────────────────────────────

async function phase2Connections() {
  console.log('═══ PHASE 2: CONNECTION GENERATION ═══\n');

  // Get all published entities
  const { data: published } = await sb.from('entities')
    .select('id, name, tier')
    .eq('profile_published', true)
    .order('name');

  console.log(`Published entities: ${published.length}`);

  // Get existing connections to avoid duplicates
  const { data: existingConns } = await sb.from('entity_connections').select('entity_a, entity_b');
  const existingPairs = new Set();
  for (const c of existingConns || []) {
    existingPairs.add(`${c.entity_a}|${c.entity_b}`);
    existingPairs.add(`${c.entity_b}|${c.entity_a}`);
  }
  console.log(`Existing connections: ${existingConns?.length || 0}`);

  // Get all entity_documents for published entities
  const pubIds = published.map(e => e.id);
  const { data: entityDocs } = await sb.from('entity_documents')
    .select('entity_id, document_id')
    .in('entity_id', pubIds);

  console.log(`Entity-document links: ${entityDocs?.length || 0}`);

  if (!entityDocs?.length) {
    console.log('No entity-document links found. Skipping co-occurrence analysis.\n');
    return;
  }

  // Build document → entities map
  const docEntities = {};
  for (const ed of entityDocs) {
    if (!docEntities[ed.document_id]) docEntities[ed.document_id] = new Set();
    docEntities[ed.document_id].add(ed.entity_id);
  }

  // Count co-occurrences
  const coOccurrences = {};
  for (const [docId, entitySet] of Object.entries(docEntities)) {
    const entities = [...entitySet];
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const key = [entities[i], entities[j]].sort().join('|');
        if (!coOccurrences[key]) coOccurrences[key] = { a: entities[i], b: entities[j], count: 0, docs: [] };
        coOccurrences[key].count++;
        if (coOccurrences[key].docs.length < 5) coOccurrences[key].docs.push(docId);
      }
    }
  }

  // Filter to significant co-occurrences (2+ shared docs) and not already connected
  const nameMap = Object.fromEntries(published.map(e => [e.id, e.name]));
  const newConnections = Object.values(coOccurrences)
    .filter(co => co.count >= 2 && !existingPairs.has(`${co.a}|${co.b}`))
    .sort((a, b) => b.count - a.count);

  console.log(`\nCo-occurrence pairs (2+ shared docs): ${Object.values(coOccurrences).filter(c => c.count >= 2).length}`);
  console.log(`New connections to create (not already linked): ${newConnections.length}`);

  if (newConnections.length > 0) {
    console.log('\nNew connections:');
    for (const nc of newConnections) {
      console.log(`  ${nameMap[nc.a] || nc.a} ↔ ${nameMap[nc.b] || nc.b} (${nc.count} shared docs)`);
    }

    if (!dryRun) {
      const inserts = newConnections.map(nc => ({
        entity_a: nc.a,
        entity_b: nc.b,
        relationship_type: 'connected_to',
        evidence_strength: nc.count >= 5 ? 'documented' : nc.count >= 3 ? 'alleged' : 'circumstantial',
        description: `Appear together in ${nc.count} documents`,
        source_document_ids: nc.docs,
      }));

      const { error } = await sb.from('entity_connections').insert(inserts);
      if (error) {
        console.log(`\n  ERROR inserting connections: ${error.message}`);
      } else {
        console.log(`\n  ✓ Created ${inserts.length} new connections`);
      }
    }
  }

  console.log('');
}

// ─── Phase 3: Audit ──────────────────────────────────────────────────────────

async function phase3Audit() {
  console.log('═══ PHASE 3: RICHNESS AUDIT ═══\n');

  const { data: entities, error: entErr } = await sb.from('entities')
    .select('id, name, tier, category, bio, profile_image_url, financial_summary, metadata')
    .eq('profile_published', true)
    .order('tier').order('name');

  if (entErr) { console.log('Error:', entErr.message); return; }
  if (!entities?.length) { console.log('No published entities found'); return; }

  const out = [];
  for (const e of entities) {
    const [d, ev, c, s, cf] = await Promise.all([
      sb.from('entity_documents').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
      sb.from('entity_events').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
      // FIXED: use entity_a/entity_b, not entity_a_id/entity_b_id
      sb.from('entity_connections').select('id', { count: 'exact' }).or(`entity_a.eq.${e.id},entity_b.eq.${e.id}`),
      sb.from('story_entities').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
      sb.from('case_file_entities').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
    ]);

    const connCount = c.data?.length || 0;
    const hasBio = e.bio && e.bio.length > 20;
    const hasEv = e.metadata?.evidence_summary?.length > 20;
    const hasPh = Boolean(e.profile_image_url);
    const hasFin = e.financial_summary && Object.keys(e.financial_summary).length > 0;

    let sc = 0;
    if (hasBio) sc++;
    if (hasEv) sc++;
    if (hasPh) sc++;
    if (hasFin) sc++;
    if (d.count > 0) sc++;
    if (d.count > 5) sc++;
    if (ev.count > 0) sc++;
    if (connCount > 0) sc++;
    if (s.count > 0) sc++;
    if (cf.count > 0) sc++;

    out.push({ name: e.name, tier: e.tier, cat: e.category || '-', sc, bio: hasBio, ev: hasEv, ph: hasPh, fi: hasFin, docs: d.count, events: ev.count, conns: connCount, stories: s.count, cf: cf.count });
  }

  out.sort((a, b) => a.sc - b.sc || a.tier - b.tier);

  const y = v => v ? 'Y' : '-';
  console.log(`Published: ${out.length} entities\n`);
  console.log('Name'.padEnd(28) + 'T  Cat'.padEnd(15) + 'Sc Bio Ev  Ph  Fi Docs Evts Conn Stor CF');
  console.log('-'.repeat(100));
  for (const r of out) {
    console.log(
      r.name.substring(0, 27).padEnd(28) +
      `${r.tier}  ${r.cat.substring(0, 10)}`.padEnd(15) +
      String(r.sc).padStart(2) + '  ' +
      y(r.bio).padEnd(4) + y(r.ev).padEnd(4) + y(r.ph).padEnd(4) + y(r.fi).padEnd(3) +
      String(r.docs).padStart(4) + String(r.events).padStart(5) +
      String(r.conns).padStart(5) + String(r.stories).padStart(5) + String(r.cf).padStart(3)
    );
  }

  const thin = out.filter(r => r.sc <= 3);
  const med = out.filter(r => r.sc > 3 && r.sc <= 6);
  const rich = out.filter(r => r.sc > 6);
  console.log(`\nSummary: ${thin.length} thin (0-3), ${med.length} medium (4-6), ${rich.length} rich (7-10)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (phaseArg === 'all' || phaseArg === '1') await phase1Cleanup();
  if (phaseArg === 'all' || phaseArg === '2') await phase2Connections();
  if (phaseArg === 'all' || phaseArg === '3') await phase3Audit();
}

main().catch(console.error);
