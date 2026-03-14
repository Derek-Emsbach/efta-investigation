/**
 * George Mitchell Entity Profile Enrichment
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

const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('*** DRY RUN ***\n');

async function main() {
  const { data: entity, error } = await sb.from('entities')
    .select('*')
    .eq('name', 'George Mitchell')
    .single();

  if (error || !entity) {
    console.log('George Mitchell entity not found:', error?.message);
    return;
  }

  console.log(`Found: ${entity.name} (T${entity.tier}, ${entity.id})`);
  console.log(`Current bio: ${entity.bio ? entity.bio.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`Current evidence_summary: ${entity.metadata?.evidence_summary ? 'YES' : 'NONE'}`);

  // ─── 1. Enriched Bio ───────────────────────────────────────────────────────
  const bio = `George John Mitchell Jr. (born 1933), former United States Senator from Maine (1980–1995) and Senate Majority Leader (1989–1995). Named by victim Virginia Giuffre in sworn testimony as having received sexual services arranged by Jeffrey Epstein and Ghislaine Maxwell. Listed in Epstein's contact directory ("black book") with multiple phone numbers. Mitchell denied all allegations through his spokesperson. After leaving the Senate, Mitchell served as Special Envoy for Northern Ireland (brokering the 1998 Good Friday Agreement), chairman of The Walt Disney Company, and Special Envoy for Middle East Peace under President Obama. Mitchell has been affiliated with prominent law firm DLA Piper. Named as Tier 1 (Direct Evidence) based on victim testimony. Never criminally charged.`;

  // ─── 2. Evidence Summary ───────────────────────────────────────────────────
  const evidenceSummary = `GEORGE MITCHELL — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named by Virginia Giuffre in sworn deposition testimony (Giuffre v. Maxwell, unsealed 2019-2020) as having received sexual services arranged by Epstein. Giuffre testified she was sent to Mitchell's residence. Listed in Epstein contact directory with multiple numbers.

KEY EVIDENCE:
1. Giuffre deposition testimony (Giuffre v. Maxwell) — sworn statement naming George Mitchell as having received sexual services arranged by Epstein
2. Epstein "black book" contact directory — George Mitchell listed with multiple contact numbers and addresses
3. Giuffre victim journals — reference to encounters directed by Epstein/Maxwell
4. Political stature — former Senate Majority Leader, suggesting pattern of Epstein cultivating relationships with powerful political figures

PROSECUTION STATUS: Never criminally charged. Mitchell denied allegations through spokesperson. Protected by 2007 NPA blanket immunity provision covering unnamed co-conspirators. No known civil lawsuit filed against Mitchell in connection with Epstein case.

CONNECTIONS: Jeffrey Epstein (principal — contact directory, testimony allegations), Ghislaine Maxwell (facilitator — Giuffre testimony context), Bill Clinton (political circle — both Democrats with Epstein connections, though nature of connections differs).

NOTE: Mitchell's case illustrates Epstein's pattern of cultivating relationships across the political spectrum — Mitchell (Democrat, Senate Majority Leader) alongside figures like Donald Trump and Bill Clinton. His role brokering the Good Friday Agreement and other diplomatic achievements creates a complex public legacy. Tier classification reflects evidence strength per established framework, not a determination of guilt. Mitchell has denied all allegations.`;

  // ─── 3. Update Entity ──────────────────────────────────────────────────────
  console.log('\n--- Updating entity record ---');

  const updates = {
    bio,
    status: 'not_charged',
    aliases: ['George Mitchell', 'George J. Mitchell', 'George John Mitchell Jr.', 'Senator Mitchell'],
    tier_justification: 'Named by Virginia Giuffre in sworn deposition testimony as having received sexual services arranged by Epstein. Listed in Epstein contact directory. Giuffre testified she was sent to Mitchell\'s residence.',
    metadata: {
      ...entity.metadata,
      evidence_summary: evidenceSummary,
    },
  };

  if (!dryRun) {
    const { error: updateErr } = await sb.from('entities').update(updates).eq('id', entity.id);
    if (updateErr) console.log('  ERROR:', updateErr.message);
    else console.log('  ✓ Entity updated (bio, evidence_summary, aliases, status, tier_justification)');
  } else {
    console.log('  Would update: bio, evidence_summary, aliases, status, tier_justification');
  }

  // ─── 4. Timeline Events ───────────────────────────────────────────────────
  console.log('\n--- Creating timeline events ---');

  const { data: existingEvents } = await sb.from('entity_events')
    .select('event_id')
    .eq('entity_id', entity.id);
  console.log(`  Existing events: ${existingEvents?.length || 0}`);

  const events = [
    {
      title: 'Giuffre alleges sexual services arranged for George Mitchell',
      description: 'Virginia Giuffre later testified in sworn deposition that Jeffrey Epstein arranged for her to provide sexual services to George Mitchell at his residence. Giuffre was a minor or young adult at the time of the alleged encounters.',
      date: '2002-01-01',
      date_precision: 'year',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
      description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." George Mitchell potentially covered as a testimony-named individual.',
      date: '2007-09-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Giuffre deposes in Giuffre v. Maxwell, names Mitchell',
      description: 'Virginia Giuffre gives sworn deposition testimony in her civil case against Ghislaine Maxwell, naming George Mitchell among powerful men who received sexual services arranged by Epstein. This testimony would later be unsealed as part of EFTA disclosures.',
      date: '2016-05-01',
      date_precision: 'month',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Giuffre v. Maxwell depositions unsealed — Mitchell named publicly',
      description: 'Federal court unseals portions of Virginia Giuffre\'s deposition testimony from the Giuffre v. Maxwell case. George Mitchell is among prominent individuals named. Mitchell denies allegations through spokesperson.',
      date: '2019-08-09',
      event_type: 'legal',
      significance: 'high',
    },
    {
      title: 'Epstein contact directory released via EFTA',
      description: 'Epstein\'s "black book" contact directory released as part of EFTA disclosures. George Mitchell listed with multiple phone numbers and addresses, confirming direct contact relationship.',
      date: '2025-12-01',
      date_precision: 'month',
      event_type: 'evidence',
      significance: 'high',
    },
  ];

  if (!dryRun) {
    for (const evt of events) {
      const { data: newEvent, error: evtErr } = await sb.from('events').insert({
        title: evt.title,
        description: evt.description,
        date: evt.date,
        date_precision: evt.date_precision || 'day',
        event_type: evt.event_type,
        significance: evt.significance,
      }).select('id').single();

      if (evtErr) {
        console.log(`  ERROR creating event "${evt.title}": ${evtErr.message}`);
        continue;
      }

      const { error: linkErr } = await sb.from('entity_events').insert({
        entity_id: entity.id,
        event_id: newEvent.id,
        role: 'subject',
      });

      if (linkErr) console.log(`  ERROR linking event: ${linkErr.message}`);
      else console.log(`  ✓ ${evt.date} — ${evt.title}`);
    }
  } else {
    for (const evt of events) {
      console.log(`  Would create: ${evt.date} — ${evt.title}`);
    }
  }

  // ─── 5. Connections ────────────────────────────────────────────────────────
  console.log('\n--- Creating connections ---');

  const { data: existingConns } = await sb.from('entity_connections')
    .select('entity_a, entity_b')
    .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
  const connectedIds = new Set();
  for (const c of existingConns || []) {
    connectedIds.add(c.entity_a === entity.id ? c.entity_b : c.entity_a);
  }

  const connectionTargets = [
    { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Contact directory listing. Giuffre testimony alleges Epstein arranged sexual services with Mitchell. Direct principal-participant relationship.', strength: 'documented' },
    { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as facilitator in Giuffre testimony context. Maxwell trial evidence references Mitchell.', strength: 'alleged' },
    { name: 'Bill Clinton', type: 'connected_to', desc: 'Both prominent Democrats with documented Epstein connections. Both named in EFTA documents. Political circle overlap.', strength: 'circumstantial' },
  ];

  for (const ct of connectionTargets) {
    const { data: target } = await sb.from('entities').select('id, name').eq('name', ct.name).single();
    if (!target) { console.log(`  Skip: ${ct.name} not found`); continue; }
    if (connectedIds.has(target.id)) { console.log(`  Skip: ${ct.name} already connected`); continue; }

    if (!dryRun) {
      const { error: connErr } = await sb.from('entity_connections').insert({
        entity_a: entity.id,
        entity_b: target.id,
        relationship_type: ct.type,
        evidence_strength: ct.strength,
        description: ct.desc,
      });
      if (connErr) console.log(`  ERROR: ${ct.name} — ${connErr.message}`);
      else console.log(`  ✓ ${entity.name} ↔ ${target.name} (${ct.type})`);
    } else {
      console.log(`  Would create: ${entity.name} ↔ ${ct.name} (${ct.type})`);
    }
  }

  // ─── 6. Document search ────────────────────────────────────────────────────
  console.log('\n--- Searching for documents ---');

  const { data: docs } = await sb.from('documents')
    .select('id, bates_number, title, document_type, severity')
    .textSearch('search_vector', 'Mitchell & George', { type: 'plain' })
    .order('severity', { ascending: false, nullsFirst: false })
    .limit(20);

  const { data: linkedDocs } = await sb.from('entity_documents')
    .select('document_id')
    .eq('entity_id', entity.id);
  const linkedDocIds = new Set((linkedDocs || []).map(d => d.document_id));
  const newDocs = (docs || []).filter(d => !linkedDocIds.has(d.id));

  console.log(`  FTS results: ${docs?.length || 0}, already linked: ${linkedDocIds.size}, new: ${newDocs.length}`);

  if (newDocs.length > 0 && !dryRun) {
    const inserts = newDocs.map(d => ({
      entity_id: entity.id,
      document_id: d.id,
      role_in_document: 'mentioned',
    }));
    const { error: linkErr } = await sb.from('entity_documents').insert(inserts);
    if (linkErr) console.log(`  ERROR: ${linkErr.message}`);
    else console.log(`  ✓ Linked ${inserts.length} documents`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══ ENRICHMENT SUMMARY ═══');
  console.log(`  Bio: ${bio.length} chars`);
  console.log(`  Evidence summary: ${evidenceSummary.length} chars`);
  console.log(`  Timeline events: ${events.length}`);
  console.log(`  Connections: ${connectionTargets.length}`);
  console.log(`  New documents: ${newDocs.length}`);
}

main().catch(console.error);
