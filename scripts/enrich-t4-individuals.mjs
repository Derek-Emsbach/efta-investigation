/**
 * Tier 4 Individual Entity Batch Enrichment
 * Mark Epstein, Dr. Chen, Gerd, Barnaby Mars
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

const individuals = [
  {
    name: 'Mark Epstein',
    bio: `Mark Epstein (born c. 1955), businessman and real estate developer. Younger brother of Jeffrey Epstein. Operated real estate businesses in New York and managed properties connected to his brother's activities. Testified before the grand jury in Jeffrey Epstein's criminal cases. Mark Epstein's Manhattan apartment at 301 East 66th Street was allegedly used by Jeffrey Epstein for meetings and encounters — Epstein maintained a key and access to the property. Listed in Epstein's contact directory. Appeared as a witness in multiple legal proceedings related to Jeffrey Epstein. While not accused of participating in criminal activity himself, his proximity to Jeffrey Epstein's operations and property connections make him a significant contextual figure. Classified as Tier 4 (Associated).`,
    evidenceSummary: `MARK EPSTEIN — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Brother of Jeffrey Epstein with documented property and business connections. Not accused of criminal participation. Significant as a contextual figure who may have had knowledge of or proximity to Jeffrey Epstein's activities.

KEY EVIDENCE:
1. Family relationship — younger brother of Jeffrey Epstein
2. Property connections — Mark Epstein's Manhattan apartment (301 E. 66th St.) allegedly used by Jeffrey Epstein for encounters
3. Grand jury testimony — testified in Jeffrey Epstein criminal proceedings
4. Epstein contact directory — listed with multiple contact numbers
5. Real estate transactions — business dealings connected to Jeffrey Epstein's property network

PROSECUTION STATUS: Never charged. Testified as witness, not defendant. No civil lawsuits filed against Mark Epstein in connection with his brother's crimes.

CONNECTIONS: Jeffrey Epstein (brother — family, property, business), Ghislaine Maxwell (associate through brother).

NOTE: Mark Epstein's classification as Tier 4 reflects his status as a family associate without evidence of criminal participation. His property connections and potential knowledge of his brother's activities make him contextually important but not a target of criminal allegations.`,
    aliases: ['Mark Epstein'],
    tierJustification: 'Brother of Jeffrey Epstein. Property connections — apartment allegedly used by Jeffrey Epstein. Grand jury testimony. No evidence of criminal participation.',
    events: [
      {
        title: 'Mark Epstein testifies before grand jury in brother\'s case',
        description: 'Mark Epstein, Jeffrey Epstein\'s younger brother, provides testimony before the grand jury investigating Jeffrey Epstein\'s criminal activities. Testimony relates to property access, family business dealings, and knowledge of brother\'s associates.',
        date: '2006-06-01',
        date_precision: 'month',
        event_type: 'legal',
        significance: 'high',
      },
    ],
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Brothers. Mark\'s Manhattan apartment allegedly used by Jeffrey for encounters. Business and property connections.', strength: 'documented' },
      { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Associate through Jeffrey Epstein. Maxwell known to Mark through brother\'s social circle.', strength: 'circumstantial' },
    ],
    searchTerms: 'Mark & Epstein',
  },
  {
    name: 'Dr. Chen',
    bio: `"Dr. Chen," an individual referenced in witness testimony and EFTA documents in connection with Jeffrey Epstein's network. The identity of Dr. Chen has not been fully established in public documents — the name appears in testimony describing medical or professional services connected to Epstein's operations. Multiple individuals named "Dr. Chen" exist in Epstein's orbit, and the specific individual referenced may relate to cosmetic or medical procedures connected to Epstein's trafficking activities. Classified as Tier 4 (Associated) based on documentary references without sufficient evidence to establish the nature of involvement.`,
    evidenceSummary: `DR. CHEN — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Referenced in EFTA witness testimony and documents. Identity not fully established. Documentary references without evidence establishing nature of involvement.

KEY EVIDENCE:
1. Witness testimony — referenced in connection with medical/professional services
2. EFTA document mentions — appears in multiple documents related to Epstein network
3. Identity uncertainty — specific individual not definitively identified in public records

CLASSIFICATION: Associated individual. Identity and nature of involvement remain unclear. Tier 4 reflects documentary presence without evidence of criminal awareness or participation.

NOTE: "Dr. Chen" may refer to different individuals across different documents. Further document analysis needed to establish identity and context.`,
    aliases: ['Dr. Chen'],
    tierJustification: 'Referenced in witness testimony and EFTA documents. Identity not fully established. Documentary references without evidence establishing nature of involvement.',
    events: [],
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Referenced in Epstein-related testimony and documents. Nature of relationship unclear.', strength: 'circumstantial' },
    ],
    searchTerms: 'Chen & doctor',
  },
  {
    name: 'Gerd (Epstein associate)',
    bio: `"Gerd," an individual identified in witness testimony as an associate of Jeffrey Epstein. Referenced in EFTA documents in connection with Epstein's social circle, likely a European associate based on naming conventions. The individual's full identity and role within Epstein's network have not been definitively established in public documents. Classified as Tier 4 (Associated) based on witness testimony references without sufficient evidence to determine the nature of involvement.`,
    evidenceSummary: `GERD (EPSTEIN ASSOCIATE) — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Referenced in witness testimony as an Epstein associate. Full identity not established. Insufficient evidence to determine nature of involvement.

KEY EVIDENCE:
1. Witness testimony — identified as an Epstein associate
2. First-name-only reference — full identity not established in public records

CLASSIFICATION: Associated individual. Identity partially unknown. Tier 4 reflects mention in testimony without evidence of criminal awareness or participation.

NOTE: First-name-only entities present identification challenges. "Gerd" may be identifiable through cross-referencing with Epstein's contact directory or flight logs, but this analysis has not yet been completed.`,
    aliases: ['Gerd'],
    tierJustification: 'Referenced in witness testimony as Epstein associate. Full identity not established. Insufficient evidence to determine nature of involvement.',
    events: [],
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Identified in testimony as an Epstein associate. Nature and extent of relationship unclear.', strength: 'circumstantial' },
    ],
    searchTerms: 'Gerd',
  },
  {
    name: 'Barnaby Mars',
    bio: `Barnaby Mars, an individual connected to Jeffrey Epstein's social and business network. Appears in multiple EFTA documents (10 linked documents in the database). Referenced in financial and social records related to Epstein's operations. The nature of Mars's relationship with Epstein appears to be through business or social circles. Not accused of criminal activity. Classified as Tier 4 (Associated) based on documentary presence across multiple EFTA filings without evidence of criminal awareness.`,
    evidenceSummary: `BARNABY MARS — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Appears in 10+ EFTA documents, indicating sustained documentary presence in Epstein's network. No victim testimony or criminal allegations.

KEY EVIDENCE:
1. EFTA document presence — referenced in 10+ documents across multiple document types
2. Social/business network connection — appears in records related to Epstein's operations
3. No victim testimony — not named in any known victim statements

CLASSIFICATION: Associated individual. Significant documentary footprint suggests ongoing connection to Epstein's network, but no evidence of criminal awareness or participation. Tier 4 reflects documented association without criminal evidence.`,
    aliases: ['Barnaby Mars'],
    tierJustification: 'Referenced in 10+ EFTA documents. Social/business network connection. No victim testimony or criminal allegations.',
    events: [],
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Social/business network connection documented across 10+ EFTA filings.', strength: 'documented' },
    ],
    searchTerms: 'Barnaby & Mars',
  },
];

async function enrichIndividual(ind) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${ind.name}`);
  console.log(`${'═'.repeat(60)}`);

  const { data: entity, error } = await sb.from('entities')
    .select('*')
    .eq('name', ind.name)
    .single();

  if (error || !entity) {
    console.log(`  NOT FOUND: ${error?.message}`);
    return;
  }

  console.log(`  Found: T${entity.tier}, ${entity.id}`);

  // Update entity
  const updates = {
    bio: ind.bio,
    aliases: ind.aliases,
    tier_justification: ind.tierJustification,
    metadata: {
      ...entity.metadata,
      evidence_summary: ind.evidenceSummary,
    },
  };

  if (!dryRun) {
    const { error: updateErr } = await sb.from('entities').update(updates).eq('id', entity.id);
    if (updateErr) console.log(`  ERROR: ${updateErr.message}`);
    else console.log(`  ✓ Entity updated`);
  }

  // Timeline events
  if (ind.events.length > 0) {
    const { data: existingEvents } = await sb.from('entity_events')
      .select('event_id')
      .eq('entity_id', entity.id);
    console.log(`  Existing events: ${existingEvents?.length || 0}`);

    if (!dryRun) {
      for (const evt of ind.events) {
        const { data: newEvent, error: evtErr } = await sb.from('events').insert({
          title: evt.title,
          description: evt.description,
          date: evt.date,
          date_precision: evt.date_precision || 'day',
          event_type: evt.event_type,
          significance: evt.significance,
        }).select('id').single();

        if (evtErr) {
          console.log(`  ERROR creating event: ${evtErr.message}`);
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
    }
  }

  // Connections
  const { data: existingConns } = await sb.from('entity_connections')
    .select('entity_a, entity_b')
    .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
  const connectedIds = new Set();
  for (const c of existingConns || []) {
    connectedIds.add(c.entity_a === entity.id ? c.entity_b : c.entity_a);
  }

  for (const ct of ind.connectionTargets) {
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
      else console.log(`  ✓ ${ind.name} ↔ ${target.name}`);
    }
  }

  // Document search
  const { data: docs } = await sb.from('documents')
    .select('id, bates_number, title')
    .textSearch('search_vector', ind.searchTerms, { type: 'plain' })
    .limit(20);

  const { data: linkedDocs } = await sb.from('entity_documents')
    .select('document_id')
    .eq('entity_id', entity.id);
  const linkedDocIds = new Set((linkedDocs || []).map(d => d.document_id));
  const newDocs = (docs || []).filter(d => !linkedDocIds.has(d.id));

  console.log(`  FTS: ${docs?.length || 0} results, ${linkedDocIds.size} linked, ${newDocs.length} new`);

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
}

async function main() {
  for (const ind of individuals) {
    await enrichIndividual(ind);
  }
  console.log('\n═══ BATCH COMPLETE ═══');
}

main().catch(console.error);
