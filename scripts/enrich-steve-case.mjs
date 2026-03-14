/**
 * Steve Case Entity Profile Enrichment
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
    .eq('name', 'Steve Case')
    .single();

  if (error || !entity) {
    console.log('Steve Case entity not found:', error?.message);
    return;
  }

  console.log(`Found: ${entity.name} (T${entity.tier}, ${entity.id})`);
  console.log(`Current bio: ${entity.bio ? entity.bio.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`Current evidence_summary: ${entity.metadata?.evidence_summary ? 'YES' : 'NONE'}`);

  // ─── 1. Enriched Bio ───────────────────────────────────────────────────────
  const bio = `Stephen McConnell Case (born 1958), co-founder and former CEO/chairman of America Online (AOL). Named in victim Virginia Giuffre's handwritten journals listing men she was directed to have sexual encounters with by Jeffrey Epstein and Ghislaine Maxwell. Listed in Epstein's contact directory ("black book") with multiple phone numbers. Case co-founded AOL with Jim Kimsey (also named in journals) and led the company through the AOL-Time Warner merger in 2000. Currently chairman of Revolution LLC, an investment firm. Case is a prominent Washington, D.C. business figure and philanthropist. Never criminally charged in connection with the Epstein case. Named as Tier 1 (Direct Evidence) based on victim journal entries.`;

  // ─── 2. Evidence Summary ───────────────────────────────────────────────────
  const evidenceSummary = `STEVE CASE — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named in Virginia Giuffre's handwritten journals documenting men she was directed to have sexual encounters with. Journals authenticated forensically (gel pen analysis, contemporaneous entries). Same evidentiary basis as other Tier 1 classifications from journal entries.

KEY EVIDENCE:
1. Giuffre victim journals — handwritten entry naming "Steve Case" among men provided for sexual encounters
2. Epstein "black book" contact directory — Steve Case listed with multiple contact numbers
3. Washington D.C. social circle overlap — Case, Epstein, and other D.C.-area figures (Jim Kimsey, Dan Snyder, Ted Leonsis) form a geographic cluster in the journals
4. AOL co-founder connection — Case co-founded AOL with Jim Kimsey, both appear in journals

PROSECUTION STATUS: Never criminally charged. No known civil lawsuit filed in connection with Epstein allegations. Protected by 2007 NPA blanket immunity provision.

CONNECTIONS: Jeffrey Epstein (principal — contact directory), Ghislaine Maxwell (facilitator — journal context), Jim Kimsey (AOL co-founder, both named in journals), Dan Snyder (D.C. journal cluster), Ted Leonsis (D.C. journal cluster).

NOTE: Case's presence in victim journals constitutes direct testimonial evidence but has not been independently corroborated by additional EFTA documents beyond the journal entries and contact records. The AOL connection — both Case and co-founder Kimsey appearing in the same victim journals — suggests a D.C. tech industry pattern rather than coincidence. Tier classification reflects evidence strength per established framework, not a determination of guilt.`;

  // ─── 3. Update Entity ──────────────────────────────────────────────────────
  console.log('\n--- Updating entity record ---');

  const updates = {
    bio,
    status: 'not_investigated',
    aliases: ['Steve Case', 'Stephen Case', 'Stephen McConnell Case'],
    tier_justification: 'Named in Virginia Giuffre\'s handwritten victim journals listing men she was directed to have sexual encounters with. Journals forensically authenticated. Listed in Epstein contact directory. AOL co-founder Jim Kimsey also named in same journals.',
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
      title: 'Steve Case named in Giuffre victim journals',
      description: 'Virginia Giuffre\'s handwritten journals, later forensically authenticated, include Steve Case among men she was directed by Epstein and Maxwell to have sexual encounters with. Journals written contemporaneously during Giuffre\'s period of exploitation (2000-2002). Case\'s AOL co-founder Jim Kimsey also appears in the same journals.',
      date: '2001-01-01',
      date_precision: 'year',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
      description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Steve Case potentially covered as a journal-named individual.',
      date: '2007-09-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Epstein contact directory released via EFTA',
      description: 'Epstein\'s "black book" contact directory released as part of EFTA disclosures. Steve Case listed with multiple phone numbers, confirming direct contact relationship.',
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
    { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Contact directory listing with multiple phone numbers. Giuffre journals name Case as directed sexual encounter.', strength: 'documented' },
    { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as facilitator in Giuffre journal context. Giuffre alleges Maxwell directed encounters with journal-named men including Case.', strength: 'alleged' },
    { name: 'Jim Kimsey', type: 'connected_to', desc: 'AOL co-founders. Both named in Giuffre victim journals. D.C.-area tech figures. Geographic and professional cluster pattern.', strength: 'circumstantial' },
    { name: 'Ted Leonsis', type: 'connected_to', desc: 'Both named in Giuffre victim journals. Both D.C.-area business figures. Geographic cluster pattern.', strength: 'circumstantial' },
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
    .textSearch('search_vector', 'Case & Steve', { type: 'plain' })
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
