import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

// Find Richardson
const {data: richardson} = await sb.from('entities').select('*').ilike('name', 'Bill Richardson').single();
if (!richardson) { console.error('Richardson not found'); process.exit(1); }
console.log('Found:', richardson.name, 'ID:', richardson.id, 'Tier:', richardson.tier);

const evidenceSummary = `BILL RICHARDSON — EVIDENCE ASSESSMENT

TIER JUSTIFICATION: Tier 3 (Circumstantial). Three independent evidence streams connect Richardson to Epstein's Zorro Ranch operation, but no direct evidence of participation in trafficking.

1. SWORN TESTIMONY: Pilot Larry Morrison testified under oath (EFTA01247021, deposition Oct 6, 2009, pp. 167–169) that he saw Richardson at Ranch Central being escorted to the main house for dinner with Epstein. Morrison placed the visit "well before" February 2007.

2. FINANCIAL RECORDS: Campaign finance records (EFTA01296884, EFTA01713378) show Epstein donated $100K+ to Richardson's political campaigns through the Zorro Trust — a shell entity named after the ranch, controlled by Epstein and managed by attorneys Darren Indyke and Richard Kahn.

3. SCHEDULING COORDINATION: Emails from Lesley Groff (EFTA02033176) — Epstein's scheduler who also arranged victims' travel — show ongoing coordination with Richardson's office. A separate August 2010 email (EFTA02407935) from Richardson's Deputy Chief of Staff Janis Hartley coordinated ranch visits — after Epstein's 2008 conviction and sex offender registration.

4. VICTIM COMPLAINT: The Juliette civil complaint (EFTA02731941, ¶50) describes meeting "another important government official" at Zorro Ranch in 2004. The word "another" distinguishes this official from Bill Clinton, identified elsewhere. Richardson was the sitting NM Governor in 2004.

OUTCOME: Never investigated, questioned, or publicly confronted with this evidence. Withdrew from Commerce Secretary nomination January 2009 citing unrelated pay-to-play investigation (later closed). Died August 28, 2023.`;

// 1. Update entity
const updates = {
  slug: 'bill-richardson',
  profile_published: true,
  bio: 'Bill Richardson (1947–2023) served as Governor of New Mexico (2003–2011), U.S. Representative (1983–1997), U.S. Ambassador to the United Nations (1997–1998), and Secretary of Energy (1998–2001). He ran for president in 2008 and was nominated as Secretary of Commerce before withdrawing amid an unrelated investigation. Known as one of America\'s most effective hostage negotiators. Died August 28, 2023.',
  status: 'deceased',
  profile_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Bill_Richardson_at_an_event_in_Kensington%2C_NH.jpg/440px-Bill_Richardson_at_an_event_in_Kensington%2C_NH.jpg',
  metadata: {
    ...richardson.metadata,
    evidence_summary: evidenceSummary,
    source_docs: ['EFTA01247021', 'EFTA01296884', 'EFTA01713378', 'EFTA02033176', 'EFTA02407935', 'EFTA02731941'],
  },
};

if (DRY_RUN) {
  console.log('\n[DRY RUN] Would update entity');
  console.log('  slug:', updates.slug);
  console.log('  bio:', updates.bio.substring(0, 80) + '...');
  console.log('  evidence_summary:', evidenceSummary.substring(0, 100) + '...');
} else {
  const {error} = await sb.from('entities').update(updates).eq('id', richardson.id);
  if (error) { console.error('Update failed:', error); process.exit(1); }
  console.log('Entity updated: slug, bio, status, photo, evidence_summary, published');
}

// 2. Add events
const {data: existingEvents} = await sb.from('events').select('title').eq('entity_id', richardson.id);
const existingTitles = new Set((existingEvents || []).map(e => e.title));
console.log('Existing events:', existingTitles.size);

const events = [
  {
    entity_id: richardson.id,
    title: 'Pilot Morrison testifies seeing Richardson at Zorro Ranch',
    description: 'Larry Eugene Morrison, Epstein\'s pilot, testifies under oath that he saw Bill Richardson at Ranch Central being escorted to the main house for dinner. Places visit "well before" February 2007.',
    date: '2009-10-06',
    event_type: 'legal',
    source_document: 'EFTA01247021',
    metadata: { deposition_pages: '167-169', witness: 'Larry Eugene Morrison' },
  },
  {
    entity_id: richardson.id,
    title: 'Richardson withdraws Commerce Secretary nomination',
    description: 'Withdraws nomination citing unrelated federal investigation into CDR Financial Products pay-to-play allegations (later closed without charges). Four months after Epstein\'s guilty plea.',
    date: '2009-01-04',
    event_type: 'institutional',
    metadata: { context: 'Zorro Trust donations on public campaign finance record' },
  },
  {
    entity_id: richardson.id,
    title: 'Bill Richardson dies at age 75',
    description: 'Dies in Chatham, Massachusetts at 75. Recently returned from North Korea after negotiating Private Travis King\'s release. Obituaries omit Zorro Ranch/Epstein connection.',
    date: '2023-08-28',
    event_type: 'personal',
    metadata: {},
  },
  {
    entity_id: richardson.id,
    title: 'Deputy CoS coordinates Zorro Ranch visit after Epstein conviction',
    description: 'Email from Janis Hartley (Richardson Deputy CoS) coordinates ranch visit — after Epstein\'s 2008 conviction and sex offender registration.',
    date: '2010-08-15',
    event_type: 'communication',
    source_document: 'EFTA02407935',
    metadata: { sender: 'Janis Hartley', role: 'Deputy Chief of Staff' },
  },
];

for (const ev of events) {
  if (existingTitles.has(ev.title)) {
    console.log(`  SKIP event: ${ev.title}`);
    continue;
  }
  if (DRY_RUN) {
    console.log(`  [DRY RUN] event: ${ev.date} — ${ev.title}`);
  } else {
    const {error} = await sb.from('events').insert(ev);
    if (error) console.error(`  ERROR: ${error.message}`);
    else console.log(`  Created: ${ev.date} — ${ev.title}`);
  }
}

// 3. Add connections (Groff + Clinton — Epstein connection already exists)
const {data: groff} = await sb.from('entities').select('id').eq('slug', 'lesley-groff').single();
const {data: clinton} = await sb.from('entities').select('id').eq('slug', 'bill-clinton').single();

const {data: existingConns} = await sb.from('entity_connections')
  .select('entity_a,entity_b')
  .or(`entity_a.eq.${richardson.id},entity_b.eq.${richardson.id}`);

const connections = [
  {
    entity_a: richardson.id,
    entity_b: groff.id,
    relationship_type: 'professional',
    description: 'Groff scheduling emails show ongoing coordination with Richardson\'s governor office for Zorro Ranch visits',
    strength: 60,
    evidence_strength: 'documented',
  },
  {
    entity_a: richardson.id,
    entity_b: clinton.id,
    relationship_type: 'professional',
    description: 'Richardson served in Clinton cabinet (UN Ambassador, Energy Secretary). Both connected to Epstein through independent evidence streams.',
    strength: 70,
    evidence_strength: 'documented',
  },
];

for (const conn of connections) {
  const exists = (existingConns || []).some(c =>
    (c.entity_a === conn.entity_a && c.entity_b === conn.entity_b) ||
    (c.entity_a === conn.entity_b && c.entity_b === conn.entity_a)
  );
  if (exists) {
    console.log(`  SKIP connection: already exists`);
    continue;
  }
  if (DRY_RUN) {
    console.log(`  [DRY RUN] connection: ${conn.relationship_type}`);
  } else {
    const {error} = await sb.from('entity_connections').insert(conn);
    if (error) console.error(`  ERROR connection: ${error.message}`);
    else console.log(`  Created connection: ${conn.relationship_type}`);
  }
}

console.log('\nDone.');
