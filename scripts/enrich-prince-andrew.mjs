/**
 * Prince Andrew Entity Profile Enrichment
 *
 * Enriches the Prince Andrew entity with:
 * - Comprehensive bio
 * - Evidence summary
 * - Timeline events
 * - Connections to other entities
 * - Document links from existing entity_documents
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
  // Get Prince Andrew entity
  const { data: entity, error } = await sb.from('entities')
    .select('*')
    .eq('name', 'Prince Andrew')
    .single();

  if (error || !entity) {
    console.log('Prince Andrew entity not found:', error?.message);
    return;
  }

  console.log(`Found: ${entity.name} (T${entity.tier}, ${entity.id})`);
  console.log(`Current bio: ${entity.bio ? entity.bio.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`Current evidence_summary: ${entity.metadata?.evidence_summary ? 'YES' : 'NONE'}`);

  // ─── 1. Enriched Bio ───────────────────────────────────────────────────────
  const bio = `Prince Andrew, Duke of York (born 1960), second son of Queen Elizabeth II. Named in multiple victim testimonies in Virginia Giuffre's civil lawsuit (Giuffre v. Prince Andrew, 1:21-cv-06702, SDNY), which alleged sexual abuse on three occasions in 2001 at ages 17. Settled the civil case in February 2022 for an undisclosed sum reported at approximately £12 million. Photographed with Giuffre and Ghislaine Maxwell at Maxwell's London townhouse in 2001. Flight logs document at least one trip on Epstein's Boeing 727. Stripped of royal patronages and military titles by Buckingham Palace in January 2022. Never criminally charged. Named in Epstein's victim journals (journal "blackbook" entries). Protected by 2007 NPA blanket immunity provision covering unnamed co-conspirators.`;

  // ─── 2. Evidence Summary ───────────────────────────────────────────────────
  const evidenceSummary = `PRINCE ANDREW — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named by victim Virginia Giuffre in sworn testimony and civil complaint as having sexually abused her on three occasions in 2001 — in London, New York, and on Epstein's private island. Photograph places him with Giuffre and Maxwell. Flight log entries document travel on Epstein aircraft.

KEY EVIDENCE:
1. Giuffre v. Prince Andrew civil complaint (1:21-cv-06702, SDNY) — detailed allegations of sexual abuse at 17
2. 2001 photograph with Virginia Giuffre and Ghislaine Maxwell at Maxwell's London residence
3. Epstein flight log entries documenting travel on Boeing 727
4. Giuffre's deposition testimony in Giuffre v. Maxwell naming Andrew specifically
5. February 2022 civil settlement (reportedly ~£12M) — not an admission but resolved all claims
6. Epstein "black book" entries listing Prince Andrew with multiple contact numbers
7. BBC Newsnight interview (November 2019) — Andrew's own statements contradicting witness accounts

PROSECUTION STATUS: Never criminally charged. Protected by US-UK jurisdictional complexity. 2007 NPA blanket immunity provision may apply. UK Metropolitan Police reviewed allegations twice (2015, 2022) — no investigation opened.

CONNECTIONS: Ghislaine Maxwell (primary recruiter/facilitator), Jeffrey Epstein (principal), Virginia Giuffre (victim/accuser), Alan Dershowitz (co-accused in Giuffre testimony, both denied allegations).

REDACTION NOTE: Prince Andrew's name appears unredacted in most EFTA documents due to his public profile and the Giuffre civil case being a matter of public record.`;

  // ─── 3. Update Entity ──────────────────────────────────────────────────────
  console.log('\n--- Updating entity record ---');

  const updates = {
    bio,
    status: 'settled',
    aliases: ['Prince Andrew', 'Duke of York', 'Andrew Albert Christian Edward', 'HRH The Duke of York'],
    tier_justification: 'Named by victim Virginia Giuffre in sworn testimony as having sexually abused her on three occasions in 2001. Photograph with Giuffre and Maxwell. Flight log entries. Civil settlement February 2022.',
    metadata: {
      ...entity.metadata,
      evidence_summary: evidenceSummary,
    },
    profile_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Prince_Andrew_August_2014_%28cropped%29.jpg/220px-Prince_Andrew_August_2014_%28cropped%29.jpg',
  };

  if (!dryRun) {
    const { error: updateErr } = await sb.from('entities').update(updates).eq('id', entity.id);
    if (updateErr) console.log('  ERROR:', updateErr.message);
    else console.log('  ✓ Entity updated (bio, evidence_summary, aliases, photo, status, tier_justification)');
  } else {
    console.log('  Would update: bio, evidence_summary, aliases, photo, status, tier_justification');
  }

  // ─── 4. Timeline Events ───────────────────────────────────────────────────
  console.log('\n--- Creating timeline events ---');

  // Check existing events
  const { data: existingEvents } = await sb.from('entity_events')
    .select('event_id, events(title)')
    .eq('entity_id', entity.id);
  console.log(`  Existing events: ${existingEvents?.length || 0}`);

  const events = [
    {
      title: 'Prince Andrew meets Virginia Giuffre in London',
      description: 'Virginia Giuffre (then Roberts), age 17, alleges she was trafficked by Ghislaine Maxwell to meet Prince Andrew at Maxwell\'s London townhouse. Photograph taken of Andrew with his arm around Giuffre, Maxwell in background.',
      date: '2001-03-10',
      event_type: 'personal',
      significance: 'critical',
    },
    {
      title: 'Prince Andrew alleged abuse — New York',
      description: 'Giuffre alleges second encounter with Prince Andrew at Epstein\'s Manhattan townhouse (9 East 71st Street). Claims she was directed by Epstein and Maxwell.',
      date: '2001-04-01',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: 'Prince Andrew alleged abuse — Little St. James',
      description: 'Giuffre alleges third encounter with Prince Andrew on Epstein\'s private island in the U.S. Virgin Islands. Claims orgy with other young women present.',
      date: '2001-05-01',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
      description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Prince Andrew potentially covered.',
      date: '2007-09-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'UK Metropolitan Police declines to investigate Prince Andrew',
      description: 'Scotland Yard reviews allegations against Prince Andrew following Giuffre\'s public statements. Decides not to open a formal investigation, citing jurisdictional issues.',
      date: '2015-01-15',
      event_type: 'legal',
      significance: 'high',
    },
    {
      title: 'Prince Andrew BBC Newsnight interview',
      description: 'Prince Andrew gives disastrous interview to Emily Maitlis denying all allegations. Claims he cannot sweat (contradicting Giuffre\'s account), says he has no recollection of meeting Giuffre, and describes Epstein\'s behavior as "unbecoming."',
      date: '2019-11-16',
      event_type: 'communication',
      significance: 'high',
    },
    {
      title: 'Giuffre v. Prince Andrew civil lawsuit filed',
      description: 'Virginia Giuffre files civil lawsuit against Prince Andrew in SDNY (Case No. 1:21-cv-06702) under the New York Child Victims Act, alleging sexual abuse and battery.',
      date: '2021-08-09',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Prince Andrew stripped of royal titles and patronages',
      description: 'Buckingham Palace announces Prince Andrew has returned his military affiliations and royal patronages to Queen Elizabeth II, effective immediately. He will no longer use the style "His Royal Highness."',
      date: '2022-01-13',
      event_type: 'institutional',
      significance: 'high',
    },
    {
      title: 'Giuffre v. Prince Andrew civil settlement',
      description: 'Prince Andrew settles Virginia Giuffre\'s civil lawsuit for an undisclosed sum, reportedly approximately £12 million. Settlement includes a donation to Giuffre\'s victims\' rights charity. Not an admission of liability.',
      date: '2022-02-15',
      event_type: 'legal',
      significance: 'critical',
    },
  ];

  if (!dryRun) {
    for (const evt of events) {
      // Create event
      const { data: newEvent, error: evtErr } = await sb.from('events').insert({
        title: evt.title,
        description: evt.description,
        date: evt.event_date,
        event_type: evt.event_type,
        significance: evt.significance,
      }).select('id').single();

      if (evtErr) {
        console.log(`  ERROR creating event "${evt.title}": ${evtErr.message}`);
        continue;
      }

      // Link event to entity
      const { error: linkErr } = await sb.from('entity_events').insert({
        entity_id: entity.id,
        event_id: newEvent.id,
        role: 'subject',
      });

      if (linkErr) console.log(`  ERROR linking event: ${linkErr.message}`);
      else console.log(`  ✓ ${evt.event_date} — ${evt.title}`);
    }
  } else {
    for (const evt of events) {
      console.log(`  Would create: ${evt.event_date} — ${evt.title}`);
    }
  }

  // ─── 5. Connections ────────────────────────────────────────────────────────
  console.log('\n--- Creating connections ---');

  // Get entity IDs for connections
  const connectionTargets = [
    { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Alleged sexual abuse facilitated by Epstein. Flight logs, property visits, photographs.', strength: 'documented' },
    { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as primary facilitator who recruited Giuffre for Andrew. Photograph together. Maxwell\'s London townhouse as abuse location.', strength: 'documented' },
    { name: 'Alan Dershowitz', type: 'connected_to', desc: 'Both named by Virginia Giuffre as having been provided for sexual abuse. Both deny allegations. Dershowitz represented Epstein in 2007 NPA negotiations.', strength: 'alleged' },
    { name: 'Jean-Luc Brunel', type: 'connected_to', desc: 'Both named in Giuffre testimony. Brunel\'s MC2 modeling agency alleged to have provided victims to Epstein\'s network.', strength: 'circumstantial' },
  ];

  // Check existing connections
  const { data: existingConns } = await sb.from('entity_connections')
    .select('entity_a, entity_b')
    .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
  const connectedIds = new Set();
  for (const c of existingConns || []) {
    connectedIds.add(c.entity_a === entity.id ? c.entity_b : c.entity_a);
  }

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

  // ─── 6. Search for documents mentioning Prince Andrew ──────────────────────
  console.log('\n--- Searching for documents mentioning Prince Andrew ---');

  // Search by text content
  const { data: docs, error: docErr } = await sb.from('documents')
    .select('id, bates_number, title, document_type, severity, page_count, date, summary')
    .textSearch('search_vector', 'Prince & Andrew', { type: 'plain' })
    .order('severity', { ascending: false, nullsFirst: false })
    .limit(30);

  console.log(`  Found ${docs?.length || 0} documents via full-text search`);

  // Check which ones are already linked
  const { data: linkedDocs } = await sb.from('entity_documents')
    .select('document_id')
    .eq('entity_id', entity.id);
  const linkedDocIds = new Set((linkedDocs || []).map(d => d.document_id));

  const newDocs = (docs || []).filter(d => !linkedDocIds.has(d.id));
  console.log(`  Already linked: ${linkedDocIds.size}, New to link: ${newDocs.length}`);

  if (newDocs.length > 0) {
    console.log('\n  New documents to link:');
    for (const d of newDocs.slice(0, 20)) {
      console.log(`    [${d.severity || '-'}] ${d.bates_number} — ${(d.title || 'Untitled').substring(0, 60)} (${d.page_count || '?'}pp)`);
    }

    if (!dryRun) {
      const inserts = newDocs.slice(0, 20).map(d => ({
        entity_id: entity.id,
        document_id: d.id,
        role_in_document: 'mentioned',
      }));

      const { error: linkErr } = await sb.from('entity_documents').insert(inserts);
      if (linkErr) console.log(`\n  ERROR linking documents: ${linkErr.message}`);
      else console.log(`\n  ✓ Linked ${inserts.length} new documents`);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══ ENRICHMENT SUMMARY ═══');
  console.log(`  Bio: ${bio.length} chars`);
  console.log(`  Evidence summary: ${evidenceSummary.length} chars`);
  console.log(`  Aliases: 4`);
  console.log(`  Photo: Wikimedia Commons`);
  console.log(`  Timeline events: ${events.length}`);
  console.log(`  Connections: ${connectionTargets.length}`);
  console.log(`  Documents linked: up to ${Math.min(newDocs.length, 20)}`);
}

main().catch(console.error);
