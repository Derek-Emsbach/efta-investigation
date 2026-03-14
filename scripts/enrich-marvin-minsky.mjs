/**
 * Marvin Minsky Entity Profile Enrichment
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
    .eq('name', 'Marvin Minsky')
    .single();

  if (error || !entity) {
    console.log('Marvin Minsky entity not found:', error?.message);
    return;
  }

  console.log(`Found: ${entity.name} (T${entity.tier}, ${entity.id})`);
  console.log(`Current bio: ${entity.bio ? entity.bio.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`Current evidence_summary: ${entity.metadata?.evidence_summary ? 'YES' : 'NONE'}`);

  // ─── 1. Enriched Bio ───────────────────────────────────────────────────────
  const bio = `Marvin Lee Minsky (1927–2016), cognitive scientist and co-founder of MIT's Artificial Intelligence Laboratory. Widely considered a founding father of artificial intelligence. Named in victim Virginia Giuffre's handwritten journals listing men she was directed to have sexual encounters with by Jeffrey Epstein and Ghislaine Maxwell. Giuffre separately testified in deposition that she was directed to have sex with Minsky on Epstein's private island, Little St. James. Listed in Epstein's contact directory. Epstein was a significant donor to MIT and the MIT Media Lab, a relationship that became the subject of internal MIT investigations and the resignation of Media Lab director Joi Ito in 2019. Minsky died January 24, 2016, at age 88. Never criminally charged. Named as Tier 1 (Direct Evidence) based on victim journal entries and deposition testimony.`;

  // ─── 2. Evidence Summary ───────────────────────────────────────────────────
  const evidenceSummary = `MARVIN MINSKY — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named in Virginia Giuffre's handwritten journals documenting men she was directed to have sexual encounters with. Additionally, Giuffre testified in her 2016 deposition in Giuffre v. Maxwell that she was "ichDirected to have sex with Marvin Minsky" on Epstein's private island. Two independent evidence sources (journal + sworn testimony).

KEY EVIDENCE:
1. Giuffre victim journals — handwritten entry naming "Marvin Minsky" among men provided for sexual encounters
2. Giuffre deposition testimony (2016, Giuffre v. Maxwell) — sworn statement that she was directed to have sex with Minsky on Little St. James
3. Epstein contact directory — Minsky listed with contact information
4. Epstein-MIT financial relationship — Epstein donated to MIT AI Lab and Media Lab; Minsky was a senior figure at MIT
5. Joi Ito resignation (2019) — MIT Media Lab director resigned after New Yorker exposé revealed lab's financial ties to Epstein, including facilitation by Minsky

PROSECUTION STATUS: Never criminally charged. Deceased (January 24, 2016). Protected by 2007 NPA blanket immunity provision during lifetime. Death precludes any future prosecution. Minsky's estate has not been subject to civil action related to Epstein allegations.

CONNECTIONS: Jeffrey Epstein (principal — contact directory, financial donor to MIT, island visits), Ghislaine Maxwell (facilitator — journal context), MIT/Media Lab (institutional connection — Epstein funding pipeline).

NOTE: Minsky's case is notable because it involves both journal entries AND sworn deposition testimony — two independent evidence streams. His role as a pioneering AI scientist and Epstein's financial relationship with MIT raise questions about institutional complicity in enabling access. Tier classification reflects evidence strength per established framework, not a determination of guilt.`;

  // ─── 3. Update Entity ──────────────────────────────────────────────────────
  console.log('\n--- Updating entity record ---');

  const updates = {
    bio,
    status: 'deceased',
    aliases: ['Marvin Minsky', 'Marvin Lee Minsky'],
    tier_justification: 'Named in Virginia Giuffre\'s handwritten victim journals AND sworn deposition testimony stating she was directed to have sex with Minsky on Epstein\'s island. Two independent evidence sources. Listed in Epstein contact directory.',
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
      title: 'Marvin Minsky named in Giuffre victim journals',
      description: 'Virginia Giuffre\'s handwritten journals, later forensically authenticated, include Marvin Minsky among men she was directed by Epstein and Maxwell to have sexual encounters with. Journals written contemporaneously during Giuffre\'s period of exploitation (2000-2002).',
      date: '2001-01-01',
      date_precision: 'year',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: 'Giuffre alleges directed sexual encounter with Minsky on Little St. James',
      description: 'Virginia Giuffre later testified in deposition that she was directed to have sex with Marvin Minsky on Jeffrey Epstein\'s private island, Little St. James, in the U.S. Virgin Islands. This constitutes a second independent evidence stream beyond the journal entries.',
      date: '2001-06-01',
      date_precision: 'year',
      event_type: 'evidence',
      significance: 'critical',
    },
    {
      title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
      description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Marvin Minsky potentially covered as a journal-named individual.',
      date: '2007-09-24',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Marvin Minsky dies at age 88',
      description: 'AI pioneer Marvin Minsky dies on January 24, 2016. His death precludes any future criminal prosecution related to allegations in Giuffre\'s journals and deposition testimony.',
      date: '2016-01-24',
      event_type: 'personal',
      significance: 'high',
    },
    {
      title: 'Giuffre deposes in Giuffre v. Maxwell, names Minsky',
      description: 'Virginia Giuffre gives sworn deposition testimony in her civil case against Ghislaine Maxwell, stating she was directed to have sex with Marvin Minsky on Epstein\'s private island. This testimony, later unsealed, provides a second evidence stream independent of the handwritten journals.',
      date: '2016-05-01',
      date_precision: 'month',
      event_type: 'legal',
      significance: 'critical',
    },
    {
      title: 'Joi Ito resigns from MIT Media Lab over Epstein ties',
      description: 'MIT Media Lab director Joi Ito resigns after New Yorker investigation reveals lab accepted donations from Epstein, with Minsky identified as a facilitating figure in the Epstein-MIT relationship. Raises questions about institutional complicity.',
      date: '2019-09-07',
      event_type: 'institutional',
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
    { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Contact directory listing. Financial donor to MIT AI Lab. Giuffre alleges directed sexual encounter on Epstein\'s island. Journals + deposition testimony.', strength: 'documented' },
    { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as facilitator in Giuffre journal context. Giuffre alleges Maxwell directed encounters with journal-named men including Minsky.', strength: 'alleged' },
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
    .textSearch('search_vector', 'Minsky', { type: 'plain' })
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
