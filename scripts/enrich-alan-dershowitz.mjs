/**
 * Alan Dershowitz Entity Profile Enrichment
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
    .eq('name', 'Alan Dershowitz')
    .single();

  if (error || !entity) {
    console.log('Alan Dershowitz entity not found:', error?.message);
    return;
  }

  console.log(`Found: ${entity.name} (T${entity.tier}, ${entity.id})`);
  console.log(`Current bio: ${entity.bio ? entity.bio.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`Current evidence_summary: ${entity.metadata?.evidence_summary ? 'YES' : 'NONE'}`);

  // ─── 1. Enriched Bio ───────────────────────────────────────────────────────
  const bio = `Alan Morton Dershowitz (born 1938), Harvard Law School professor emeritus and prominent defense attorney. Named by victim Virginia Giuffre in sworn testimony as having sexually abused her on multiple occasions at Jeffrey Epstein's properties, including Epstein's New Mexico ranch and private island. Dershowitz has vehemently denied all allegations. He served as one of Epstein's defense attorneys and helped negotiate the controversial 2007 Non-Prosecution Agreement (NPA) that granted blanket immunity to unnamed co-conspirators — an agreement that would later shield individuals like himself. Flight logs document multiple trips on Epstein's aircraft. Listed in Epstein's contact directory. Giuffre sued Dershowitz for defamation in 2019; the case was settled in 2022 with Giuffre stating she "may have made a mistake" identifying Dershowitz — though she did not retract her sworn testimony. Named as Tier 1 (Direct Evidence) based on victim testimony and flight log documentation.`;

  // ─── 2. Evidence Summary ───────────────────────────────────────────────────
  const evidenceSummary = `ALAN DERSHOWITZ — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named by Virginia Giuffre in sworn deposition testimony (Giuffre v. Maxwell) as having sexually abused her on multiple occasions at Epstein properties. Flight logs document extensive travel on Epstein aircraft. Served as Epstein's defense attorney and NPA negotiator — dual role as both alleged participant and legal protector.

KEY EVIDENCE:
1. Giuffre deposition testimony (Giuffre v. Maxwell) — sworn statement naming Dershowitz as having sexually abused her at multiple Epstein properties
2. Giuffre victim journals — reference to encounters with Dershowitz
3. Epstein flight logs — multiple documented trips on Epstein aircraft (Boeing 727 "Lolita Express")
4. Epstein contact directory — Dershowitz listed with multiple contact numbers
5. 2007 NPA negotiation — Dershowitz served as Epstein's defense attorney and helped draft the immunity provision that potentially shields himself
6. Giuffre v. Dershowitz defamation suit (2019-2022) — settled with ambiguous statement from Giuffre
7. Contemporaneous emails — communications between Dershowitz and Epstein discussing legal strategy

PROSECUTION STATUS: Never criminally charged. Dershowitz himself helped negotiate the 2007 NPA's blanket immunity provision covering unnamed co-conspirators. Giuffre v. Dershowitz defamation suit settled November 2022 — Giuffre's statement that she "may have made a mistake" did not constitute a retraction of sworn testimony. No pending legal proceedings.

DUAL ROLE CONFLICT: Dershowitz's position as both (a) Epstein's defense attorney who negotiated immunity provisions and (b) an individual named in victim testimony as a participant represents an extraordinary conflict of interest. He effectively helped draft the legal document that could shield himself from prosecution.

CONNECTIONS: Jeffrey Epstein (client/principal — legal representation, property visits, flight logs), Ghislaine Maxwell (facilitator — named in Giuffre testimony context), Virginia Giuffre (accuser — sworn testimony, defamation litigation), Prince Andrew (co-accused — both named by Giuffre, both deny allegations), Kenneth Starr (co-counsel on Epstein defense team).

NOTE: The 2022 settlement statement from Giuffre has been interpreted differently by different parties. Dershowitz treats it as exoneration; legal analysts note that settlement statements are not equivalent to retraction of sworn testimony, and Giuffre's deposition remains part of the court record. Tier classification reflects evidence strength per established framework, not a determination of guilt.`;

  // ─── 3. Update Entity ──────────────────────────────────────────────────────
  console.log('\n--- Updating entity record ---');

  const updates = {
    bio,
    status: 'not_charged',
    aliases: ['Alan Dershowitz', 'Alan M. Dershowitz', 'Alan Morton Dershowitz', 'Professor Dershowitz'],
    tier_justification: 'Named by Virginia Giuffre in sworn deposition testimony as having sexually abused her at multiple Epstein properties. Flight logs document extensive travel on Epstein aircraft. Served as Epstein\'s defense attorney who helped negotiate NPA immunity — extraordinary dual role conflict.',
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
      title: 'Giuffre alleges sexual abuse by Dershowitz at Epstein properties',
      description: 'Virginia Giuffre later testified in sworn deposition that Alan Dershowitz sexually abused her on multiple occasions at Jeffrey Epstein\'s properties, including his New Mexico ranch and private island Little St. James.',
      date: '2001-01-01',
      date_precision: 'year',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: 'Dershowitz helps negotiate 2007 NPA with blanket immunity',
      description: 'Alan Dershowitz, as part of Epstein\'s defense team, helps negotiate the Non-Prosecution Agreement with the US Attorney\'s Office (SDFL). The NPA includes an unprecedented provision granting immunity to unnamed "potential co-conspirators" — a clause that could shield Dershowitz himself from prosecution.',
      date: '2007-09-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Giuffre deposes in Giuffre v. Maxwell, names Dershowitz',
      description: 'Virginia Giuffre gives sworn deposition testimony in her civil case against Ghislaine Maxwell, naming Alan Dershowitz among men who sexually abused her at Epstein properties. This testimony would later be unsealed.',
      date: '2016-05-01',
      date_precision: 'month',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Giuffre files defamation lawsuit against Dershowitz',
      description: 'Virginia Giuffre sues Alan Dershowitz for defamation in New York federal court after Dershowitz publicly called her a liar. The case centers on Giuffre\'s allegations of sexual abuse at Epstein properties.',
      date: '2019-04-16',
      event_type: 'legal',
      significance: 'high',
    },
    {
      title: 'Giuffre v. Dershowitz defamation suit settled',
      description: 'Virginia Giuffre settles her defamation lawsuit against Alan Dershowitz. In a joint statement, Giuffre says she "may have made a mistake" in identifying Dershowitz. Dershowitz claims vindication. Legal analysts note the statement is not a retraction of sworn testimony.',
      date: '2022-11-08',
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
    { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Defense attorney and NPA negotiator. Flight log entries. Named in Giuffre testimony as abuse participant at Epstein properties. Dual role: legal representative AND alleged participant.', strength: 'documented' },
    { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as facilitator in Giuffre testimony context. Dershowitz participated in Maxwell trial commentary.', strength: 'alleged' },
    { name: 'Prince Andrew', type: 'connected_to', desc: 'Both named by Virginia Giuffre as having sexually abused her. Both deny allegations. Both protected by 2007 NPA immunity provision.', strength: 'alleged' },
    { name: 'Kenneth Starr', type: 'connected_to', desc: 'Co-counsel on Epstein defense team. Both involved in negotiating 2007 NPA.', strength: 'documented' },
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
    .textSearch('search_vector', 'Dershowitz', { type: 'plain' })
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
