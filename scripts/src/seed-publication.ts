/**
 * Seed the publication tables with case files, stories, and entity links.
 *
 * Reads investigation threads from docs/investigation/threads/ and inserts:
 * - 6 case_files (master brief + 5 threads)
 * - ~42 open_questions linked to case files
 * - ~35 case_file_entities links
 * - N stories with citations and entity links
 *
 * Usage:
 *   pnpm --filter @efta/scripts seed:publication
 *   pnpm --filter @efta/scripts seed:publication -- --dry-run
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { supabase, rootDir } from './utils/supabase-admin.js'

const DRY_RUN = process.argv.includes('--dry-run')
const THREADS_DIR = resolve(rootDir, 'docs/investigation/threads')
const STORIES_DIR = resolve(rootDir, 'docs/stories')

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryDef {
  slug: string
  title: string
  deck: string
  section: 'the-network' | 'follow-the-money' | 'the-cover-up' | 'the-operation' | 'voices'
  file: string
  byline: string
  reading_time_minutes: number
  is_featured: boolean
  case_file_slug: string | null
  metadata: Record<string, unknown>
  entities: { name: string; mention_count: number; is_primary: boolean }[]
  citations: {
    number: number
    bates_number: string
    description: string
    page_reference: string
  }[]
}

interface CaseFileDef {
  case_id: string
  slug: string
  title: string
  summary: string
  file: string
  status: 'active' | 'complete'
  date_range_start: string
  date_range_end: string
  docs_reviewed: number
  completion_percentage: number
  methodology_notes: string
  entities: { name: string; role: string }[]
  openQuestions: {
    question: string
    priority: 'critical' | 'high' | 'medium' | 'low'
  }[]
}

// ─── Case File Definitions ────────────────────────────────────────────────────

const CASE_FILES: CaseFileDef[] = [
  {
    case_id: 'CF-2026-000',
    slug: 'master-intelligence-brief',
    title: 'Master Intelligence Brief — EFTA Investigation',
    summary:
      'Cross-thread synthesis of 5 investigation threads analyzing 7 primary source documents totaling ~500 pages from the EFTA corpus. Principal finding: the Epstein estate was a structurally integrated system aligning criminal exposure, financial incentives, governance authority, and witness control against disclosure.',
    file: 'MASTER_INTELLIGENCE_BRIEF.md',
    status: 'complete',
    date_range_start: '2014-11-18',
    date_range_end: '2026-01-30',
    docs_reviewed: 7,
    completion_percentage: 100,
    methodology_notes:
      'Full-text extraction from DOJ-hosted PDFs via SQLite corpus (6.3GB, 1.38M documents). Three-way trust comparison, prosecution memo analysis, and cross-document entity reconciliation.',
    entities: [
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Jes Staley', role: 'subject' },
      { name: 'Leon Black', role: 'subject' },
      { name: 'Glenn Dubin', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'subject' },
      { name: 'Darren Indyke', role: 'subject' },
      { name: 'Richard D. Kahn', role: 'subject' },
      { name: 'Lesley Groff', role: 'subject' },
      { name: 'Eva Andersson-Dubin', role: 'subject' },
      { name: 'Celina Edith Dubin', role: 'subject' },
    ],
    openQuestions: [
      {
        question:
          'What do the redacted pages 74-85 of the prosecution memo say about the three redacted subjects and Leslie Groff?',
        priority: 'critical',
      },
      {
        question:
          'Did Staley ever resign as trustee? If not, did he serve while CEO of Barclays?',
        priority: 'critical',
      },
      {
        question:
          'Why did the AUSA not write a formal assessment of the Leon Black evidence?',
        priority: 'critical',
      },
      {
        question:
          'Why was Celina Dubin the primary beneficiary of the entire Epstein estate?',
        priority: 'critical',
      },
      {
        question:
          "Did prosecutors ever analyze the trust's witness control provisions as part of the conspiracy?",
        priority: 'critical',
      },
      {
        question:
          'What is the "Additional HT Subject" referral (EFTA02731736)?',
        priority: 'critical',
      },
      {
        question:
          "Were Indyke's simultaneous roles (attorney, trustee, $8.25M+ beneficiary, obstruction actor) ever analyzed for conflicts?",
        priority: 'critical',
      },
      {
        question:
          'What did the JPMorgan-produced Staley-Epstein messages around the period of the assault say?',
        priority: 'high',
      },
      {
        question: 'What was in the missing trust Schedule A?',
        priority: 'high',
      },
      {
        question:
          'Who are the A.36 and A.37 beneficiaries (the two-year golden handcuffs)?',
        priority: 'high',
      },
    ],
  },
  {
    case_id: 'CF-2026-001',
    slug: 'staley-trustee-banker',
    title: 'Staley — Trustee, Banker, Accused Rapist',
    summary:
      "Jes Staley signed the Epstein 2014 Trust as a trustee 13 months before becoming Barclays CEO, re-signed twice, and no resignation has been found in 1.38 million documents. The prosecution memo documents a victim's account of rape corroborated by JPMorgan communications.",
    file: 'THREAD_01_Staley_Trustee.md',
    status: 'active',
    date_range_start: '2008-02-01',
    date_range_end: '2025-02-01',
    docs_reviewed: 20,
    completion_percentage: 85,
    methodology_notes:
      '51-query corpus search spanning 7,058 documents across 6 datasets. Deep reads of trust documents (EFTA01266380, 01266403, 01266427) and prosecution memo (EFTA02731082).',
    entities: [
      { name: 'Jes Staley', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Darren Indyke', role: 'linked' },
      { name: 'Lesley Groff', role: 'linked' },
      { name: 'Leon Black', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'Did Staley ever resign as trustee? No resignation found in 1.38M EFTA documents.',
        priority: 'critical',
      },
      {
        question:
          'Why was Staley not analyzed for charges in the prosecution memo despite documented rape and JPMorgan corroboration?',
        priority: 'critical',
      },
      {
        question:
          'What did the JPMorgan-produced Staley-Epstein messages around the period of the assault say?',
        priority: 'critical',
      },
      {
        question:
          'What is the "Barbro and the BBB\'s" reference in EFTA00361732?',
        priority: 'high',
      },
      {
        question:
          'Who is "AF" in EFTA02033217 — possibly another intermediary arranging Staley-Epstein meetings?',
        priority: 'high',
      },
      {
        question:
          "What is the full scope of Staley's DS10 footprint (2,548 documents)?",
        priority: 'high',
      },
      {
        question:
          'Was Staley one of the "redacted males" in trust bequests?',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-002',
    slug: 'dubin-architecture',
    title: 'The Dubin Architecture',
    summary:
      'The Dubin family occupied three structural positions: Celina as primary beneficiary ($250M+), Eva as successor trustee, and Glenn (Tier 1) as a subject of Maxwell-directed sexual contact. The family with the greatest financial interest in the estate had the greatest criminal exposure.',
    file: 'THREAD_02_Dubin_Architecture.md',
    status: 'active',
    date_range_start: '2014-11-18',
    date_range_end: '2019-12-19',
    docs_reviewed: 5,
    completion_percentage: 80,
    methodology_notes:
      'Three-way trust comparison (original, A&R, first amendment). Property trust analysis and residuary estate calculation from EFTA01266380, 01266403, 01266427.',
    entities: [
      { name: 'Glenn Dubin', role: 'subject' },
      { name: 'Eva Andersson-Dubin', role: 'subject' },
      { name: 'Celina Edith Dubin', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Darren Indyke', role: 'linked' },
      { name: 'Les Wexner', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'Why was Celina Edith Dubin the primary beneficiary of the entire Epstein estate?',
        priority: 'critical',
      },
      {
        question:
          'Did SDNY examine the trust-beneficiary connection to the prosecution memo evidence against Glenn Dubin?',
        priority: 'critical',
      },
      {
        question:
          "Has Eva Andersson-Dubin ever served as trustee after Epstein's death?",
        priority: 'high',
      },
      {
        question:
          'What is the current status of the four property trusts (Paris, NYC, Little St. James, NM ranch)?',
        priority: 'high',
      },
      {
        question:
          'What was in the missing trust Schedule A listing all trust assets?',
        priority: 'high',
      },
      {
        question:
          'What is the relationship between the Dubin bequest and the Wexner-origin wealth?',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-003',
    slug: 'witness-control-mechanisms',
    title: 'Witness Control Mechanisms',
    summary:
      'The trust embedded a multi-layered witness control system: employment cliff (added Sep 2015), golden handcuffs ($200K conditional bequests), and no-contest clause. These structural provisions operated alongside active obstruction by the same individual (Indyke) who controlled bequests.',
    file: 'THREAD_03_Witness_Control.md',
    status: 'active',
    date_range_start: '2014-11-18',
    date_range_end: '2019-12-19',
    docs_reviewed: 6,
    completion_percentage: 75,
    methodology_notes:
      'Section-by-section trust comparison across three versions (EFTA01266380, 01266403, 01266427). Cross-reference with prosecution memo obstruction evidence (EFTA02731082).',
    entities: [
      { name: 'Darren Indyke', role: 'subject' },
      { name: 'Richard D. Kahn', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Lesley Groff', role: 'subject' },
    ],
    openQuestions: [
      {
        question:
          "Did SDNY analyze the trust's witness control provisions as part of the Epstein conspiracy?",
        priority: 'critical',
      },
      {
        question:
          "Was Indyke's instruction to the assistant not to speak with police considered for obstruction charges?",
        priority: 'critical',
      },
      {
        question:
          'Who are the A.36 and A.37 beneficiaries — the two employees receiving $200K conditional bequests?',
        priority: 'high',
      },
      {
        question:
          'Was the $250K wire payment days after the Miami Herald series assessed as witness tampering?',
        priority: 'high',
      },
      {
        question:
          "How was the employment cliff (Section 2.5) administered after Epstein's death on August 10, 2019?",
        priority: 'high',
      },
      {
        question:
          'Did any employee-beneficiary cooperate with SDNY despite the financial risk of forfeiture?',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-004',
    slug: 'indyke-conflicts-of-interest',
    title: 'Indyke Conflicts of Interest',
    summary:
      'Darren Indyke held 7 simultaneous roles: attorney, trustee, $5M beneficiary, loan forgiveness recipient, spouse debt cancellation, nominee holder, and sole amendment gatekeeper. Minimum financial exposure: $8.25M+. Benefits escalated across three trust versions.',
    file: 'THREAD_04_Indyke_Conflicts.md',
    status: 'active',
    date_range_start: '2014-11-18',
    date_range_end: '2015-09-30',
    docs_reviewed: 4,
    completion_percentage: 70,
    methodology_notes:
      'Role-by-role analysis across three trust versions (EFTA01266380, 01266403, 01266427). Financial exposure calculation from documented provisions.',
    entities: [
      { name: 'Darren Indyke', role: 'subject' },
      { name: 'Richard D. Kahn', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
    ],
    openQuestions: [
      {
        question:
          'What debts did Indyke owe Epstein and his entities? The blanket cancellation scope suggests significant amounts.',
        priority: 'critical',
      },
      {
        question:
          'Did Indyke use the amendment gatekeeper power after May 2015 to make further trust modifications?',
        priority: 'critical',
      },
      {
        question:
          'What is Harlequin Dane, LLC? Florida entity associated with Indyke, named in debt cancellation.',
        priority: 'high',
      },
      {
        question:
          'What is the relationship between FT Real Estate, Inc. and KCAC, LLC in the $3M Saipher real estate deal?',
        priority: 'high',
      },
      {
        question:
          "How did the Indyke-controlled estate cooperate with prosecutors after Epstein's death?",
        priority: 'high',
      },
      {
        question:
          'Is SLK Designs, LLC connected to Sarah Kellen? Initials match the immunized co-conspirator.',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-005',
    slug: 'prosecutorial-failure',
    title: 'Prosecutorial Failure',
    summary:
      'The SDNY prosecution memo documented 38 victims, 5+ subjects, physical evidence, financial records, and obstruction — then charged only Maxwell. A separate three-year investigation of Leon Black accumulated forensically authenticated evidence — and the case handler never wrote a formal assessment.',
    file: 'THREAD_05_Prosecutorial_Failure.md',
    status: 'active',
    date_range_start: '2019-12-19',
    date_range_end: '2026-01-30',
    docs_reviewed: 30,
    completion_percentage: 90,
    methodology_notes:
      'Prosecution memo section-by-section analysis (EFTA02731082, all 86 pages). Leon Black investigation timeline reconstruction from DS12 communications.',
    entities: [
      { name: 'Leon Black', role: 'subject' },
      { name: 'Jes Staley', role: 'subject' },
      { name: 'Lesley Groff', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'subject' },
      { name: 'Glenn Dubin', role: 'linked' },
      { name: 'Jeffrey Epstein', role: 'subject' },
    ],
    openQuestions: [
      {
        question:
          "Why was Staley excluded from the prosecution memo's charging analysis despite documented rape and corroboration?",
        priority: 'critical',
      },
      {
        question:
          'What do the redacted pages 74-85 of the prosecution memo say about the three redacted subjects?',
        priority: 'critical',
      },
      {
        question:
          'Why did the AUSA admit to not writing a formal assessment of the Leon Black evidence?',
        priority: 'critical',
      },
      {
        question:
          'What is the "Additional HT Subject" referral referenced in EFTA02731736?',
        priority: 'critical',
      },
      {
        question:
          "Did the defendants' wealth and legal resources influence prosecutorial decisions?",
        priority: 'medium',
      },
      {
        question:
          "Was the prosecution memo's scope deliberately limited to protect uncharged subjects?",
        priority: 'medium',
      },
      {
        question:
          'Did institutional factors (election cycles, leadership transitions) affect the investigation timeline?',
        priority: 'medium',
      },
      {
        question:
          'Were the trust documents and prosecution memo ever analyzed together by prosecutors?',
        priority: 'high',
      },
      {
        question:
          'What happened between August 2024 (last known Black investigation activity) and January 2026 (EFTA release)?',
        priority: 'high',
      },
    ],
  },
]

// ─── Story Definitions ───────────────────────────────────────────────────────

const STORIES: StoryDef[] = [
  {
    slug: 'the-golden-handcuffs',
    title: 'The Golden Handcuffs',
    deck: 'How the Epstein 2014 Trust turned employee-witnesses into paid accomplices to silence — and how the attorney who controlled their bequests told them not to talk to police.',
    section: 'the-cover-up',
    file: 'the-golden-handcuffs.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 8,
    is_featured: true,
    case_file_slug: 'witness-control-mechanisms',
    metadata: { source_thread: 'THREAD_03', version: '1.0' },
    entities: [
      { name: 'Darren Indyke', mention_count: 7, is_primary: true },
      { name: 'Richard D. Kahn', mention_count: 4, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 2, is_primary: true },
      { name: 'Lesley Groff', mention_count: 2, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 1, is_primary: false },
      { name: 'Lawrence Visoski', mention_count: 1, is_primary: false },
      { name: 'Karyna Shuliak', mention_count: 1, is_primary: false },
      { name: 'Jean-Luc Brunel', mention_count: 1, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA01266427', description: 'First Amendment — Section 2.5 employment cliff provision', page_reference: 'p. 2' },
      { number: 2, bates_number: 'EFTA01266427', description: 'Employment cliff forfeiture trigger for voluntary discontinuation or misconduct', page_reference: 'pp. 2-3' },
      { number: 3, bates_number: 'EFTA01266427', description: 'Bequest A.36 — $200K conditional on two years of continued service', page_reference: 'p. 1' },
      { number: 4, bates_number: 'EFTA01266427', description: 'Bequest A.37 — identical conditional bequest for female employee', page_reference: 'p. 1' },
      { number: 5, bates_number: 'EFTA01266380', description: 'Original trust — Section 8.5 no-contest (in terrorem) clause', page_reference: '§8.5' },
      { number: 6, bates_number: 'EFTA02731082', description: 'Prosecution memo — Indyke told assistant not to talk to police', page_reference: 'p. 41' },
      { number: 7, bates_number: 'EFTA02731082', description: '$250,000 payment to assistant days after Miami Herald series', page_reference: 'pp. 51-52' },
      { number: 8, bates_number: 'EFTA02731082', description: 'Evidence destruction — computers and contact directories', page_reference: 'pp. 40-41' },
      { number: 9, bates_number: 'EFTA02731082', description: 'Alessi departure warning: "keep your mouth shut"', page_reference: 'p. 37' },
      { number: 10, bates_number: 'EFTA02731082', description: 'Attorney coercion of minor victim — child custody threat', page_reference: 'p. 18' },
      { number: 11, bates_number: 'EFTA01266380', description: 'Lesley Groff $1M bequest (A.10)', page_reference: 'A.10' },
      { number: 12, bates_number: 'EFTA01266380', description: 'Named staff bequests $35K-$66K', page_reference: 'A.10-A.22' },
      { number: 13, bates_number: 'EFTA01266403', description: 'Indyke/Kahn debt forgiveness added in Amendment and Restatement', page_reference: 'Article III' },
      { number: 14, bates_number: 'EFTA01266380', description: 'Inner circle bequests $5M-$10M', page_reference: 'A.1-A.9' },
      { number: 15, bates_number: 'EFTA02731082', description: '$100K wire to associate after negative articles', page_reference: 'p. 52' },
      { number: 16, bates_number: 'EFTA02731082', description: 'Scheduling directory destroyed, never recovered (footnote 47)', page_reference: 'p. 49' },
      { number: 17, bates_number: 'EFTA01266380', description: 'No employment cliff in November 2014 original trust', page_reference: 'Full document' },
      { number: 18, bates_number: 'EFTA01266403', description: 'No employment cliff in May 2015 Amendment and Restatement', page_reference: 'Full document' },
    ],
  },
]

// ─── Content Extraction ───────────────────────────────────────────────────────

function extractFindings(content: string, isMasterBrief: boolean): string {
  // Strip YAML frontmatter
  let body = content.replace(/^---[\s\S]*?---\n*/m, '')

  // Remove Tier System Legend section (match from heading to next numbered section)
  body = body.replace(/\n## Tier System Legend[\s\S]*?(?=\n## \d)/m, '')

  if (isMasterBrief) {
    // Remove section 6 (Open Questions) but keep section 7
    body = body.replace(
      /\n## 6\. Open Questions[\s\S]*?(?=\n## 7\.)/m,
      '\n',
    )
    // Remove appendices
    const appIdx = body.search(/\n## Appendix/)
    if (appIdx > -1) body = body.slice(0, appIdx)
  } else {
    // Remove everything from section 8 (Open Questions) onward
    const oqIdx = body.search(/\n## 8\. Open Questions/)
    if (oqIdx > -1) body = body.slice(0, oqIdx)
  }

  // Clean up extra whitespace
  body = body.replace(/\n{3,}/g, '\n\n').trim()
  // Remove trailing horizontal rules
  body = body.replace(/\n---\s*$/, '').trim()

  return body
}

// ─── Entity UUID Lookup ───────────────────────────────────────────────────────

async function lookupEntityUUIDs(
  names: string[],
): Promise<Map<string, string>> {
  const uuidMap = new Map<string, string>()

  // Fetch all entities and match by name (case-insensitive)
  const { data, error } = await supabase
    .from('entities')
    .select('id, name')
    .in('name', names)

  if (error) {
    console.error('Failed to look up entities:', error.message)
    return uuidMap
  }

  for (const entity of data ?? []) {
    uuidMap.set(entity.name, entity.id)
  }

  // For names not found, try ilike fallback (handles minor name variations)
  const missing = names.filter((n) => !uuidMap.has(n))
  for (const name of missing) {
    const { data: fuzzy } = await supabase
      .from('entities')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)

    if (fuzzy && fuzzy.length > 0) {
      console.log(`  ~ Fuzzy match: "${name}" → "${fuzzy[0].name}"`)
      uuidMap.set(name, fuzzy[0].id)
    }
  }

  return uuidMap
}

// ─── Document UUID Lookup ────────────────────────────────────────────────────

async function lookupDocumentUUIDs(
  batesNumbers: string[],
): Promise<Map<string, string>> {
  const uuidMap = new Map<string, string>()
  const unique = [...new Set(batesNumbers)]

  const { data, error } = await supabase
    .from('documents')
    .select('id, bates_number')
    .in('bates_number', unique)

  if (error) {
    console.error('Failed to look up documents:', error.message)
    return uuidMap
  }

  for (const doc of data ?? []) {
    if (doc.bates_number) {
      uuidMap.set(doc.bates_number, doc.id)
    }
  }

  return uuidMap
}

// ─── Case File ID Lookup ─────────────────────────────────────────────────────

async function lookupCaseFileId(slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('case_files')
    .select('id')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.warn(`  Case file not found: ${slug}`)
    return null
  }

  return data.id
}

// ─── Seed Stories ────────────────────────────────────────────────────────────

async function seedStories(entityUUIDs: Map<string, string>) {
  console.log('\n═══ Seeding Stories ═══\n')

  // Collect all bates numbers for document lookup
  const allBates = [
    ...new Set(STORIES.flatMap((s) => s.citations.map((c) => c.bates_number))),
  ]
  console.log(`Looking up ${allBates.length} source documents...`)
  const docUUIDs = await lookupDocumentUUIDs(allBates)
  console.log(`  Found ${docUUIDs.size}/${allBates.length} documents\n`)

  let totalStories = 0
  let totalCitations = 0
  let totalEntityLinks = 0

  for (const story of STORIES) {
    console.log(`── Story: ${story.title}`)

    // Read markdown
    const filePath = resolve(STORIES_DIR, story.file)
    const bodyMarkdown = readFileSync(filePath, 'utf-8')
    console.log(`   Content: ${bodyMarkdown.length} chars`)

    // Look up case_file_id
    const caseFileId = story.case_file_slug
      ? await lookupCaseFileId(story.case_file_slug)
      : null
    if (story.case_file_slug) {
      console.log(`   Case file: ${caseFileId ? 'linked' : 'NOT FOUND'}`)
    }

    if (DRY_RUN) {
      console.log(`   [dry] Would upsert story: ${story.slug}`)
      console.log(`   [dry] Would insert ${story.citations.length} citations`)
      console.log(`   [dry] Would link ${story.entities.length} entities`)
      totalStories++
      totalCitations += story.citations.length
      totalEntityLinks += story.entities.filter((e) => entityUUIDs.has(e.name)).length
      console.log()
      continue
    }

    // Upsert story (slug is UNIQUE)
    const { data: storyRecord, error: storyError } = await supabase
      .from('stories')
      .upsert(
        {
          slug: story.slug,
          title: story.title,
          deck: story.deck,
          section: story.section,
          body_markdown: bodyMarkdown,
          byline: story.byline,
          reading_time_minutes: story.reading_time_minutes,
          is_published: true,
          is_featured: story.is_featured,
          published_at: new Date().toISOString(),
          case_file_id: caseFileId,
          metadata: story.metadata,
        },
        { onConflict: 'slug' },
      )
      .select()
      .single()

    if (storyError) {
      console.error(`   FAILED story: ${storyError.message}`)
      continue
    }
    console.log(`   Story upserted (id: ${storyRecord.id})`)
    totalStories++

    // Delete + re-insert citations (same pattern as open_questions)
    const { error: delCiteError } = await supabase
      .from('story_citations')
      .delete()
      .eq('story_id', storyRecord.id)

    if (delCiteError) {
      console.error(`   WARNING — Failed to clear old citations: ${delCiteError.message}`)
    }

    const citationRecords = story.citations.map((c) => ({
      story_id: storyRecord.id,
      citation_number: c.number,
      document_id: docUUIDs.get(c.bates_number) ?? null,
      description: c.description,
      bates_number: c.bates_number,
      page_reference: c.page_reference,
    }))

    const { error: citeError } = await supabase
      .from('story_citations')
      .insert(citationRecords)

    if (citeError) {
      console.error(`   FAILED citations: ${citeError.message}`)
    } else {
      totalCitations += story.citations.length
      console.log(`   ${story.citations.length} citations inserted`)
    }

    // Upsert entity links (UNIQUE(story_id, entity_id))
    let linked = 0
    for (const ent of story.entities) {
      const entityId = entityUUIDs.get(ent.name)
      if (!entityId) {
        console.warn(`   SKIP entity link: "${ent.name}" (not found in DB)`)
        continue
      }

      const { error: linkError } = await supabase
        .from('story_entities')
        .upsert(
          {
            story_id: storyRecord.id,
            entity_id: entityId,
            mention_count: ent.mention_count,
            is_primary: ent.is_primary,
          },
          { onConflict: 'story_id,entity_id' },
        )

      if (linkError) {
        console.error(`   FAILED link ${ent.name}: ${linkError.message}`)
        continue
      }
      linked++
      totalEntityLinks++
    }
    console.log(`   ${linked} entity links created`)
    console.log()
  }

  console.log(
    `Stories total: ${totalStories} stories, ${totalCitations} citations, ${totalEntityLinks} entity links`,
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedPublication() {
  console.log(DRY_RUN ? '--- DRY RUN — no writes ---\n' : '--- WRITING to database ---\n')

  // 1. Collect all unique entity names from case files AND stories, then look up UUIDs
  const allEntityNames = [
    ...new Set([
      ...CASE_FILES.flatMap((cf) => cf.entities.map((e) => e.name)),
      ...STORIES.flatMap((s) => s.entities.map((e) => e.name)),
    ]),
  ]
  console.log(`Looking up ${allEntityNames.length} entities...`)
  const entityUUIDs = await lookupEntityUUIDs(allEntityNames)

  const stillMissing = allEntityNames.filter((n) => !entityUUIDs.has(n))
  if (stillMissing.length > 0) {
    console.warn(`  WARNING — Missing entities: ${stillMissing.join(', ')}`)
  }
  console.log(
    `  Found ${entityUUIDs.size}/${allEntityNames.length} entities\n`,
  )

  // 2. Process each case file
  let totalCFs = 0
  let totalOQs = 0
  let totalLinks = 0

  for (const cf of CASE_FILES) {
    console.log(`── ${cf.case_id}: ${cf.title}`)

    // Read and extract findings markdown
    const filePath = resolve(THREADS_DIR, cf.file)
    const raw = readFileSync(filePath, 'utf-8')
    const isMasterBrief = cf.file === 'MASTER_INTELLIGENCE_BRIEF.md'
    const findings = extractFindings(raw, isMasterBrief)

    console.log(`   Content: ${findings.length} chars extracted`)

    if (DRY_RUN) {
      console.log(`   [dry] Would upsert case file: ${cf.slug}`)
      console.log(
        `   [dry] Would insert ${cf.openQuestions.length} open questions`,
      )
      console.log(`   [dry] Would link ${cf.entities.length} entities`)
      totalCFs++
      totalOQs += cf.openQuestions.length
      totalLinks += cf.entities.filter((e) => entityUUIDs.has(e.name)).length
      console.log()
      continue
    }

    // Upsert case file (case_id is UNIQUE)
    const { data: caseFile, error: cfError } = await supabase
      .from('case_files')
      .upsert(
        {
          case_id: cf.case_id,
          slug: cf.slug,
          title: cf.title,
          summary: cf.summary,
          status: cf.status,
          classification: 'public',
          findings_markdown: findings,
          methodology_notes: cf.methodology_notes,
          date_range_start: cf.date_range_start,
          date_range_end: cf.date_range_end,
          docs_reviewed: cf.docs_reviewed,
          completion_percentage: cf.completion_percentage,
          is_published: true,
          published_at: new Date().toISOString(),
          metadata: {},
        },
        { onConflict: 'case_id' },
      )
      .select()
      .single()

    if (cfError) {
      console.error(`   FAILED case file: ${cfError.message}`)
      continue
    }
    console.log(`   Case file upserted (id: ${caseFile.id})`)
    totalCFs++

    // Delete existing open questions for this case file, then insert fresh
    const { error: delOqError } = await supabase
      .from('open_questions')
      .delete()
      .eq('case_file_id', caseFile.id)

    if (delOqError) {
      console.error(`   WARNING — Failed to clear old OQs: ${delOqError.message}`)
    }

    const oqRecords = cf.openQuestions.map((oq) => ({
      case_file_id: caseFile.id,
      question: oq.question,
      priority: oq.priority,
      status: 'open' as const,
      metadata: {},
    }))

    const { error: oqError } = await supabase
      .from('open_questions')
      .insert(oqRecords)

    if (oqError) {
      console.error(`   FAILED open questions: ${oqError.message}`)
    } else {
      totalOQs += cf.openQuestions.length
      console.log(`   ${cf.openQuestions.length} open questions inserted`)
    }

    // Upsert entity links (UNIQUE(case_file_id, entity_id))
    let linked = 0
    for (const ent of cf.entities) {
      const entityId = entityUUIDs.get(ent.name)
      if (!entityId) {
        console.warn(`   SKIP entity link: "${ent.name}" (not found in DB)`)
        continue
      }

      const { error: linkError } = await supabase
        .from('case_file_entities')
        .upsert(
          {
            case_file_id: caseFile.id,
            entity_id: entityId,
            role: ent.role,
          },
          { onConflict: 'case_file_id,entity_id' },
        )

      if (linkError) {
        console.error(`   FAILED link ${ent.name}: ${linkError.message}`)
        continue
      }
      linked++
      totalLinks++
    }
    console.log(`   ${linked} entity links created`)
    console.log()
  }

  console.log('════════════════════════════════════════')
  console.log(
    `Case files: ${totalCFs} files, ${totalOQs} open questions, ${totalLinks} entity links`,
  )

  // 3. Seed stories
  await seedStories(entityUUIDs)

  console.log('\n════════════════════════════════════════')
  console.log('Publication seeding complete.')
  if (DRY_RUN) console.log('(dry run — nothing was written)')
}

seedPublication().catch(console.error)
