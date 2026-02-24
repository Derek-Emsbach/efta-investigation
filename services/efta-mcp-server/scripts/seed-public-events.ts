/**
 * Seed script: Public Events & DOJ Accountability
 *
 * Run once after migration 014:
 *   cd services/efta-mcp-server && npx tsx scripts/seed-public-events.ts
 */

import 'dotenv/config';
import { getSupabase } from '../src/supabase.js';

const publicEvents = [
  // ── LEGISLATIVE ─────────────────────────────────────────────────────────────
  {
    date: '2025-11-18',
    title: 'House passes EFTA 427-1',
    description: 'Rep. Clay Higgins sole nay vote.',
    category: 'legislative',
    impact_level: 'critical',
    entity_names: ['Clay Higgins'],
    tags: ['efta_passage'],
  },
  {
    date: '2025-11-18',
    title: 'Senate passes EFTA by unanimous consent',
    description: 'Same day as House vote.',
    category: 'legislative',
    impact_level: 'critical',
    tags: ['efta_passage'],
  },
  {
    date: '2025-11-19',
    title: 'Trump signs EFTA into law',
    description: 'Signed without reporters present. 30-day deadline set for Dec 19.',
    category: 'legislative',
    impact_level: 'critical',
    entity_names: ['Donald Trump'],
    tags: ['efta_passage'],
  },

  // ── DOJ RELEASES ────────────────────────────────────────────────────────────
  {
    date: '2025-12-19',
    title: 'DOJ releases first batch of Epstein files (Datasets 1-8)',
    description: 'Heavily redacted. 500+ pages entirely blacked out. Less than 1% of total files.',
    category: 'doj_release',
    impact_level: 'critical',
    tags: ['dataset_release', 'wave_1'],
  },
  {
    date: '2025-12-21',
    title: '16 files disappear from DOJ website within 48 hours of release',
    description: 'Including EFTA00000468 (Trump photo). No explanation given.',
    category: 'doj_action',
    impact_level: 'high',
    tags: ['deletion'],
  },
  {
    date: '2026-01-05',
    title: 'DOJ letter to Judge Engelmayer: less than 1% of files released',
    description: 'DOJ admits only 12,285 of 2M+ documents reviewed by deadline.',
    category: 'doj_action',
    impact_level: 'high',
  },
  {
    date: '2026-01-30',
    title: 'DOJ releases 3.5M pages (Datasets 9-12)',
    description: "DAG Blanche announces 'final release.' Includes 180K images, 2K videos. Age verification gate added.",
    category: 'doj_release',
    impact_level: 'critical',
    entity_names: ['Todd Blanche'],
    tags: ['dataset_release', 'wave_5'],
  },

  // ── CONGRESSIONAL ACTIONS ───────────────────────────────────────────────────
  {
    date: '2026-02-02',
    title: 'Blanche claims DOJ in full compliance with EFTA',
    description: 'Disputed by Khanna, Massie, and EFTA authors. DOJ identified 6M pages but released 3.5M.',
    category: 'congressional_action',
    impact_level: 'high',
    entity_names: ['Todd Blanche'],
    tags: ['compliance_dispute'],
  },
  {
    date: '2026-02-06',
    title: 'DOJ opens reading room for unredacted files',
    description: 'Patrick Davis letter to all 535 members. No electronics allowed, notes only.',
    category: 'congressional_action',
    impact_level: 'high',
    tags: ['reading_room'],
  },
  {
    date: '2026-02-08',
    title: 'Massie asks public to identify key redacted documents',
    description: 'Posted on X asking users which redacted docs he should prioritize in reading room.',
    category: 'congressional_action',
    impact_level: 'medium',
    entity_names: ['Thomas Massie'],
    tags: ['reading_room'],
  },
  {
    date: '2026-02-09',
    title: "Khanna and Massie visit DOJ reading room, accuse DOJ of 'breaking the law'",
    description: 'First congressional reading room visit. Both criticize Bondi and DOJ.',
    category: 'congressional_action',
    impact_level: 'critical',
    entity_names: ['Ro Khanna', 'Thomas Massie', 'Pam Bondi'],
    tags: ['reading_room'],
  },
  {
    date: '2026-02-09',
    title: "Sen. Lummis: 'Now I see what the big deal is'",
    description: 'After reviewing unredacted files.',
    category: 'congressional_action',
    impact_level: 'high',
    entity_names: ['Cynthia Lummis'],
    tags: ['reading_room'],
  },
  {
    date: '2026-02-09',
    title: "Rep. Raskin accuses DOJ of coverup, says Trump's name appears 'more than a million times'",
    description: 'After viewing unredacted files.',
    category: 'congressional_action',
    impact_level: 'high',
    entity_names: ['Jamie Raskin', 'Donald Trump'],
    tags: ['reading_room'],
  },
  {
    date: '2026-02-10',
    title: 'Khanna reads 6 names on House floor',
    description: 'Names from unredacted files read publicly for first time.',
    category: 'congressional_action',
    impact_level: 'critical',
    entity_names: ['Ro Khanna'],
    tags: ['names_revealed'],
  },
  {
    date: '2026-02-10',
    title: "Rep. Moskowitz: co-conspirator list 'would surprise you, a lot of them were women'",
    description: 'After reading room visit.',
    category: 'congressional_action',
    impact_level: 'high',
    entity_names: ['Jared Moskowitz'],
    tags: ['reading_room'],
  },
  {
    date: '2026-02-14',
    title: 'AG Bondi submits Section 3 report to Congress',
    description: 'EFTA-required report listing PEP names, redaction categories, and withheld records.',
    category: 'congressional_action',
    impact_level: 'high',
    entity_names: ['Pam Bondi'],
    tags: ['section_3_report'],
  },
  {
    date: '2026-02-09',
    title: 'Raskin accuses DOJ of surveilling members of Congress in reading room',
    description: 'Claims DOJ attempted to obstruct and intimidate congressional reviewers.',
    category: 'congressional_action',
    impact_level: 'critical',
    entity_names: ['Jamie Raskin'],
    tags: ['reading_room', 'surveillance'],
  },

  // ── DOJ ACTIONS (negative) ──────────────────────────────────────────────────
  {
    date: '2026-02-10',
    title: "Bondi photographed with printout of Rep. Jayapal's reading room search history",
    description: 'Evidence of DOJ tracking what congressional members search for in unredacted files.',
    category: 'doj_action',
    impact_level: 'critical',
    entity_names: ['Pam Bondi', 'Pramila Jayapal'],
    tags: ['surveillance', 'reading_room'],
  },

  // ── CRIMINAL ACTIONS ────────────────────────────────────────────────────────
  {
    date: '2026-02-06',
    title: 'Norway opens investigation into former PM Jagland over Epstein ties',
    description: "Økokrim cites EFTA documents showing gifts, travel, loans. Investigation for 'aggravated corruption.'",
    category: 'criminal_action',
    impact_level: 'critical',
    entity_names: ['Thorbjørn Jagland'],
    tags: ['norway', 'criminal_investigation'],
  },
  {
    date: '2026-02-11',
    title: "Council of Europe waives Jagland's diplomatic immunity",
    description: 'Enabling Norwegian prosecution.',
    category: 'criminal_action',
    impact_level: 'high',
    entity_names: ['Thorbjørn Jagland'],
    tags: ['norway'],
  },
  {
    date: '2026-02-12',
    title: "Police raid Jagland's properties in Oslo, Risør, and Rauland",
    description: 'Three properties searched. Formally charged with aggravated corruption.',
    category: 'criminal_action',
    impact_level: 'critical',
    entity_names: ['Thorbjørn Jagland'],
    tags: ['norway', 'arrest'],
  },
  {
    date: '2026-02-13',
    title: 'Jagland formally charged with aggravated corruption',
    description: 'Elden Law Firm confirms charges. Jagland denies all charges. Faces up to 10 years.',
    category: 'criminal_action',
    impact_level: 'critical',
    entity_names: ['Thorbjørn Jagland'],
    tags: ['norway', 'charges'],
  },
  {
    date: '2026-02-19',
    title: 'Prince Andrew arrested on suspicion of misconduct in office',
    description: 'Thames Valley Police arrest over sharing confidential trade envoy documents with Epstein. Released after ~11 hours.',
    category: 'criminal_action',
    impact_level: 'critical',
    entity_names: ['Prince Andrew'],
    tags: ['uk', 'arrest'],
  },
  {
    date: '2026-02-10',
    title: 'UK Met Police opens investigation into Peter Mandelson',
    description: 'Based on EFTA documents showing leaked government intel to Epstein.',
    category: 'criminal_action',
    impact_level: 'high',
    entity_names: ['Peter Mandelson'],
    tags: ['uk', 'criminal_investigation'],
  },
  {
    date: '2026-02-15',
    title: 'France opens investigation into Jack and Caroline Lang',
    description: 'Over Epstein connections revealed in EFTA files.',
    category: 'criminal_action',
    impact_level: 'high',
    entity_names: ['Jack Lang', 'Caroline Lang'],
    tags: ['france', 'criminal_investigation'],
  },
  {
    date: '2026-02-15',
    title: 'Norway investigates diplomatic couple Mona Juul and Terje Rød-Larsen',
    description: "Juul's children allegedly named in Epstein will for $5M each. Juul suspended as ambassador.",
    category: 'criminal_action',
    impact_level: 'high',
    entity_names: ['Mona Juul', 'Terje Rød-Larsen'],
    tags: ['norway', 'criminal_investigation'],
  },

  // ── RESIGNATIONS ────────────────────────────────────────────────────────────
  {
    date: '2025-09-15',
    title: 'Peter Mandelson fired as UK ambassador to US',
    description: "PM Starmer fires Mandelson over Epstein ties. Called Epstein 'my best pal' in files. May have leaked government info.",
    category: 'resignation',
    impact_level: 'critical',
    entity_names: ['Peter Mandelson', 'Keir Starmer'],
    tags: ['uk', 'firing'],
  },
  {
    date: '2025-09-15',
    title: "Morgan McSweeney resigns as Starmer's chief of staff",
    description: 'Recommended Mandelson for ambassadorship despite known Epstein relationship.',
    category: 'resignation',
    impact_level: 'high',
    entity_names: ['Morgan McSweeney'],
    tags: ['uk', 'resignation'],
  },
  {
    date: '2026-02-15',
    title: 'Slovak NSA Miroslav Lajčák resigns',
    description: 'Over emails with Epstein revealed in EFTA files.',
    category: 'resignation',
    impact_level: 'high',
    entity_names: ['Miroslav Lajčák'],
    tags: ['slovakia', 'resignation'],
  },
  {
    date: '2026-02-15',
    title: 'Jack Lang resigns from Arab World Institute',
    description: 'Over Epstein connections. French investigation ongoing.',
    category: 'resignation',
    impact_level: 'high',
    entity_names: ['Jack Lang'],
    tags: ['france', 'resignation'],
  },
  {
    date: '2026-02-15',
    title: 'Crown Princess Mette-Marit issues public apology',
    description: "Called interactions with Epstein 'embarrassing, tasteless, and indefensible.' Charities review ties.",
    category: 'resignation',
    impact_level: 'high',
    entity_names: ['Crown Princess Mette-Marit'],
    tags: ['norway', 'apology'],
  },
  {
    date: '2026-02-15',
    title: 'George Mitchell scholarship renamed at multiple universities',
    description: 'Mitchell Center at University of Maine renamed.',
    category: 'resignation',
    impact_level: 'medium',
    entity_names: ['George Mitchell'],
    tags: ['consequence'],
  },
  {
    date: '2026-02-12',
    title: 'Kathy Ruemmler announces resignation from Goldman Sachs',
    description: "Effective June 30, 2026. Correspondence showed her calling Epstein 'Uncle Jeffrey' and 'older brother.'",
    category: 'resignation',
    impact_level: 'high',
    entity_names: ['Kathy Ruemmler'],
    tags: ['resignation', 'goldman_sachs'],
  },
  {
    date: '2026-02-15',
    title: "Mona Juul resigns as Norway's ambassador to Jordan and Iraq",
    description: 'After revelations her children were named in Epstein will for $5M each.',
    category: 'resignation',
    impact_level: 'high',
    entity_names: ['Mona Juul'],
    tags: ['norway', 'resignation'],
  },

  // ── MEDIA BREAKS ────────────────────────────────────────────────────────────
  {
    date: '2026-01-30',
    title: 'CNN discovers 86-page SDNY prosecution memo in release',
    description: "'Investigation into Potential Co-Conspirators' — statements from 24 minor victims and 14 adult victims. Sent to US Attorney Berman Dec 19 2019.",
    category: 'media_break',
    impact_level: 'critical',
    tags: ['prosecution_memo'],
  },
  {
    date: '2026-01-30',
    title: 'FBI compiled list of sexual assault allegations re: Trump',
    description: 'August 2025 compilation included in DS9 email chains. Dozens of allegations, many unverified tips.',
    category: 'media_break',
    impact_level: 'high',
    entity_names: ['Donald Trump'],
    tags: ['fbi_list'],
  },
  {
    date: '2026-01-30',
    title: 'Draft indictment discovered — would have charged 3 others alongside Epstein',
    description: "SDFL draft from 2000s names 3 'employees' of Epstein. Never filed.",
    category: 'media_break',
    impact_level: 'critical',
    tags: ['draft_indictment', 'prosecution_failure'],
  },
  {
    date: '2025-12-19',
    title: 'Faulty redactions allow public to recover blacked-out content',
    description: 'Copy-paste technique reveals hidden text. Traced to 2021 USVI AG office filing. At least 550 entirely blacked-out pages.',
    category: 'media_break',
    impact_level: 'high',
    tags: ['redaction_failure'],
  },

  // ── COMMUNITY RESOURCES ─────────────────────────────────────────────────────
  {
    date: '2026-01-15',
    title: 'Jmail launches — Gmail-style interface for Epstein emails',
    description: '1.4M files indexed, 25M+ users. OCR\'d with Google Gemini. Created by Riley Walz and Luke Igel.',
    category: 'community_resource',
    impact_level: 'high',
    tags: ['community_tool'],
  },
  {
    date: '2026-02-15',
    title: 'rhowardstone publishes forensic analysis corpus on GitHub',
    description: '100+ reports, SQLite full-text index of 1.38M documents. Public domain.',
    category: 'community_resource',
    impact_level: 'high',
    tags: ['community_tool'],
  },
  {
    date: '2026-02-15',
    title: 'tommycarstensen.com launches EFTA resources hub',
    description: 'Deletion tracker, financial graph, image gallery, video gallery, EFTA lookup tool.',
    category: 'community_resource',
    impact_level: 'medium',
    tags: ['community_tool'],
  },

  // ── ADDITIONAL NOTABLE EVENTS ───────────────────────────────────────────────
  {
    date: '2025-11-15',
    title: 'House Oversight Committee releases Epstein estate subpoena materials',
    description: '28,500+ pages including 3 emails suggesting Trump knowledge of trafficking practices.',
    category: 'congressional_action',
    impact_level: 'high',
    tags: ['house_oversight'],
  },
  {
    date: '2025-09-15',
    title: 'House Oversight releases 33,295 pages from DOJ',
    description: 'Pre-EFTA release of DOJ investigation materials.',
    category: 'congressional_action',
    impact_level: 'high',
    tags: ['house_oversight'],
  },
  {
    date: '2025-12-15',
    title: 'Prince Andrew stripped of royal titles',
    description: 'Following House Oversight file release scrutiny.',
    category: 'international',
    impact_level: 'critical',
    entity_names: ['Prince Andrew'],
    tags: ['uk', 'consequence'],
  },
  {
    date: '2026-02-19',
    title: "King Charles vows to cooperate with any investigation",
    description: "Statement after Prince Andrew's arrest: 'the law must take its course.'",
    category: 'international',
    impact_level: 'high',
    entity_names: ['King Charles III', 'Prince Andrew'],
    tags: ['uk'],
  },
];

const dojAccountability = [
  {
    date: '2025-12-21',
    title: 'DOJ deletes EFTA00000468 (Trump photo) from website',
    description: 'Published file containing Trump photo removed from DOJ website without explanation within 48 hours of initial release.',
    action_type: 'file_deletion',
    severity: 'critical',
    efta_numbers: ['EFTA00000468'],
    legal_basis: 'EFTA Section 2 requires full disclosure',
    status: 'documented',
  },
  {
    date: '2025-12-21',
    title: '16 files removed from DOJ website within 48 hours of initial release',
    description: 'Multiple published files disappeared from DOJ EFTA portal. No public notice or explanation provided.',
    action_type: 'file_deletion',
    severity: 'critical',
    legal_basis: 'EFTA Section 2',
    status: 'documented',
  },
  {
    date: '2025-12-19',
    title: 'DOJ releases less than 1% of files by statutory deadline',
    description: 'DOJ admits only 12,285 of 2M+ documents reviewed by the 30-day deadline set by EFTA.',
    action_type: 'deadline_violation',
    severity: 'critical',
    legal_basis: 'EFTA Section 2 — 30-day release requirement',
    status: 'ongoing',
  },
  {
    date: '2026-02-02',
    title: 'DAG Blanche claims full EFTA compliance despite releasing only 3.5M of 6M identified pages',
    description: 'Deputy Attorney General claims full compliance. Disputed by EFTA authors Khanna, Massie, and others.',
    action_type: 'false_compliance',
    severity: 'high',
    legal_basis: 'EFTA Section 2',
    status: 'ongoing',
  },
  {
    date: '2026-02-10',
    title: "AG Bondi photographed with printout of Rep. Jayapal's reading room search history",
    description: 'Evidence that DOJ tracked and printed individual congressional members\' search queries in the unredacted file reading room.',
    action_type: 'viewer_surveillance',
    severity: 'critical',
    legal_basis: 'Potential obstruction of congressional oversight',
    status: 'documented',
  },
  {
    date: '2026-02-09',
    title: 'Rep. Raskin accuses DOJ of surveilling members of Congress in reading room',
    description: 'Claims DOJ attempted to obstruct and intimidate congressional reviewers by monitoring their file access.',
    action_type: 'viewer_surveillance',
    severity: 'critical',
    legal_basis: 'Congressional oversight authority',
    status: 'documented',
  },
  {
    date: '2026-01-30',
    title: '43+ victim full names exposed in release per WSJ',
    description: 'Wall Street Journal identifies at least 43 victim full names that were not redacted in the public release.',
    action_type: 'victim_exposure',
    severity: 'critical',
    legal_basis: 'EFTA Section 2(b) — victim protection requirement',
    status: 'ongoing',
  },
  {
    date: '2026-01-30',
    title: 'Dozens of unredacted nude images of victims published',
    description: 'Intimate images of trafficking victims included in public release without redaction.',
    action_type: 'victim_exposure',
    severity: 'critical',
    legal_basis: 'EFTA Section 2(b)',
    status: 'ongoing',
  },
  {
    date: '2026-01-30',
    title: 'Edwards provided 350-name victim protection list that DOJ failed to keyword-search',
    description: 'Attorney Brad Edwards provided DOJ with a list of 350 victim names for redaction. DOJ did not run keyword searches against the list before release.',
    action_type: 'victim_exposure',
    severity: 'high',
    legal_basis: 'EFTA Section 2(b)',
    status: 'documented',
  },
  {
    date: '2025-12-19',
    title: 'Wexner name initially redacted, unredacted only after congressional pressure',
    description: 'Les Wexner\'s name was redacted in initial release. Only unredacted after congressional complaints about selective redaction.',
    action_type: 'perpetrator_protection',
    severity: 'high',
    legal_basis: 'EFTA Section 2(b) — no redactions based on embarrassment',
    status: 'documented',
  },
  {
    date: '2025-12-19',
    title: 'eDiscovery load files contain only 2 fields instead of standard 20-30',
    description: 'Concordance DAT files shipped with minimal metadata — only Bates number and file path. Standard eDiscovery practice includes 20-30 fields.',
    action_type: 'metadata_suppression',
    severity: 'high',
    legal_basis: 'EFTA Section 2 — document integrity',
    status: 'ongoing',
  },
  {
    date: '2025-12-19',
    title: 'All PDF metadata systematically stripped — no creation dates, authors, or processing tools',
    description: 'Every PDF in the release has been stripped of standard document metadata (creation date, author, software, modification history).',
    action_type: 'metadata_suppression',
    severity: 'high',
    legal_basis: 'EFTA Section 2',
    status: 'ongoing',
  },
  {
    date: '2026-02-10',
    title: "DOJ tracked and printed individual congressional members' search queries in reading room",
    description: 'DOJ monitored which documents congressional members accessed and searched for in the reading room, then printed and distributed those search histories.',
    action_type: 'obstruction',
    severity: 'critical',
    legal_basis: 'Potential obstruction of congressional oversight, separation of powers',
    status: 'documented',
  },
];

async function main() {
  const sb = getSupabase();

  console.log(`Seeding ${publicEvents.length} public events...`);
  const { data: evtData, error: evtErr } = await sb.from('public_events').insert(publicEvents).select('id');
  if (evtErr) {
    console.error('Failed to insert public events:', evtErr.message);
    process.exit(1);
  }
  console.log(`  Inserted ${evtData.length} public events`);

  console.log(`Seeding ${dojAccountability.length} DOJ accountability records...`);
  const { data: dojData, error: dojErr } = await sb.from('doj_accountability').insert(dojAccountability).select('id');
  if (dojErr) {
    console.error('Failed to insert DOJ accountability records:', dojErr.message);
    process.exit(1);
  }
  console.log(`  Inserted ${dojData.length} DOJ accountability records`);

  console.log('\nDone!');
}

main();
