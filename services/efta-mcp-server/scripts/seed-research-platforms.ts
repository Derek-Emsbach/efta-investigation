import 'dotenv/config';
import { getSupabase } from '../src/supabase.js';

const platforms = [
  {
    name: 'Jmail',
    url: 'https://jmail.world',
    source_type: 'search_platform',
    description: 'Gmail-style interface for Epstein emails. 1.4M files indexed, OCR\'d with Google Gemini. Includes JPhotos, JDrive, JFlights, Jwiki, Jemini AI.',
    capabilities: ['full_text_search', 'email_viewer', 'person_pages', 'photo_gallery', 'flight_tracker', 'wiki', 'ai_search'],
    person_page_template: 'https://jmail.world/wiki/{slug}',
    api_available: false,
    status: 'active',
  },
  {
    name: 'rhowardstone/Epstein-research',
    url: 'https://github.com/rhowardstone/Epstein-research',
    source_type: 'research_repo',
    description: '100+ forensic analysis reports with EFTA document citations. Congressional briefing materials. 225-issue factual accuracy audit.',
    capabilities: ['individual_reports', 'financial_forensics', 'congressional_guides', 'methodology_docs'],
    person_page_template: 'https://github.com/rhowardstone/Epstein-research/blob/main/individuals/{SLUG}.md',
    api_available: false,
    status: 'active',
  },
  {
    name: 'rhowardstone/Epstein-research-data',
    url: 'https://github.com/rhowardstone/Epstein-research-data',
    source_type: 'data_corpus',
    description: 'SQLite full-text corpus (6.08 GB, 1.38M docs), redaction analysis (0.95 GB, 2.59M records), knowledge graph (524 entities), entity registry (1,536 persons). All public domain, v4.0.',
    capabilities: ['full_text_search', 'redaction_search', 'knowledge_graph', 'entity_registry', 'efta_mapping'],
    api_available: false,
    status: 'active',
  },
  {
    name: 'Tommy Carstensen EFTA Hub',
    url: 'https://tommycarstensen.com/epstein',
    source_type: 'tracker',
    description: 'DOJ deletion tracker, EFTA ID lookup, financial graph, photo identification (292K images w/ facial recognition), video gallery (Whisper transcripts), consequence tracker.',
    capabilities: ['deletion_tracker', 'efta_lookup', 'financial_graph', 'photo_gallery', 'video_gallery', 'consequence_tracker'],
    api_available: false,
    status: 'active',
  },
  {
    name: 'DOJ Epstein Library',
    url: 'https://www.justice.gov/epstein',
    source_type: 'government',
    description: 'Original DOJ release of all 12 EFTA datasets. Known to delete files and block programmatic access.',
    capabilities: ['original_pdfs', 'dataset_browsing'],
    api_available: false,
    status: 'unreliable',
    notes: 'Blocks bots, deletes files, slow. Use alternatives when possible.',
  },
  {
    name: 'Internet Archive - Epstein Files',
    url: 'https://archive.org',
    source_type: 'archive',
    description: 'Brute-force archive of DOJ PDFs. Preserves files DOJ has deleted.',
    capabilities: ['archived_pdfs', 'deletion_recovery'],
    api_available: true,
    status: 'active',
  },
  {
    name: 'PACER',
    url: 'https://pacer.uscourts.gov',
    source_type: 'court_records',
    description: 'Federal court records. Key cases: 19 Cr. 490 (RMB) — US v. Epstein SDNY, 15 Cv. 7433 — Maxwell civil (Preska).',
    capabilities: ['court_filings', 'docket_search'],
    api_available: true,
    status: 'active',
  },
  {
    name: 'Google Pinpoint / COURIER',
    url: 'https://journaliststudio.google.com/pinpoint',
    source_type: 'search_platform',
    description: 'DS1-8 and DS12 searchable. DS9 status unknown. Google\'s document analysis tool.',
    capabilities: ['full_text_search', 'entity_extraction'],
    api_available: false,
    status: 'active',
    notes: 'DS9 (largest dataset) may not be indexed.',
  },
];

async function main() {
  const sb = getSupabase();
  const { data, error } = await sb.from('research_platforms')
    .upsert(platforms, { onConflict: 'name' })
    .select('id, name');
  if (error) {
    console.error('Error seeding research platforms:', error.message);
    process.exit(1);
  }
  console.log(`Seeded ${data?.length ?? 0} research platforms`);
  for (const p of (data ?? [])) {
    console.log(`  - ${p.name} (${p.id})`);
  }
}

main();
