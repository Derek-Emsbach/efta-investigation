/**
 * Financial Firm Entity Batch Enrichment
 * KKR, Oaktree, Blackstone, Carlyle — all connected through Epstein's financial infrastructure
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

const firms = [
  {
    name: 'KKR & Co. L.P.',
    bio: `KKR & Co. L.P. (Kohlberg Kravis Roberts), global investment firm founded in 1976 by Henry Kravis, George Roberts, and Jerome Kohlberg. One of the world's largest private equity firms with over $500 billion in assets under management. Appears in Epstein-related financial documents as part of the network of elite financial institutions connected to Epstein's investment activities. KKR co-founder Henry Kravis appeared in Epstein's contact directory. The firm's connection to the Epstein case is through financial infrastructure — co-investment relationships, fund placements, and the broader private equity ecosystem that Epstein navigated to build credibility and access. Classified as Tier 4 (Associated) — documented financial connection without evidence of criminal awareness.`,
    evidenceSummary: `KKR & CO. L.P. — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Appears in EFTA financial documents as part of Epstein's investment network. Connection is institutional/financial, not criminal. No evidence that the firm had awareness of or facilitated Epstein's criminal activities.

KEY EVIDENCE:
1. EFTA financial documents — KKR referenced in Epstein financial records and investment correspondence
2. Epstein contact directory — Henry Kravis (KKR co-founder) listed with contact information
3. Financial infrastructure — part of the private equity ecosystem Epstein leveraged for credibility

CLASSIFICATION: Financial entity. No criminal allegations. Tier 4 reflects documented connection to Epstein's financial network without evidence of complicity.`,
    aliases: ['KKR', 'Kohlberg Kravis Roberts', 'KKR & Co.'],
    tierJustification: 'Referenced in EFTA financial documents. KKR co-founder Henry Kravis in Epstein contact directory. Financial infrastructure connection without evidence of criminal awareness.',
    searchTerms: 'KKR | Kravis',
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Financial network connection. Epstein contact directory lists KKR co-founder. Investment ecosystem overlap.', strength: 'documented' },
      { name: 'Apollo Global Management LLC', type: 'connected_to', desc: 'Both major private equity firms appearing in Epstein financial documents. Apollo CEO Leon Black had direct financial relationship with Epstein.', strength: 'circumstantial' },
    ],
  },
  {
    name: 'Oaktree Capital Group, LLC',
    bio: `Oaktree Capital Group, LLC, global investment management firm founded in 1995 by Howard Marks and Bruce Karsh in Los Angeles. Specializes in distressed debt, high-yield bonds, and alternative investments with approximately $190 billion in assets under management. Appears in Epstein-related financial documents as part of the network of elite financial institutions connected to Epstein's investment activities. Oaktree's connection to the Epstein case is through the broader financial infrastructure — co-investment relationships and the alternative investment ecosystem. Classified as Tier 4 (Associated) — documented financial connection without evidence of criminal awareness.`,
    evidenceSummary: `OAKTREE CAPITAL GROUP — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Appears in EFTA financial documents as part of Epstein's investment network. Connection is institutional/financial, not criminal. No evidence that the firm had awareness of or facilitated Epstein's criminal activities.

KEY EVIDENCE:
1. EFTA financial documents — Oaktree referenced in Epstein financial records
2. Financial infrastructure — part of the alternative investment ecosystem Epstein navigated

CLASSIFICATION: Financial entity. No criminal allegations. Tier 4 reflects documented connection to Epstein's financial network without evidence of complicity.`,
    aliases: ['Oaktree Capital', 'Oaktree'],
    tierJustification: 'Referenced in EFTA financial documents. Part of alternative investment ecosystem connected to Epstein financial network. No evidence of criminal awareness.',
    searchTerms: 'Oaktree',
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Financial network connection. Referenced in Epstein financial documents.', strength: 'circumstantial' },
      { name: 'Apollo Global Management LLC', type: 'connected_to', desc: 'Both alternative investment firms appearing in Epstein financial documents. Shared ecosystem.', strength: 'circumstantial' },
    ],
  },
  {
    name: 'The Blackstone Group LP',
    bio: `The Blackstone Group LP (now Blackstone Inc.), global alternative asset management firm founded in 1985 by Stephen Schwarzman and Pete Peterson. One of the world's largest private equity firms with over $1 trillion in assets under management. Appears in Epstein-related financial documents as part of the network of elite financial institutions connected to Epstein's investment activities. Blackstone co-founder Stephen Schwarzman appeared in Epstein's contact directory. The firm's connection is through financial infrastructure — Epstein cultivated relationships across the private equity ecosystem to build credibility. Classified as Tier 4 (Associated) — documented financial connection without evidence of criminal awareness.`,
    evidenceSummary: `THE BLACKSTONE GROUP — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Appears in EFTA financial documents as part of Epstein's investment network. Connection is institutional/financial, not criminal. No evidence that the firm had awareness of or facilitated Epstein's criminal activities.

KEY EVIDENCE:
1. EFTA financial documents — Blackstone referenced in Epstein financial records
2. Epstein contact directory — Stephen Schwarzman (Blackstone co-founder) listed with contact information
3. Financial infrastructure — part of the private equity ecosystem Epstein leveraged for credibility and social access

CLASSIFICATION: Financial entity. No criminal allegations. Tier 4 reflects documented connection to Epstein's financial network without evidence of complicity.`,
    aliases: ['Blackstone', 'Blackstone Inc.', 'Blackstone Group'],
    tierJustification: 'Referenced in EFTA financial documents. Blackstone co-founder Schwarzman in Epstein contact directory. Financial infrastructure connection without evidence of criminal awareness.',
    searchTerms: 'Blackstone | Schwarzman',
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Financial network connection. Epstein contact directory lists Blackstone co-founder. Investment ecosystem overlap.', strength: 'documented' },
      { name: 'Apollo Global Management LLC', type: 'connected_to', desc: 'Both major private equity firms appearing in Epstein financial documents. Apollo CEO Leon Black had direct financial relationship with Epstein.', strength: 'circumstantial' },
    ],
  },
  {
    name: 'The Carlyle Group LP',
    bio: `The Carlyle Group LP (now Carlyle Group Inc.), global investment management firm founded in 1987 in Washington, D.C. Manages approximately $425 billion in assets across private equity, real assets, global credit, and investment solutions. Known for its connections to political and defense establishment figures. Appears in Epstein-related financial documents as part of the network of elite financial institutions connected to Epstein's investment activities. The firm's D.C. base places it in the same geographic nexus as several journal-named individuals. Classified as Tier 4 (Associated) — documented financial connection without evidence of criminal awareness.`,
    evidenceSummary: `THE CARLYLE GROUP — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 4 (Associated). Appears in EFTA financial documents as part of Epstein's investment network. Connection is institutional/financial, not criminal. No evidence that the firm had awareness of or facilitated Epstein's criminal activities.

KEY EVIDENCE:
1. EFTA financial documents — Carlyle referenced in Epstein financial records
2. Washington D.C. nexus — D.C.-based firm in same geographic cluster as several journal-named individuals
3. Political connections — Carlyle's well-documented ties to political establishment overlap with Epstein's cultivation of political figures

CLASSIFICATION: Financial entity. No criminal allegations. Tier 4 reflects documented connection to Epstein's financial network without evidence of complicity. D.C. geographic nexus is contextually relevant but not evidence of involvement.`,
    aliases: ['Carlyle Group', 'Carlyle', 'Carlyle Group Inc.'],
    tierJustification: 'Referenced in EFTA financial documents. D.C.-based firm in same geographic nexus as journal-named individuals. Financial infrastructure connection without evidence of criminal awareness.',
    searchTerms: 'Carlyle',
    connectionTargets: [
      { name: 'Jeffrey Epstein', type: 'connected_to', desc: 'Financial network connection. Referenced in Epstein financial documents. D.C. nexus overlap.', strength: 'circumstantial' },
      { name: 'Apollo Global Management LLC', type: 'connected_to', desc: 'Both major private equity firms appearing in Epstein financial documents.', strength: 'circumstantial' },
    ],
  },
];

async function enrichFirm(firm) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${firm.name}`);
  console.log(`${'═'.repeat(60)}`);

  const { data: entity, error } = await sb.from('entities')
    .select('*')
    .eq('name', firm.name)
    .single();

  if (error || !entity) {
    console.log(`  NOT FOUND: ${error?.message}`);
    return;
  }

  console.log(`  Found: T${entity.tier}, ${entity.id}`);
  console.log(`  Current bio: ${entity.bio ? entity.bio.substring(0, 60) + '...' : 'NONE'}`);

  // Update entity
  const updates = {
    bio: firm.bio,
    status: 'not_investigated',
    aliases: firm.aliases,
    tier_justification: firm.tierJustification,
    metadata: {
      ...entity.metadata,
      evidence_summary: firm.evidenceSummary,
    },
  };

  if (!dryRun) {
    const { error: updateErr } = await sb.from('entities').update(updates).eq('id', entity.id);
    if (updateErr) console.log(`  ERROR: ${updateErr.message}`);
    else console.log(`  ✓ Entity updated`);
  } else {
    console.log(`  Would update entity`);
  }

  // Connections
  const { data: existingConns } = await sb.from('entity_connections')
    .select('entity_a, entity_b')
    .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
  const connectedIds = new Set();
  for (const c of existingConns || []) {
    connectedIds.add(c.entity_a === entity.id ? c.entity_b : c.entity_a);
  }

  for (const ct of firm.connectionTargets) {
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
      else console.log(`  ✓ ${firm.name} ↔ ${target.name}`);
    } else {
      console.log(`  Would connect: ${firm.name} ↔ ${ct.name}`);
    }
  }

  // Document search
  const { data: docs } = await sb.from('documents')
    .select('id, bates_number, title')
    .textSearch('search_vector', firm.searchTerms, { type: 'plain' })
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
  for (const firm of firms) {
    await enrichFirm(firm);
  }
  console.log('\n═══ BATCH COMPLETE ═══');
}

main().catch(console.error);
