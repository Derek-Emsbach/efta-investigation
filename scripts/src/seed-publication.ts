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
  published_at: string
  hero_image_url: string | null
  hero_image_caption: string | null
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
    published_at: '2026-02-28T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Marshal_courthouse_jeh.JPG',
    hero_image_caption: 'The Thurgood Marshall U.S. Courthouse on Foley Square, Manhattan — where SDNY prosecutors documented the trust provisions that kept witnesses silent',
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
  {
    slug: 'the-case-that-wasnt',
    title: 'The Case That Wasn\u2019t',
    deck: 'The prosecution memo documented 38 victims and multiple perpetrators. The Leon Black investigation accumulated three years of evidence. In both cases, the institutional answer was the same: decline.',
    section: 'the-cover-up',
    file: 'the-case-that-wasnt.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 7,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-02-28T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Marshal_courthouse_jeh.JPG',
    hero_image_caption: 'The Thurgood Marshall U.S. Courthouse on Foley Square, Manhattan — where the prosecution memo documented 38 victims but the charging analysis remains 98% redacted',
    metadata: { source_thread: 'THREAD_05', version: '1.0' },
    entities: [
      { name: 'Leon Black', mention_count: 4, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: true },
      { name: 'Jes Staley', mention_count: 2, is_primary: true },
      { name: 'Lesley Groff', mention_count: 2, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 1, is_primary: false },
      { name: 'Glenn Dubin', mention_count: 1, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA02731082', description: 'Prosecution memo — 38 victims, 5 subjects analyzed, only Maxwell charged', page_reference: 'Full document' },
      { number: 2, bates_number: 'EFTA02731082', description: 'Staley raped victim during directed massage; JPMorgan corroboration', page_reference: 'pp. 32, 58, 67' },
      { number: 3, bates_number: 'EFTA02731082', description: 'Leon Black sexually assaulted victim during directed massage', page_reference: 'pp. 22, 32, 55, 58' },
      { number: 4, bates_number: 'EFTA02731082', description: 'Maxwell directed victim to sex acts with Glenn Dubin', page_reference: 'p. 57' },
      { number: 5, bates_number: 'EFTA02731082', description: 'Charging analysis (Section IV, pp. 74-85) — 98% redacted', page_reference: 'pp. 74-85' },
      { number: 6, bates_number: 'EFTA02731082', description: 'Footnote 62 — anticipated recommending charges against Maxwell', page_reference: 'p. 85' },
      { number: 7, bates_number: 'EFTA02731684', description: 'First contact between victim attorney Christensen and AUSA', page_reference: 'Full document' },
      { number: 8, bates_number: 'EFTA02731526', description: 'Bank statements: $15K-$167K from Leon J. Black, J. Black Trust, E Trust', page_reference: 'Full document' },
      { number: 9, bates_number: 'EFTA02731578', description: 'SDNY internal: "I\'m not inclined to open"', page_reference: 'Full document' },
      { number: 10, bates_number: 'EFTA02731729', description: 'Second victim: identical biting violence — "almost a perfect match"', page_reference: 'Full document' },
      { number: 11, bates_number: 'EFTA02731618', description: '"So it doesn\'t seem like we are just rebuffing the victim"', page_reference: 'Full document' },
      { number: 12, bates_number: 'EFTA02731587', description: 'SDNY to DANY: "not likely to open another investigation"', page_reference: 'Full document' },
      { number: 13, bates_number: 'EFTA02731488', description: 'DANY briefing: 3 victims, violence pattern, victim "being 10"', page_reference: 'Full document' },
      { number: 14, bates_number: 'EFTA02731636', description: 'DANY/SDNY: "Potential targets" identified', page_reference: 'Full document' },
      { number: 15, bates_number: 'EFTA02731660', description: 'CRU formal decline: "doesn\'t intend to open"', page_reference: 'Full document' },
      { number: 16, bates_number: 'EFTA02731632', description: 'SDNY internal: "Agree with DTC" (Decline to Charge)', page_reference: 'Full document' },
      { number: 17, bates_number: 'EFTA02731765', description: 'AUSA: "Sorry, I have been on trial"', page_reference: 'Full document' },
      { number: 18, bates_number: 'EFTA02731771', description: 'AUSA: "I did not write anything up on Leon Black"', page_reference: 'Full document' },
      { number: 19, bates_number: 'EFTA02731724', description: 'Victim testimony before Judge Rakoff + forensic journal authentication', page_reference: 'Full document' },
      { number: 20, bates_number: 'EFTA02731734', description: 'Last known document: JPMC distribution order + victim letter', page_reference: 'Full document' },
    ],
  },
  {
    slug: 'the-trustee-with-no-exit',
    title: 'The Trustee With No Exit',
    deck: 'Jes Staley signed the Epstein trust three times, retained Epstein as a banking client after his conviction, and was documented by prosecutors as having raped a victim during a directed massage. No resignation from the trust has been found. No charges have been filed.',
    section: 'the-network',
    file: 'the-trustee-with-no-exit.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 8,
    is_featured: false,
    case_file_slug: 'staley-trustee-banker',
    published_at: '2026-02-28T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Barclays_Bank_PLC_world_headquarters.JPG',
    hero_image_caption: 'Barclays Bank PLC world headquarters in Canary Wharf, London — where Jes Staley served as CEO while his name remained on Epstein\'s trust documents',
    metadata: { source_thread: 'THREAD_01', version: '1.0' },
    entities: [
      { name: 'Jes Staley', mention_count: 5, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 4, is_primary: true },
      { name: 'Darren Indyke', mention_count: 3, is_primary: true },
      { name: 'Lesley Groff', mention_count: 1, is_primary: false },
      { name: 'Ghislaine Maxwell', mention_count: 1, is_primary: false },
      { name: 'Leon Black', mention_count: 2, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA01266380', description: 'Original trust — Staley signed as founding trustee, Nov 18, 2014', page_reference: 'p. 0' },
      { number: 2, bates_number: 'EFTA01266403', description: 'Amendment and Restatement — Staley re-signs; $250K/year trustee compensation', page_reference: 'Section 6.2' },
      { number: 3, bates_number: 'EFTA01266427', description: 'First Amendment — Staley re-signs; adds employment cliff and golden handcuffs', page_reference: 'Full document' },
      { number: 4, bates_number: 'EFTA00162121', description: 'USVI v. JPMorgan complaint — $99M Epstein accounts, 2005 plane flight with Kellen/Marcinkova', page_reference: 'pp. 32, 39' },
      { number: 5, bates_number: 'EFTA01582849', description: 'JPMorgan compliance DDR — Staley conferred with General Counsel, decided to keep Epstein', page_reference: 'Full document' },
      { number: 6, bates_number: 'EFTA01582957', description: 'JPMorgan Maxwell account form — "Ms. Maxwell is known to Jes Staley"', page_reference: 'Full document' },
      { number: 7, bates_number: 'EFTA01824670', description: 'Epstein to Zuckerman: "jes staley, next head of jpm will be at my house"', page_reference: 'Full document' },
      { number: 8, bates_number: 'EFTA02731082', description: 'Prosecution memo — rape allegation: Staley forced victim during directed massage', page_reference: 'p. 32' },
      { number: 9, bates_number: 'EFTA01656173', description: 'FBI PROMINENT NAMES briefing — "Staley forced her to hands on his crotch"', page_reference: 'p. 17' },
      { number: 10, bates_number: 'EFTA02731082', description: 'JPMorgan corroboration — messages between Staley and Epstein around period of assault', page_reference: 'fn. 61, p. 67' },
      { number: 11, bates_number: 'EFTA00156644', description: 'DANY assessment: "believe she was also abused by Staley"', page_reference: 'p. 2' },
      { number: 12, bates_number: 'EFTA00022164', description: 'SDNY-FCA coordination: "not go overt anytime soon" on Staley', page_reference: 'Full document' },
      { number: 13, bates_number: 'EFTA02614253', description: 'Alexa Staley email to Epstein: "Saying hello..."', page_reference: 'Full document' },
      { number: 14, bates_number: 'EFTA02731082', description: 'Charging analysis — 5 subjects evaluated, Staley not among them', page_reference: 'pp. 74-85' },
    ],
  },
  {
    slug: 'the-heirs-with-the-most-to-hide',
    title: 'The Heirs With the Most to Hide',
    deck: 'Celina Dubin inherited essentially the entire Epstein estate — four properties, $20M in operating endowments, 100% of the residuary. Her mother was the successor trustee. Her father appears on page 57 of the prosecution memo.',
    section: 'follow-the-money',
    file: 'the-heirs-with-the-most-to-hide.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 8,
    is_featured: false,
    case_file_slug: 'dubin-architecture',
    published_at: '2026-02-28T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Little_St_James_Island_%289123420726%29.jpg',
    hero_image_caption: 'Little Saint James Island in the U.S. Virgin Islands — one of four international Epstein properties that Celina Dubin was set to inherit',
    metadata: { source_thread: 'THREAD_02', version: '1.0' },
    entities: [
      { name: 'Glenn Dubin', mention_count: 4, is_primary: true },
      { name: 'Eva Andersson-Dubin', mention_count: 3, is_primary: true },
      { name: 'Celina Edith Dubin', mention_count: 2, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 2, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: true },
      { name: 'Darren Indyke', mention_count: 1, is_primary: false },
      { name: 'Jes Staley', mention_count: 1, is_primary: false },
      { name: 'Karyna Shuliak', mention_count: 1, is_primary: false },
      { name: 'Les Wexner', mention_count: 1, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA01266403', description: 'A&R — Celina Dubin property bequests: NYC townhouse with $4M operating fund', page_reference: 'Section 2.3.A.28' },
      { number: 2, bates_number: 'EFTA01266403', description: 'A&R — Celina Dubin: Little St. James Island with $10M operating fund', page_reference: 'Section 2.3.A.29' },
      { number: 3, bates_number: 'EFTA01266403', description: 'A&R — Residuary estate: 100% to Celina Edith Dubin', page_reference: 'Section 2.4.A' },
      { number: 4, bates_number: 'EFTA01266403', description: 'A&R — Eva Andersson-Dubin as successor trustee and contingent beneficiary', page_reference: 'Sections 7.1, 2.4.B' },
      { number: 5, bates_number: 'EFTA02731082', description: 'Prosecution memo — Maxwell directed victim to sex acts with Glenn Dubin', page_reference: 'p. 57' },
      { number: 6, bates_number: 'EFTA02731082', description: 'Prosecution memo — Eva Dubin present during directed massage', page_reference: 'p. 57' },
      { number: 7, bates_number: 'EFTA01266380', description: 'Original trust — primary beneficiary name redacted throughout', page_reference: 'Full document' },
      { number: 8, bates_number: 'EFTA01266403', description: 'A&R — Palm Beach property to Karyna Shuliak with $1M operating fund', page_reference: 'Section 2.3.A.32' },
      { number: 9, bates_number: 'EFTA01266403', description: 'A&R — Section 8.3: trust situs transferable to any country without court approval', page_reference: 'Section 8.3' },
      { number: 10, bates_number: 'EFTA02731082', description: 'Prosecution memo — Epstein wealth "virtually all" derived from Wexner misappropriation', page_reference: 'pp. 64-65' },
      { number: 11, bates_number: 'EFTA01266380', description: 'Original trust references Schedule A — never produced in any EFTA release', page_reference: 'Section 1.1' },
    ],
  },
  {
    slug: 'the-man-who-held-every-key',
    title: 'The Man Who Held Every Key',
    deck: 'Darren Indyke was Epstein\u2019s attorney, trustee, $5M beneficiary, debt cancellation recipient, amendment gatekeeper, and the man who told employees not to talk to police. Seven roles. One person. $8.25 million minimum.',
    section: 'the-network',
    file: 'the-man-who-held-every-key.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 8,
    is_featured: false,
    case_file_slug: 'indyke-conflicts-of-interest',
    published_at: '2026-02-28T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Marshal_courthouse_jeh.JPG',
    hero_image_caption: 'The Thurgood Marshall U.S. Courthouse on Foley Square, Manhattan — where SDNY prosecutors documented Indyke\'s instruction to an employee: "do not talk to the police"',
    metadata: { source_thread: 'THREAD_04', version: '1.0' },
    entities: [
      { name: 'Darren Indyke', mention_count: 6, is_primary: true },
      { name: 'Richard D. Kahn', mention_count: 3, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 2, is_primary: true },
      { name: 'Jes Staley', mention_count: 1, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA01266403', description: 'A&R — Indyke $5M cash bequest (Section 2.3.A.7)', page_reference: 'Section 2.3.A.7' },
      { number: 2, bates_number: 'EFTA01266403', description: 'A&R — Trustee compensation $250K/year (Section 6.2)', page_reference: 'Section 6.2' },
      { number: 3, bates_number: 'EFTA01266403', description: 'A&R — Blanket debt cancellation for Indyke, spouse Saipher, and entity Harlequin Dane LLC', page_reference: 'Section 2.3.A.24' },
      { number: 4, bates_number: 'EFTA01266427', description: 'First Amendment — $3M to wife for NJ real estate, conditioned on marriage', page_reference: 'Section 2.3.A.24 (new)' },
      { number: 5, bates_number: 'EFTA01266380', description: 'Original trust — amendment requires all trustees to sign', page_reference: 'Section 1.3.A' },
      { number: 6, bates_number: 'EFTA01266427', description: 'First Amendment — amendment now requires delivery to only one trustee', page_reference: 'Section 1.3.A' },
      { number: 7, bates_number: 'EFTA01266403', description: 'A&R — 18 investment powers + 12 administrative powers; majority rule', page_reference: 'Sections 6.1, 6.3-6.4' },
      { number: 8, bates_number: 'EFTA01266403', description: 'A&R — Kahn parallel: debt cancellation for self, spouse Lisa Kahn, entity Coatue', page_reference: 'Section 2.3.A.25' },
      { number: 9, bates_number: 'EFTA02731082', description: 'Prosecution memo — Kahn wired $250K to assistant after Miami Herald', page_reference: 'pp. 51-52' },
      { number: 10, bates_number: 'EFTA02731082', description: 'Prosecution memo — Indyke told assistant not to talk to police', page_reference: 'p. 41' },
      { number: 11, bates_number: 'EFTA01266427', description: 'First Amendment — Indyke as nominee holder of Lyn & Jojo LLC', page_reference: 'Section 2.3.A.12' },
      { number: 12, bates_number: 'EFTA02731082', description: 'Prosecution memo — charging analysis entirely redacted (pp. 74-85)', page_reference: 'pp. 74-85' },
    ],
  },
  {
    slug: 'the-system',
    title: 'The System',
    deck: 'Five interlocking components — financial incentives, governance control, witness suppression, beneficiary alignment, and prosecutorial inaction — produced one outcome: the evidence is in the public record, the accountability is not.',
    section: 'the-operation',
    file: 'the-system.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 9,
    is_featured: false,
    case_file_slug: 'master-intelligence-brief',
    published_at: '2026-02-28T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Little_St_James_Island_%289123420726%29.jpg',
    hero_image_caption: 'Little Saint James Island in the U.S. Virgin Islands — the private island at the center of Epstein\'s trafficking operation, one of four properties controlled by the trust',
    metadata: { source_thread: 'MASTER_BRIEF', version: '1.0' },
    entities: [
      { name: 'Darren Indyke', mention_count: 4, is_primary: true },
      { name: 'Jes Staley', mention_count: 3, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 2, is_primary: true },
      { name: 'Glenn Dubin', mention_count: 2, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: true },
      { name: 'Leon Black', mention_count: 2, is_primary: true },
      { name: 'Celina Edith Dubin', mention_count: 1, is_primary: false },
      { name: 'Eva Andersson-Dubin', mention_count: 1, is_primary: false },
      { name: 'Richard D. Kahn', mention_count: 1, is_primary: false },
      { name: 'Lesley Groff', mention_count: 1, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA01266380', description: 'Original trust — Staley signed as trustee, three signatures across three versions', page_reference: 'p. 0' },
      { number: 2, bates_number: 'EFTA02731082', description: 'Prosecution memo — Staley rape during directed massage, JPMorgan corroboration', page_reference: 'pp. 32, 67' },
      { number: 3, bates_number: 'EFTA01266403', description: 'A&R — Celina Dubin: all properties + 100% residuary ($250M+)', page_reference: 'Sections 2.3, 2.4' },
      { number: 4, bates_number: 'EFTA02731082', description: 'Prosecution memo — Maxwell directed victim to sex acts with Glenn Dubin', page_reference: 'p. 57' },
      { number: 5, bates_number: 'EFTA01266427', description: 'First Amendment — employment cliff, golden handcuffs, misconduct forfeiture', page_reference: 'Section 2.5' },
      { number: 6, bates_number: 'EFTA01266403', description: 'A&R — Indyke: $5M bequest, $250K/yr, debt cancellation ($8.25M+ minimum)', page_reference: 'Sections 2.3.A.7, 2.3.A.24, 6.2' },
      { number: 7, bates_number: 'EFTA02731082', description: 'Prosecution memo — Indyke told assistant not to talk to police', page_reference: 'p. 41' },
      { number: 8, bates_number: 'EFTA02731082', description: 'Prosecution memo — 38 victims, 5 subjects analyzed, charging analysis 98% redacted', page_reference: 'pp. 74-85' },
      { number: 9, bates_number: 'EFTA02731771', description: 'AUSA admission: "I did not write anything up on Leon Black"', page_reference: 'Full document' },
    ],
  },
  // ─── Story 7: The Scheduler (Lesley Groff) ─────────────────────────────────
  {
    slug: 'the-scheduler',
    title: 'The Scheduler',
    deck: 'For eighteen years, Lesley Groff scheduled Epstein\'s "massages," booked victims\' flights, and ran the daily logistics of a trafficking operation — from a law office. Prosecutors said her denials would not be credible. The charging analysis is entirely redacted.',
    section: 'the-network' as const,
    file: 'the-scheduler.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 7,
    is_featured: false,
    case_file_slug: null,
    published_at: '2026-03-12T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Victoria%27s_Secret_Store_10%2C_722_Lexington_Ave%2C_New_York%2C_NY_10022%2C_USA_-_Dec_2012.JPG',
    hero_image_caption: 'Victoria\'s Secret at 722 Lexington Avenue, Manhattan — the brand name Epstein invoked as a recruitment lure, and a block from 575 Lexington where Groff worked in Darren Indyke\'s law office',
    metadata: { source_analysis: 'docs/investigation/LESLEY_GROFF_Analysis.md' },
    entities: [
      { name: 'Lesley Groff', mention_count: 18, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 12, is_primary: true },
      { name: 'Darren Indyke', mention_count: 5, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: false },
      { name: 'Les Wexner', mention_count: 1, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA02731082', description: 'SDNY prosecution memo — Groff\'s operational role: scheduling massages, booking interstate flights for victims', page_reference: 'p. 63' },
      { number: 2, bates_number: 'EFTA01653331', description: 'SDNY arrest briefing — schedulers\' denials "not credible," special precautions for subpoena', page_reference: 'pp. 1-5' },
      { number: 3, bates_number: 'EFTA02731039', description: 'SDNY prosecution memo — Victim-1 identified "Leslie" as scheduler, confirmed as Leslie Groff', page_reference: 'pp. 1-2' },
      { number: 4, bates_number: 'EFTA02731082', description: 'Prosecution memo — Epstein directed Groff to buy Victoria\'s Secret underwear for victim', page_reference: 'p. 26' },
      { number: 5, bates_number: 'EFTA02731082', description: 'Prosecution memo — victim recalls Groff "right outside the closed door" during forced oral sex', page_reference: 'p. 28' },
      { number: 6, bates_number: 'EFTA02731082', description: 'Prosecution memo — Groff trained other schedulers, served as direct supervisor', page_reference: 'p. 41' },
      { number: 7, bates_number: 'EFTA01688359', description: 'FBI case file index — Serial #130: "INTERVIEW OF LESLIE GROFF"', page_reference: 'Serial 130' },
      { number: 8, bates_number: 'EFTA01656152', description: 'FBI investigation presentation — NPA covered 4 co-conspirators including Groff', page_reference: 'Timeline slide' },
      { number: 9, bates_number: 'EFTA01681865', description: 'Deutsche Bank compliance report — Groff as NPA co-conspirator, wire transfers, legal fees', page_reference: 'fn. 42, wire transfer tables' },
      { number: 10, bates_number: 'EFTA01653324', description: 'SDNY legal memo — NPA does not apply to Southern District of New York', page_reference: 'Full document' },
      { number: 11, bates_number: 'EFTA02737678', description: 'Boies Schiller letter — Indyke "employed Lesley Groff as an executive assistant for his law practice"', page_reference: 'fn. 3' },
      { number: 12, bates_number: 'EFTA02074706', description: 'Groff-Avdiu coordination emails — scheduling from Indyke PLLC office', page_reference: 'Full document' },
      { number: 13, bates_number: 'EFTA01424842', description: 'Jeepers Inc bank records — Groff as Authorized Signer alongside Indyke and Epstein', page_reference: 'Signer list' },
      { number: 14, bates_number: 'EFTA01654108', description: 'FBI FinCEN alert — Groff on financial surveillance list with Epstein, Maxwell, Indyke, Brunel', page_reference: 'Full document' },
      { number: 15, bates_number: 'EFTA01649143', description: 'FBI case summary — reverse proffer "generally positive," post-death investigation focused on Groff', page_reference: 'pp. 3-4' },
      { number: 16, bates_number: 'EFTA02731082', description: 'Prosecution memo — prosecutors warned no agreement without proffer, Fifth Amendment invoked', page_reference: 'pp. 63-64' },
      { number: 17, bates_number: 'EFTA01682023', description: 'Formal proffer agreement — "THIS IS NOT A COOPERATION AGREEMENT," continuation dates', page_reference: 'pp. 1-2' },
      { number: 18, bates_number: 'EFTA02731082', description: 'Prosecution memo — Section D (Groff charging analysis) entirely redacted, Category C protection', page_reference: 'pp. 75-85' },
      { number: 19, bates_number: 'EFTA00498087', description: 'Groff email April 2019 — "Jeffrey says he won\'t be in NY those dates! It\'s hard to keep up"', page_reference: 'Full document' },
    ],
  },
  // ─── Story 8: The Billion-Dollar Blind Eye (Leon Black) ───────────────────
  {
    slug: 'the-billion-dollar-blind-eye',
    title: 'The Billion-Dollar Blind Eye',
    deck: 'Three victims. Forensic journals. Bank records. A $62.5 million settlement. A $158 million relationship with Epstein. And an AUSA who admitted: "I did not write anything up on Leon Black."',
    section: 'follow-the-money' as const,
    file: 'the-billion-dollar-blind-eye.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-12T00:00:00Z',
    hero_image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Marshal_courthouse_jeh.JPG',
    hero_image_caption: 'The Thurgood Marshall U.S. Courthouse on Foley Square, Manhattan — home of the Southern District of New York, which declined to charge Leon Black despite three years of accumulating evidence.',
    metadata: { source_analysis: 'docs/investigation/sources/LEON_BLACK/Analysis.md' },
    entities: [
      { name: 'Leon Black', mention_count: 16, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 6, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: true },
      { name: 'Jes Staley', mention_count: 0, is_primary: false },
    ],
    citations: [
      { number: 1, bates_number: 'EFTA02731699', description: 'FBI 302 / AUSA interview logistics — first and only victim interview at 290 Broadway', page_reference: 'Full document' },
      { number: 2, bates_number: 'EFTA02731526', description: 'Bank statements: $15K-$167K wire payments from Leon J. Black, J. Black Trust, E Trust', page_reference: 'Full document' },
      { number: 3, bates_number: 'EFTA02731576', description: 'Victim text to Black: "You sexually harassed me, sex trafficked me, raped me"', page_reference: 'Full document' },
      { number: 4, bates_number: 'EFTA02731578', description: 'SDNY internal: "I\'m not inclined to open based on the other victim, for a variety of reasons"', page_reference: 'Full document' },
      { number: 5, bates_number: 'EFTA02731684', description: 'First contact: Christensen reaches SDNY AUSA about Leon Black', page_reference: 'Full document' },
      { number: 6, bates_number: 'EFTA02731699', description: 'FBI agent: "Once you\'re ready to set up an interview, let me know"', page_reference: 'Full document' },
      { number: 7, bates_number: 'EFTA02731771', description: 'AUSA admission: "I did not write anything up on Leon Black"', page_reference: 'Full document' },
      { number: 8, bates_number: 'EFTA02731729', description: 'Second victim: identical biting violence — "almost a perfect match"', page_reference: 'Full document' },
      { number: 9, bates_number: 'EFTA02731618', description: '"So it doesn\'t seem like we are just rebuffing the victim" — optics-driven delay', page_reference: 'Full document' },
      { number: 10, bates_number: 'EFTA02731023', description: 'Senate Finance Committee letter: $158M payments, no contract, trust scheme, $1B+ tax avoidance', page_reference: 'Full document (13 pages)' },
      { number: 11, bates_number: 'EFTA02731593', description: 'DANY-SDNY correspondence: new CW trafficked by Maxwell and Epstein; SDNY "not likely to open"', page_reference: 'Full document' },
      { number: 12, bates_number: 'EFTA02731488', description: 'DANY memo: minor victim (16), sex toys, rectal bleeding, denied medical care, "being 10"', page_reference: 'Full document' },
      { number: 13, bates_number: 'EFTA02731662', description: 'Medical records: OB-GYN 2011 and 2019 documenting sexual assault injuries', page_reference: 'Full document' },
      { number: 14, bates_number: 'EFTA02731486', description: 'Supervisor: "[AUSA] looked at it but determined it was not viable (and I agreed)"', page_reference: 'Full document' },
      { number: 15, bates_number: 'EFTA02731484', description: 'Christensen: "$62.5M to USVI... one lawyer represents ten women... outrageous"', page_reference: 'Full document' },
      { number: 16, bates_number: 'EFTA02731660', description: 'CRU formal decline: "no evidence of overlap with Maxwell... doesn\'t intend to open"', page_reference: 'Full document' },
      { number: 17, bates_number: 'EFTA02731632', description: '"Agree with DTC" (Decline to Charge)', page_reference: 'Full document' },
      { number: 18, bates_number: 'EFTA02731724', description: 'Victim testimony before Judge Rakoff + forensic journal authentication (gel pen, no fabrication)', page_reference: 'Full document' },
      { number: 19, bates_number: 'EFTA02731633', description: 'Christensen marks request as "urgent" — July 2024', page_reference: 'Full document' },
      { number: 20, bates_number: 'EFTA02731765', description: 'SDNY to DANY: "Sorry, I have been on trial"', page_reference: 'Full document' },
      { number: 21, bates_number: 'EFTA02731525', description: 'Black text to victim after learning of her statements — "how damaging they would be to me"', page_reference: 'Full document' },
      { number: 22, bates_number: 'EFTA02731577', description: 'Black hired Brad Edwards (victims\' rights attorney) — conflict of interest', page_reference: 'Full document' },
    ],
  },
  // ─── Story 9: The Recruitment Trip (Cape Town) ──────────────────────────────
  {
    slug: 'the-recruitment-trip',
    title: 'The Recruitment Trip',
    deck: 'In September 2002, Jeffrey Epstein flew Bill Clinton, Kevin Spacey, and Chris Tucker to Cape Town on his Boeing 727. At a restaurant, a 20-year-old South African was told he was "the King of America." His scheduler arranged her visa from New York. The abuse began on arrival in the United States.',
    section: 'the-operation' as const,
    file: 'the-recruitment-trip.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 8,
    is_featured: false,
    case_file_slug: null,
    published_at: '2026-03-12T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/a/a9/Table_mountain_and_the_ocean_cape_town.JPG',
    hero_image_caption:
      'Table Mountain and the Cape Town waterfront, South Africa — where Jeffrey Epstein recruited a 20-year-old aspiring model in September 2002, during a trip that also carried Bill Clinton, Kevin Spacey, and Chris Tucker on his Boeing 727.',
    metadata: {
      source_analysis: 'docs/investigation/DS12_EXPANSION_Analysis.md',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 12, is_primary: true },
      { name: 'Bill Clinton', mention_count: 6, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: true },
      { name: 'Lesley Groff', mention_count: 3, is_primary: true },
      { name: 'Les Wexner', mention_count: 2, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02731941',
        description:
          'Juliette civil complaint — Cape Town restaurant scene, Epstein described as "the King of America"',
        page_reference: 'Complaint ¶¶17-19',
      },
      {
        number: 2,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — Epstein claimed to own modeling agency, invoked Wexner/Victoria\'s Secret',
        page_reference: 'Complaint ¶¶21-22',
      },
      {
        number: 3,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — Epstein called her mother to assure safety',
        page_reference: 'Complaint ¶24',
      },
      {
        number: 4,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — trafficking sequence: 66th St apartment, Virgin Islands, multi-location abuse 2002-2004',
        page_reference: 'Complaint ¶¶25-35',
      },
      {
        number: 5,
        bates_number: 'EFTA01661603',
        description:
          'New York Magazine "Jeffrey Epstein: International Moneyman of Mystery" — Boeing 727 Africa tour described',
        page_reference: 'Full article',
      },
      {
        number: 6,
        bates_number: 'EFTA01661603',
        description:
          'NY Magazine — names Clinton, Spacey, Tucker; "soaking up the love from Cape Town to Lagos"',
        page_reference: 'Full article',
      },
      {
        number: 7,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — former official gave speech next day, police escort tied to his security detail',
        page_reference: 'Complaint ¶20',
      },
      {
        number: 8,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — modeling agency recruitment pattern documented across multiple victims',
        page_reference: 'pp. 28, 37',
      },
      {
        number: 9,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — Lesley Groff arranged U.S. visa, passport, and airline tickets from New York',
        page_reference: 'Complaint ¶23',
      },
      {
        number: 10,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — Virgin Islands: co-conspirator directed massage, sexual abuse began immediately',
        page_reference: 'Complaint ¶¶28-30',
      },
      {
        number: 11,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — Paris with Maxwell: forced nude photography, witnessed other young victims',
        page_reference: 'Complaint ¶¶30-32',
      },
      {
        number: 12,
        bates_number: 'EFTA02731941',
        description:
          'Annie Farmer civil case (19-cv-10475) — Maxwell named as defendant for normalizing sexual contact',
        page_reference: 'Case filing',
      },
      {
        number: 13,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — Zorro Ranch 2004: "another important government official," "serve drinks to scientist friends"',
        page_reference: 'Complaint ¶50',
      },
      {
        number: 14,
        bates_number: 'EFTA01247021',
        description:
          'Pilot Larry Morrison deposition — saw Governor Bill Richardson arrive at Zorro Ranch for dinner',
        page_reference: 'pp. 167-169',
      },
      {
        number: 15,
        bates_number: 'EFTA02732243',
        description:
          'Consolidated discovery conference — estate possessed 700K+ documents, produced 3 (one clawed back)',
        page_reference: 'Full transcript',
      },
      {
        number: 16,
        bates_number: 'EFTA02732143',
        description:
          'Boies Schiller opposition brief — "estate has taken the position of attempting to prove Epstein\'s innocence"',
        page_reference: 'Full document',
      },
      {
        number: 17,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — 2016 Epstein email asking if she knew another victim by name',
        page_reference: 'Complaint ¶52',
      },
      {
        number: 18,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint — June 2019 Epstein email requesting nude photographs (2 months before death)',
        page_reference: 'Complaint ¶53',
      },
      {
        number: 19,
        bates_number: 'EFTA02731941',
        description:
          'Case filing: Juliette v. Indyke & Kahn, 1:19-cv-10479-ALC-DCF, filed November 14, 2019',
        page_reference: 'Cover page',
      },
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
          published_at: story.published_at,
          case_file_id: caseFileId,
          hero_image_url: story.hero_image_url,
          hero_image_caption: story.hero_image_caption,
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
