/**
 * Harvey Weinstein Entity Profile Enrichment
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
    .eq('name', 'Harvey Weinstein')
    .single();

  if (error || !entity) {
    console.log('Harvey Weinstein entity not found:', error?.message);
    return;
  }

  console.log(`Found: ${entity.name} (T${entity.tier}, ${entity.id})`);
  console.log(`Current bio: ${entity.bio ? entity.bio.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`Current evidence_summary: ${entity.metadata?.evidence_summary ? 'YES' : 'NONE'}`);

  // ─── 1. Enriched Bio ───────────────────────────────────────────────────────
  const bio = `Harvey Weinstein (born 1952), former film producer and co-founder of Miramax Films and The Weinstein Company. Convicted of rape and sexual assault in both New York (2020, conviction overturned 2024, retrial pending) and Los Angeles (2022, 16-year sentence). Named in victim Virginia Giuffre's handwritten journals listing men she was directed to have sexual encounters with by Jeffrey Epstein and Ghislaine Maxwell. Listed in Epstein's contact directory ("black book") with multiple phone numbers. Weinstein's own sexual predation — exposed by the New York Times and New Yorker in October 2017, igniting the #MeToo movement — operated through parallel mechanisms to Epstein's network: systematic abuse enabled by institutional protection and non-disclosure agreements. Named as Tier 1 (Direct Evidence) based on victim journal entries.`;

  // ─── 2. Evidence Summary ───────────────────────────────────────────────────
  const evidenceSummary = `HARVEY WEINSTEIN — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named in Virginia Giuffre's handwritten journals documenting men she was directed to have sexual encounters with. Journals authenticated forensically (gel pen analysis, contemporaneous entries). Additionally convicted of sex crimes in his own right (independent of Epstein case).

KEY EVIDENCE:
1. Giuffre victim journals — handwritten entry naming "Harvey Weinstein" among men provided for sexual encounters
2. Epstein "black book" contact directory — Harvey Weinstein listed with multiple contact numbers
3. Independent criminal convictions — convicted of rape (NY 2020, overturned 2024) and sexual assault (LA 2022)
4. Pattern evidence — Weinstein's own predatory network used similar mechanisms (NDAs, institutional enablers, power imbalance) to Epstein's operation

PROSECUTION STATUS (Epstein-related): Never criminally charged in connection with Epstein. Protected by 2007 NPA blanket immunity provision.

PROSECUTION STATUS (Independent): Convicted in New York (2020) on criminal sexual act and rape charges — sentence 23 years. Conviction overturned by NY Court of Appeals (2024) on procedural grounds; retrial pending. Convicted in Los Angeles (2022) on rape and sexual assault — sentence 16 years. Over 80 women have publicly accused Weinstein of sexual misconduct.

CONNECTIONS: Jeffrey Epstein (principal — contact directory, journals), Ghislaine Maxwell (facilitator — journal context).

NOTE: Weinstein's case is distinctive because he is a convicted sex offender independently of the Epstein network. His appearance in Giuffre's journals suggests overlap between Epstein's trafficking operation and Weinstein's predatory network. Both leveraged wealth, power, and institutional protection to victimize women. Tier classification reflects evidence strength per established framework.`;

  // ─── 3. Update Entity ──────────────────────────────────────────────────────
  console.log('\n--- Updating entity record ---');

  const updates = {
    bio,
    status: 'convicted',
    aliases: ['Harvey Weinstein', 'Harvey M. Weinstein'],
    tier_justification: 'Named in Virginia Giuffre\'s handwritten victim journals listing men she was directed to have sexual encounters with. Journals forensically authenticated. Listed in Epstein contact directory. Independently convicted of rape and sexual assault.',
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
      title: 'Harvey Weinstein named in Giuffre victim journals',
      description: 'Virginia Giuffre\'s handwritten journals, later forensically authenticated, include Harvey Weinstein among men she was directed by Epstein and Maxwell to have sexual encounters with. Journals written contemporaneously during Giuffre\'s period of exploitation (2000-2002).',
      date: '2001-01-01',
      date_precision: 'year',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
      description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Harvey Weinstein potentially covered as a journal-named individual.',
      date: '2007-09-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: '#MeToo movement exposes Weinstein\'s predatory network',
      description: 'New York Times and New Yorker investigations reveal decades of sexual harassment, assault, and rape by Harvey Weinstein. Over 80 women eventually come forward. The exposé ignites the global #MeToo movement. Weinstein\'s own predatory operation parallels mechanisms used by Epstein\'s network.',
      date: '2017-10-05',
      event_type: 'institutional',
      significance: 'high',
    },
    {
      title: 'Weinstein convicted of rape in New York',
      description: 'Harvey Weinstein convicted in New York on charges of criminal sexual act in the first degree and rape in the third degree. Sentenced to 23 years in prison. Conviction independent of Epstein case.',
      date: '2020-02-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Weinstein convicted of rape in Los Angeles',
      description: 'Harvey Weinstein convicted in Los Angeles of rape, forced oral copulation, and sexual penetration by foreign object. Sentenced to 16 years, consecutive to New York sentence.',
      date: '2022-12-19',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'New York conviction overturned on appeal',
      description: 'New York Court of Appeals overturns Weinstein\'s 2020 conviction on procedural grounds, ruling the trial judge improperly allowed testimony about prior uncharged conduct. Retrial ordered. Los Angeles conviction stands.',
      date: '2024-04-25',
      event_type: 'legal',
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
    { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Contact directory listing. Giuffre journals name Weinstein as directed sexual encounter. Both operated parallel predatory networks leveraging wealth and institutional protection.', strength: 'documented' },
    { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as facilitator in Giuffre journal context. Giuffre alleges Maxwell directed encounters with journal-named men including Weinstein.', strength: 'alleged' },
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
    .textSearch('search_vector', 'Weinstein', { type: 'plain' })
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
