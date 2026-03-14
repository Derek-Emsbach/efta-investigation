/**
 * Remaining T1 Entity Enrichment: Bill Clinton, Jean-Luc Brunel, Larry Summers
 * These need full enrichment (bio, evidence_summary, events, connections)
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

async function enrichEntity(config) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${config.name}`);
  console.log(`${'═'.repeat(60)}`);

  const { data: entity, error } = await sb.from('entities')
    .select('*')
    .eq('name', config.name)
    .single();

  if (error || !entity) {
    console.log(`  NOT FOUND: ${error?.message}`);
    return;
  }

  console.log(`  Found: T${entity.tier}, ${entity.id}`);
  console.log(`  Current bio: ${entity.bio ? entity.bio.substring(0, 60) + '...' : 'NONE'}`);

  // Update entity
  const updates = {
    bio: config.bio,
    tier_justification: config.tierJustification,
    metadata: {
      ...entity.metadata,
      evidence_summary: config.evidenceSummary,
    },
  };
  if (config.status) updates.status = config.status;

  if (!dryRun) {
    const { error: updateErr } = await sb.from('entities').update(updates).eq('id', entity.id);
    if (updateErr) console.log(`  ERROR: ${updateErr.message}`);
    else console.log(`  ✓ Entity updated`);
  }

  // Timeline events
  if (config.events?.length > 0) {
    const { data: existingEvents } = await sb.from('entity_events')
      .select('event_id')
      .eq('entity_id', entity.id);
    console.log(`  Existing events: ${existingEvents?.length || 0}`);

    if (!dryRun) {
      for (const evt of config.events) {
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
    }
  }

  // Connections
  if (config.connectionTargets?.length > 0) {
    const { data: existingConns } = await sb.from('entity_connections')
      .select('entity_a, entity_b')
      .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
    const connectedIds = new Set();
    for (const c of existingConns || []) {
      connectedIds.add(c.entity_a === entity.id ? c.entity_b : c.entity_a);
    }

    for (const ct of config.connectionTargets) {
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
        else console.log(`  ✓ ${config.name} ↔ ${target.name}`);
      }
    }
  }

  // Document search
  if (config.searchTerms) {
    const { data: docs } = await sb.from('documents')
      .select('id, bates_number, title')
      .textSearch('search_vector', config.searchTerms, { type: 'plain' })
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
}

// ─── Entity Configurations ────────────────────────────────────────────────────

const entities = [
  {
    name: 'Bill Clinton',
    bio: `William Jefferson Clinton (born 1946), 42nd President of the United States (1993–2001). Flight logs document at least 26 trips on Epstein's Boeing 727, more than any other public figure in the flight records. Named in Virginia Giuffre's victim journals. Identified as the "former high U.S. Government official" who traveled with Epstein to Africa in 2002 alongside Kevin Spacey and Chris Tucker — confirmed by cross-referencing EFTA01661603 (New York Magazine, October 2002). Clinton's office acknowledged the Africa trip but stated he knew "nothing about the terrible crimes" Epstein committed. Epstein claimed to have co-founded the Clinton Foundation, and Clinton visited Epstein's Manhattan townhouse and New Mexico ranch. Never criminally charged. Named as Tier 1 (Direct Evidence) based on victim journal entries and extensive flight log documentation.`,
    evidenceSummary: `BILL CLINTON — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named in Virginia Giuffre's handwritten victim journals. 26+ documented flights on Epstein aircraft — the highest flight count of any public figure. Identified as "former high U.S. Government official" on 2002 Africa trip with Epstein.

KEY EVIDENCE:
1. Flight logs — 26+ trips on Epstein's Boeing 727 ("Lolita Express"), more than any other public figure
2. Giuffre victim journals — handwritten entry naming Bill Clinton
3. 2002 Africa trip — identified as the unnamed "former high U.S. Government official" who traveled with Epstein, Kevin Spacey, and Chris Tucker. Confirmed via EFTA01661603 (NY Mag Oct 2002 article naming all participants). Trip included stops in Ghana, Nigeria, Rwanda, Mozambique, and South Africa (Cape Town).
4. Epstein contact directory — Clinton listed with multiple contact numbers
5. Property visits — documented visits to Epstein's Manhattan townhouse (9 E. 71st St.) and New Mexico ranch (Zorro Ranch)
6. Clinton Foundation claim — Epstein claimed involvement in co-founding the Clinton Foundation; Clinton's office disputes characterization

PROSECUTION STATUS: Never criminally charged. No known civil lawsuit filed in connection with Epstein allegations. Protected by 2007 NPA blanket immunity provision covering unnamed co-conspirators. Clinton's office has issued statements acknowledging limited social contact but denying knowledge of criminal activity.

DISTINCT FROM ZORRO RANCH OFFICIAL: The "former high U.S. Government official" referenced at Zorro Ranch in 2004 (EFTA02731941 ¶50) has been identified as Bill Richardson (Governor of New Mexico), NOT Clinton. The word "another" in ¶50 confirms a different individual from the Cape Town official.

CONNECTIONS: Jeffrey Epstein (principal — flight logs, property visits, foundation claim), Ghislaine Maxwell (social circle), George Mitchell (both Democrats with Epstein connections), Kevin Spacey (2002 Africa trip companion), Chris Tucker (2002 Africa trip companion).

NOTE: Clinton's 26+ flights represent the most extensive documented travel on Epstein's aircraft by any single public figure. The volume of contact exceeds casual social acquaintance. However, flight log presence alone does not establish awareness of or participation in criminal activity. Tier classification reflects evidence strength per established framework.`,
    tierJustification: 'Named in Giuffre victim journals. 26+ flights on Epstein aircraft — highest count of any public figure. Identified as unnamed official on 2002 Africa trip. Contact directory listing. Property visits documented.',
    status: 'not_investigated',
    events: [
      {
        title: 'Clinton travels to Africa with Epstein on Boeing 727',
        description: 'Bill Clinton, Jeffrey Epstein, Kevin Spacey, and Chris Tucker travel together on Epstein\'s Boeing 727 to Ghana, Nigeria, Rwanda, Mozambique, and South Africa. Trip ostensibly for Clinton Foundation anti-AIDS initiative. Confirmed via EFTA01661603 (NY Mag article) and flight logs. Juliette (South African victim) later testified she was recruited during Epstein\'s Cape Town stop on this trip.',
        date: '2002-09-01',
        date_precision: 'month',
        event_type: 'travel',
        significance: 'critical',
      },
      {
        title: 'Clinton named in Giuffre victim journals',
        description: 'Virginia Giuffre\'s handwritten journals, later forensically authenticated, include Bill Clinton among men listed in connection with Epstein\'s network. Journals written contemporaneously during Giuffre\'s period of exploitation.',
        date: '2001-01-01',
        date_precision: 'year',
        event_type: 'evidence',
        significance: 'critical',
      },
      {
        title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
        description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Bill Clinton potentially covered.',
        date: '2007-09-24',
        event_type: 'legal',
        significance: 'critical',
      },
    ],
    connectionTargets: [
      { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Social circle overlap. Maxwell attended Clinton events. Clinton photographed with Maxwell.', strength: 'documented' },
    ],
    searchTerms: 'Clinton & Bill',
  },
  {
    name: 'Jean-Luc Brunel',
    bio: `Jean-Luc Brunel (1946–2022), French modeling agent and founder of MC2 Model Management. Named by multiple victims as having recruited and trafficked young women and girls through his modeling agencies, funneling them to Jeffrey Epstein. Virginia Giuffre testified she was trafficked to Brunel for sexual encounters. Flight logs document extensive travel on Epstein's aircraft. Brunel was arrested in Paris on December 16, 2020 and charged with rape of minors and sexual harassment. Found dead in his prison cell at La Santé Prison, Paris, on February 19, 2022 — officially ruled suicide by hanging. His death, like Epstein's, occurred while in custody awaiting trial, leading to widespread public skepticism. Classified as Tier 1 (Direct Evidence) based on victim testimony and flight log documentation.`,
    evidenceSummary: `JEAN-LUC BRUNEL — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named by multiple victims as recruiter/trafficker. Virginia Giuffre testified to being trafficked to Brunel. Flight logs document extensive travel on Epstein aircraft. Arrested and charged with rape of minors in France. Died in custody February 2022.

KEY EVIDENCE:
1. Victim testimony — multiple victims identify Brunel as recruiter who used modeling agencies to funnel young women to Epstein
2. Giuffre testimony — sworn statement that she was trafficked to Brunel for sexual encounters, described as receiving victims for "similar massages"
3. Flight logs — extensive documented travel on Epstein's Boeing 727 and Gulfstream
4. MC2 Model Management — modeling agency founded with Epstein's financial backing, alleged front for trafficking
5. French criminal charges (December 2020) — arrested at Charles de Gaulle Airport, charged with rape of minors and sexual harassment
6. Epstein contact directory — Brunel listed with extensive contact information

PROSECUTION STATUS: Arrested December 16, 2020 in Paris. Charged with rape of minors by French prosecutors. Found dead in cell at La Santé Prison, Paris, February 19, 2022 — officially suicide by hanging. Case terminated by death. No trial conducted.

DEATH CIRCUMSTANCES: Like Epstein, Brunel died by apparent suicide in custody while awaiting trial on sex trafficking-related charges. Both deaths have been subject to public scrutiny and conspiracy theories. French authorities investigated and maintained the suicide ruling.

ROLE IN NETWORK: Brunel operated the modeling industry recruitment arm of Epstein's network. His agencies (Karin Models, MC2 Model Management) provided a legitimate cover for identifying and recruiting victims — young aspiring models who were vulnerable to exploitation. This model-recruitment pipeline operated across multiple countries (France, USA, South America).

CONNECTIONS: Jeffrey Epstein (principal — financial backer, trafficking partner, flight companion), Ghislaine Maxwell (co-recruiter — both identified as trafficking facilitators), Prince Andrew (both named in Giuffre testimony).

NOTE: Brunel's case represents the international dimension of Epstein's operation. His modeling agencies created an industrialized recruitment pipeline spanning continents. His death in custody mirrors Epstein's, leaving victims without trial or accountability.`,
    tierJustification: 'Named by multiple victims as recruiter/trafficker. Giuffre testified to being trafficked to Brunel. Flight logs. MC2 modeling agency funded by Epstein as recruitment front. Arrested, charged with rape of minors, died in custody.',
    status: 'deceased',
    events: [
      {
        title: 'Brunel founds MC2 Model Management with Epstein backing',
        description: 'Jean-Luc Brunel establishes MC2 Model Management in Miami with financial backing from Jeffrey Epstein. The agency serves as a front for identifying and recruiting victims under the guise of legitimate modeling opportunities.',
        date: '2005-01-01',
        date_precision: 'year',
        event_type: 'financial',
        significance: 'high',
      },
      {
        title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
        description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Jean-Luc Brunel potentially covered.',
        date: '2007-09-24',
        event_type: 'legal',
        significance: 'critical',
      },
      {
        title: 'Brunel arrested at Charles de Gaulle Airport',
        description: 'Jean-Luc Brunel arrested by French police at Charles de Gaulle Airport while attempting to board a flight to Dakar, Senegal. Charged with rape of minors and sexual harassment in connection with Epstein\'s trafficking network.',
        date: '2020-12-16',
        event_type: 'legal',
        significance: 'critical',
      },
      {
        title: 'Jean-Luc Brunel found dead in prison cell',
        description: 'Brunel found dead by apparent suicide (hanging) in his cell at La Santé Prison in Paris. Like Epstein, he died in custody while awaiting trial on sex trafficking-related charges. French investigation ruled suicide. Case terminated by death.',
        date: '2022-02-19',
        event_type: 'personal',
        significance: 'critical',
      },
    ],
    connectionTargets: [
      { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Co-recruiters in Epstein network. Both identified as trafficking facilitators by victims. Both named in Giuffre testimony.', strength: 'documented' },
    ],
    searchTerms: 'Brunel',
  },
  {
    name: 'Larry Summers',
    bio: `Lawrence Henry Summers (born 1954), economist, 27th United States Secretary of the Treasury (1999–2001), President of Harvard University (2001–2006), and Director of the National Economic Council under President Obama (2009–2010). Named in victim Virginia Giuffre's handwritten journals listing men she was directed to have sexual encounters with by Jeffrey Epstein and Ghislaine Maxwell. Listed in Epstein's contact directory ("black book") with multiple phone numbers. Summers and Epstein had a documented financial and social relationship — Epstein donated to Harvard during Summers' presidency and visited the campus. Flight log entries document travel on Epstein's aircraft. Never criminally charged in connection with the Epstein case. Named as Tier 1 (Direct Evidence) based on victim journal entries.`,
    evidenceSummary: `LARRY SUMMERS — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 1 (Direct Evidence). Named in Virginia Giuffre's handwritten journals documenting men she was directed to have sexual encounters with. Journals authenticated forensically (gel pen analysis, contemporaneous entries). Same evidentiary basis as other Tier 1 classifications from journal entries.

KEY EVIDENCE:
1. Giuffre victim journals — handwritten entry naming "Larry Summers" among men provided for sexual encounters
2. Epstein "black book" contact directory — Larry Summers listed with multiple contact numbers
3. Epstein-Harvard relationship — Epstein donated to Harvard and visited campus during Summers' presidency (2001-2006). Summers met with Epstein on multiple occasions.
4. Flight log entries — documented travel on Epstein aircraft

PROSECUTION STATUS: Never criminally charged. No known civil lawsuit filed in connection with Epstein allegations. Protected by 2007 NPA blanket immunity provision.

INSTITUTIONAL DIMENSION: Summers' role as Harvard President during Epstein's donations raises questions about institutional acceptance of Epstein's money — a pattern repeated at MIT (Marvin Minsky/Joi Ito) and other academic institutions. Epstein leveraged academic philanthropy to build intellectual credibility and social access.

CONNECTIONS: Jeffrey Epstein (principal — contact directory, flight logs, Harvard donations), Ghislaine Maxwell (facilitator — journal context).

NOTE: Summers' presence in victim journals constitutes direct testimonial evidence but has not been independently corroborated by additional EFTA documents beyond the journal entries, contact records, and flight logs. His institutional role at Harvard adds a dimension of academic-financial complicity similar to the MIT pattern. Tier classification reflects evidence strength per established framework, not a determination of guilt.`,
    tierJustification: 'Named in Virginia Giuffre\'s handwritten victim journals. Listed in Epstein contact directory. Flight log entries. Epstein donated to Harvard during Summers\' presidency. Journals forensically authenticated.',
    status: 'not_investigated',
    events: [
      {
        title: 'Larry Summers named in Giuffre victim journals',
        description: 'Virginia Giuffre\'s handwritten journals, later forensically authenticated, include Larry Summers among men she was directed by Epstein and Maxwell to have sexual encounters with. Journals written contemporaneously during Giuffre\'s period of exploitation (2000-2002).',
        date: '2001-01-01',
        date_precision: 'year',
        event_type: 'evidence',
        significance: 'critical',
      },
      {
        title: '2007 NPA grants blanket immunity to unnamed co-conspirators',
        description: 'Non-Prosecution Agreement between US Attorney\'s Office (SDFL) and Jeffrey Epstein includes provision granting immunity to unnamed "potential co-conspirators." Larry Summers potentially covered as a journal-named individual.',
        date: '2007-09-24',
        event_type: 'legal',
        significance: 'critical',
      },
      {
        title: 'Epstein contact directory released via EFTA',
        description: 'Epstein\'s "black book" contact directory released as part of EFTA disclosures. Larry Summers listed with multiple phone numbers, confirming direct contact relationship.',
        date: '2025-12-01',
        date_precision: 'month',
        event_type: 'evidence',
        significance: 'high',
      },
    ],
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Contact directory listing. Flight logs. Epstein donated to Harvard during Summers\' presidency. Journal-named individual.', strength: 'documented' },
      { name: 'Ghislaine Maxwell', type: 'connected_to', desc: 'Maxwell identified as facilitator in Giuffre journal context.', strength: 'alleged' },
    ],
    searchTerms: 'Summers & Larry',
  },
];

async function main() {
  for (const config of entities) {
    await enrichEntity(config);
  }
  console.log('\n═══ BATCH COMPLETE ═══');
}

main().catch(console.error);
