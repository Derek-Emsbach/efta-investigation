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
const SEED_AS_DRAFT = process.argv.includes('--draft')
const THREADS_DIR = resolve(rootDir, 'docs/investigation/threads')
const STORIES_DIR = resolve(rootDir, 'docs/stories')

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryDef {
  slug: string
  title: string
  deck: string
  section: 'the-network' | 'follow-the-money' | 'the-cover-up' | 'the-operation' | 'voices' | 'trump'
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
      'Cross-thread synthesis of 10 investigation threads analyzing 60+ primary source documents from the EFTA corpus. Principal finding: the Epstein estate was a structurally integrated system aligning criminal exposure, financial incentives, governance authority, and witness control against disclosure — supported by institutional banking, modeling pipeline trafficking, NPA immunity, and shell company infrastructure.',
    file: 'MASTER_INTELLIGENCE_BRIEF.md',
    status: 'complete',
    date_range_start: '2014-11-18',
    date_range_end: '2026-03-14',
    docs_reviewed: 60,
    completion_percentage: 100,
    methodology_notes:
      'Full-text extraction from DOJ-hosted PDFs via SQLite corpus (6.3GB, 1.38M documents). Three-way trust comparison, prosecution memo analysis, cross-document entity reconciliation, institutional banking analysis, corporate registry research, and NPA immunity assessment.',
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
      { name: 'Sarah Kellen', role: 'subject' },
      { name: 'Jean-Luc Brunel', role: 'subject' },
      { name: 'Nadia Marcinkova', role: 'subject' },
      { name: 'Adriana Ross', role: 'subject' },
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
    docs_reviewed: 25,
    completion_percentage: 87,
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
    docs_reviewed: 12,
    completion_percentage: 80,
    methodology_notes:
      'Section-by-section trust comparison across three versions (EFTA01266380, 01266403, 01266427). Cross-reference with prosecution memo obstruction evidence (EFTA02731082).',
    entities: [
      { name: 'Darren Indyke', role: 'subject' },
      { name: 'Richard D. Kahn', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Lesley Groff', role: 'subject' },
      { name: 'Sarah Kellen', role: 'linked' },
      { name: 'Nadia Marcinkova', role: 'linked' },
      { name: 'Adriana Ross', role: 'linked' },
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
          'Did the 1953 Trust loyalty clause (Section 2.5B) deter any beneficiaries from cooperating with prosecutors?',
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
          'Did NPA immunity for Kellen, Marcinkova, and Ross eliminate prosecutorial leverage that might have overcome the trust silencing mechanisms?',
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
    docs_reviewed: 10,
    completion_percentage: 78,
    methodology_notes:
      'Role-by-role analysis across three trust versions (EFTA01266380, 01266403, 01266427). Financial exposure calculation from documented provisions.',
    entities: [
      { name: 'Darren Indyke', role: 'subject' },
      { name: 'Richard D. Kahn', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Lesley Groff', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'What debts did Indyke owe Epstein and his entities? The blanket cancellation scope suggests significant amounts.',
        priority: 'critical',
      },
      {
        question:
          'What was the full scope of Indyke\'s authorized signer authority across the 30+ shell entities?',
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
    docs_reviewed: 45,
    completion_percentage: 95,
    methodology_notes:
      'Prosecution memo section-by-section analysis (EFTA02731082, all 86 pages). Leon Black investigation timeline reconstruction from DS12 communications.',
    entities: [
      { name: 'Leon Black', role: 'subject' },
      { name: 'Jes Staley', role: 'subject' },
      { name: 'Lesley Groff', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'subject' },
      { name: 'Glenn Dubin', role: 'linked' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Sarah Kellen', role: 'linked' },
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
  {
    case_id: 'CF-2026-006',
    slug: 'leon-black-prosecution-failure',
    title: 'Leon Black — Private Equity, Prosecution Decline',
    summary:
      'Leon Black made $158 million in documented payments to Epstein. A 3-year SDNY investigation accumulated forensically authenticated victim journals, 3+ corroborating victims, bank statements, and medical records — yet the original AUSA never wrote a formal assessment. Black settled with USVI for $62.5 million. Zero criminal charges filed.',
    file: 'THREAD_06_Leon_Black.md',
    status: 'active',
    date_range_start: '2012-01-01',
    date_range_end: '2024-08-01',
    docs_reviewed: 25,
    completion_percentage: 90,
    methodology_notes:
      'Dataset 12 email reconstruction (prosecution timeline), victim journal forensic analysis cross-reference, financial records from Deutsche Bank and JPMorgan productions.',
    entities: [
      { name: 'Leon Black', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'linked' },
      { name: 'Jean-Luc Brunel', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'Why was no formal prosecution assessment written despite three years of evidence accumulation?',
        priority: 'critical',
      },
      {
        question:
          'What triggered the $62.5M USVI settlement? Was it connected to EFTA disclosure timelines?',
        priority: 'critical',
      },
      {
        question:
          "Did Christensen's departure from SDNY effectively end the Leon Black investigation?",
        priority: 'high',
      },
      {
        question:
          'What is the full scope of the $158M in payments — were they personal or routed through Apollo entities?',
        priority: 'high',
      },
      {
        question:
          'How many victims are documented in the forensic journals naming Leon Black?',
        priority: 'high',
      },
      {
        question:
          'Did the Apollo Global Management board investigate Black\'s Epstein payments before his resignation?',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-007',
    slug: 'deutsche-bank-compliance-failure',
    title: 'Deutsche Bank — Institutional Complicity',
    summary:
      'Deutsche Bank maintained 76 accounts for Epstein under the "Southern Financial Relationship" designation, processing payments to named co-conspirators including Brunel and Kellen. Compliance systems documented suspicious activity repeatedly without escalation. NYDFS imposed a $150M penalty in 2020 — the largest regulatory fine in the case.',
    file: 'THREAD_07_Deutsche_Bank.md',
    status: 'active',
    date_range_start: '2013-08-19',
    date_range_end: '2020-07-06',
    docs_reviewed: 15,
    completion_percentage: 85,
    methodology_notes:
      'NYDFS Consent Order analysis, Deutsche Bank internal compliance review documents, Butterfly Trust corporate structure analysis, cross-reference with prosecution memo financial evidence.',
    entities: [
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Darren Indyke', role: 'linked' },
      { name: 'Lesley Groff', role: 'linked' },
      { name: 'Jean-Luc Brunel', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'Which individual compliance reviewers approved continued banking despite documented red flags?',
        priority: 'critical',
      },
      {
        question:
          "What was the Butterfly Trust's actual purpose and who were its beneficiaries?",
        priority: 'critical',
      },
      {
        question:
          'How much of the $150M NYDFS penalty was related to Epstein-specific compliance failures vs. broader AML deficiencies?',
        priority: 'high',
      },
      {
        question:
          'What were the "ostensible foreign models" payments and did Deutsche Bank report them to FinCEN?',
        priority: 'high',
      },
      {
        question:
          'Did Deutsche Bank\'s relationship with Epstein continue after JPMorgan terminated its accounts in 2013?',
        priority: 'high',
      },
      {
        question:
          'Were any Deutsche Bank compliance officers referred for criminal prosecution?',
        priority: 'medium',
      },
      {
        question:
          'What was the full scope of the "Southern Financial Relationship" — how many entities were included beyond the 76 accounts?',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-008',
    slug: 'brunel-modeling-pipeline',
    title: 'Jean-Luc Brunel — The Modeling Pipeline',
    summary:
      'Jean-Luc Brunel operated MC2 Model Management as a trafficking front, capitalized with a $1M wire from Epstein. The pipeline extended back to Karin Models (1978) and was documented by CBS 60 Minutes (1988), FBI interviews, and French prosecution. Brunel died in custody in February 2022 (ruled suicide), ending criminal proceedings.',
    file: 'THREAD_08_Brunel_Modeling_Pipeline.md',
    status: 'complete',
    date_range_start: '1978-01-01',
    date_range_end: '2022-02-19',
    docs_reviewed: 15,
    completion_percentage: 85,
    methodology_notes:
      'CBS 60 Minutes transcript analysis, FBI interview documentation, French prosecution records, MC2 corporate filings, SDNY prosecution memo cross-reference (EFTA02731082).',
    entities: [
      { name: 'Jean-Luc Brunel', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'linked' },
      { name: 'Lesley Groff', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          "What was the extent of Maxwell's involvement in the MC2/modeling pipeline operations?",
        priority: 'critical',
      },
      {
        question:
          'How many models were recruited through MC2 and what happened to them after arriving in the US?',
        priority: 'critical',
      },
      {
        question:
          'Did MC2 operate as a legitimate modeling agency alongside its trafficking function?',
        priority: 'high',
      },
      {
        question:
          "What was Groff's role in Brunel's travel logistics and visa arrangements?",
        priority: 'high',
      },
      {
        question:
          'Were other modeling agencies besides MC2 and Karin Models involved in the pipeline?',
        priority: 'medium',
      },
      {
        question:
          'What are the circumstances of Brunel\'s death in custody and who had access to him?',
        priority: 'medium',
      },
      {
        question:
          'Did FBI Agent Cordero\'s confirmation of MC2 as trafficking front lead to any federal action?',
        priority: 'high',
      },
    ],
  },
  {
    case_id: 'CF-2026-009',
    slug: 'npa-co-conspirators',
    title: 'The NPA Co-Conspirators — Immunity and Impunity',
    summary:
      'The September 2007 Non-Prosecution Agreement granted blanket immunity to "any potential co-conspirators" — named and unnamed. A sealed 53-page indictment and 82-page prosecution memo documented per-person evidence against Sarah Kellen, Nadia Marcinkova, and Adriana Ross. The NPA converted sufficient evidence into historical record rather than charging instruments.',
    file: 'THREAD_09_NPA_Co_Conspirators.md',
    status: 'active',
    date_range_start: '2007-09-24',
    date_range_end: '2026-01-30',
    docs_reviewed: 20,
    completion_percentage: 80,
    methodology_notes:
      'NPA text analysis, sealed indictment cross-reference, prosecution memo per-person evidence extraction, CVRA litigation timeline, post-NPA career tracking.',
    entities: [
      { name: 'Sarah Kellen', role: 'subject' },
      { name: 'Nadia Marcinkova', role: 'subject' },
      { name: 'Adriana Ross', role: 'subject' },
      { name: 'Lesley Groff', role: 'linked' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'What does the sealed 53-page indictment contain beyond what is in the prosecution memo?',
        priority: 'critical',
      },
      {
        question:
          "Who negotiated the NPA's blanket immunity provision and was it standard practice?",
        priority: 'critical',
      },
      {
        question:
          'Did the NPA immunity extend to conduct that occurred after the agreement was signed?',
        priority: 'high',
      },
      {
        question:
          'Were any co-conspirators offered immunity in exchange for cooperation, and did any cooperate?',
        priority: 'high',
      },
      {
        question:
          'What was the basis for the CVRA challenge and what did the 11th Circuit rule in 2019?',
        priority: 'high',
      },
      {
        question:
          'Did Kellen, Marcinkova, or Ross provide any cooperation to SDNY after 2019?',
        priority: 'medium',
      },
      {
        question:
          "How did Kellen's rebranding as Sarah Vickers and career in interior design escape public scrutiny?",
        priority: 'medium',
      },
      {
        question:
          'Was the 82-page prosecution memo ever formally considered for reopening after the NPA was voided?',
        priority: 'high',
      },
    ],
  },
  {
    case_id: 'CF-2026-010',
    slug: 'shell-company-infrastructure',
    title: 'The Shell Company Infrastructure',
    summary:
      'Darren Indyke and Richard D. Kahn controlled a network of 30+ shell entities organizing Epstein\'s $577M estate. Tree-named property corporations, financial vehicles, and aviation entities were managed by a 5-person signer pool. The 1953 Trust\'s Section 2.5(B) loyalty clause ensured beneficiary silence for 2 years post-death.',
    file: 'THREAD_10_Shell_Companies.md',
    status: 'active',
    date_range_start: '2000-01-01',
    date_range_end: '2019-08-10',
    docs_reviewed: 20,
    completion_percentage: 75,
    methodology_notes:
      'Corporate registry research (NY, FL, USVI, NM), trust instrument analysis, Deutsche Bank account structure cross-reference, prosecution memo financial evidence correlation.',
    entities: [
      { name: 'Darren Indyke', role: 'subject' },
      { name: 'Richard D. Kahn', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Lesley Groff', role: 'linked' },
      { name: 'Erika Kellerhals', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'What was the full scope of the "Southern Financial Relationship" that Deutsche Bank used to designate Epstein\'s accounts?',
        priority: 'critical',
      },
      {
        question:
          'How many of the 30+ shell entities are still active and who controls them post-death?',
        priority: 'critical',
      },
      {
        question:
          'What was the purpose of the tree-named property corporations — were they used for asset concealment?',
        priority: 'high',
      },
      {
        question:
          'Who is the 5th member of the signer pool beyond Indyke, Kahn, Groff, and Kellerhals?',
        priority: 'high',
      },
      {
        question:
          'Were any shell entities used to make payments that would otherwise be traceable to Epstein?',
        priority: 'high',
      },
      {
        question:
          'Did the $577M estate valuation include assets held in non-US jurisdictions?',
        priority: 'medium',
      },
      {
        question:
          'What happened to assets in the 1953 Trust after the 2-year loyalty period expired?',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-011',
    slug: 'intelligence-diplomatic-network',
    title: 'The Intelligence & Diplomatic Network',
    summary:
      'Two investigation threads reveal Epstein operating a post-conviction political influence infrastructure that extended into active intelligence and diplomatic circles. Thread 15 documents a September 2014 convergence of 15+ political, diplomatic, and intelligence figures at his Manhattan townhouse — including the sitting Deputy Secretary of State (later CIA Director), the Secretary General of the Council of Europe, and a former Israeli Prime Minister. Thread 16 investigates the intelligence asset question directly: an FBI FD-1023 classified SECRET//NOFORN describes Epstein as a "construct" running "an Israeli state-sponsored technology collection and extortion operation," corroborated by the U.S. Attorney who gave Epstein his plea deal stating he was told Epstein "belonged to intelligence" and was "above his pay grade." Physical evidence includes an Austrian passport under the false name "Marius Robert Fortelni" with travel stamps from Saudi Arabia, and concealed cameras throughout properties whose recordings the FBI Director refuses to confirm or deny possessing.',
    file: 'THREAD_15_September_2014_Convergence.md',
    status: 'active',
    date_range_start: '2013-03-01',
    date_range_end: '2024-06-01',
    docs_reviewed: 55,
    completion_percentage: 70,
    methodology_notes:
      'Corpus full-text search across 1.38M documents using FTS5. Scheduling email reconstruction from Lesley Groff daily schedules and Epstein personal Gmail correspondence. FBI FD-1023 analysis. Austrian passport evidence chain. Congressional hearing transcript analysis. Cross-reference with Robert Maxwell/Mossad reporting. Carbyne/Unit 8200 technology assessment.',
    entities: [
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'William J. Burns', role: 'subject' },
      { name: 'Thorbjørn Jagland', role: 'subject' },
      { name: 'Ehud Barak', role: 'subject' },
      { name: 'Kathryn Ruemmler', role: 'linked' },
      { name: 'Peter Thiel', role: 'linked' },
      { name: 'Boris Nikolic', role: 'linked' },
      { name: 'Bob Kerrey', role: 'linked' },
      { name: 'Woody Allen', role: 'linked' },
      { name: 'Leon Black', role: 'linked' },
      { name: 'Larry Summers', role: 'linked' },
      { name: 'Ghislaine Maxwell', role: 'linked' },
      { name: 'Lesley Groff', role: 'linked' },
    ],
    openQuestions: [
      {
        question:
          'Who told Acosta to "leave it alone"? The instruction came from someone with authority over a U.S. Attorney. Was it DOJ leadership, an intelligence agency liaison, or someone in the White House?',
        priority: 'critical',
      },
      {
        question:
          'What is on Epstein\'s surveillance tapes? FBI Director Wray\'s refusal to confirm or deny suggests the FBI possesses them. What would require a "neither confirm nor deny" response 5 years after Epstein\'s death?',
        priority: 'critical',
      },
      {
        question:
          'Who is the FBI FD-1023 source (EFTA01683612)? The CHS reported from Los Angeles, had been to Epstein\'s residence, and had specific knowledge of the Gates Foundation inner circle. This is someone in the tech/finance world with both Epstein access and FBI trust.',
        priority: 'critical',
      },
      {
        question:
          'Was the Austrian passport state-issued? Genuine foreign passports with false names typically require state cooperation. Did Austrian intelligence (BVT) issue the Fortelni passport, and if so, at whose request?',
        priority: 'critical',
      },
      {
        question:
          'What was discussed during Epstein\'s required "alone time" with Deputy Secretary of State Burns on September 13, 2014?',
        priority: 'high',
      },
      {
        question:
          'What was Epstein\'s role in Carbyne/Reporty beyond investor? Barak\'s emails suggest strategic involvement. Was Carbyne a technology platform with intelligence applications?',
        priority: 'high',
      },
      {
        question:
          'Why did Epstein visit Israeli military bases in April 2008 — during the window between his Florida guilty plea and sentencing?',
        priority: 'high',
      },
      {
        question:
          'What is the full Boris Nikolic / DARPA / AI thread? His pursuit of DARPA-funded AI investments triggered an FBI FD-1023 filing. Was he a technology collection vector?',
        priority: 'high',
      },
      {
        question:
          'What did Jagland mean by "it\'s unbelievable what you have done for me"? What favors did Epstein provide to the Secretary General of the Council of Europe beyond hotel rooms?',
        priority: 'medium',
      },
      {
        question:
          'Why has the DOJ OIG never investigated the intelligence angle? The OIG report concluded Epstein "wasn\'t serving as an intelligence asset" but appears to have been scope-limited.',
        priority: 'medium',
      },
    ],
  },
  {
    case_id: 'CF-2026-012',
    slug: 'trump-epstein-connection',
    title: 'The Trump-Epstein Connection',
    summary:
      'A document-by-document examination of the relationship between Donald Trump and Jeffrey Epstein, reconstructed entirely from civil litigation records, sworn depositions, and FBI investigative files. The record includes: 14 phone numbers in Epstein\'s personal directory; physical message pads showing calls to the Palm Beach mansion during the abuse period; a sworn deposition by Epstein\'s own brother placing Trump on the plane; Mar-a-Lago as the documented site where Virginia Giuffre was recruited at age 15; a 7-point affidavit by victims\' attorney Brad Edwards laying out grounds for a deposition; the Mar-a-Lago ban sourced to Epstein sexually assaulting an underage girl at the club; and an FBI FD-302 recording a victim who was introduced to Trump by Epstein and Maxwell. The deposition Edwards sought was never taken.',
    file: 'THREAD_17_FD302_Protect_Source_Trump_Hilton_Head.md',
    status: 'active',
    date_range_start: '1987-01-01',
    date_range_end: '2025-11-01',
    docs_reviewed: 15,
    completion_percentage: 70,
    methodology_notes:
      'Full-text extraction from civil litigation records, sworn depositions (Mark Epstein Sept 2009), Edwards Affidavit (April 2010), FBI FD-302 interviews (Aug-Oct 2019), FBI NTOC compilation (Aug 2025), and contemporaneous news archives produced in discovery.',
    entities: [
      { name: 'Donald Trump', role: 'subject' },
      { name: 'Jeffrey Epstein', role: 'subject' },
      { name: 'Ghislaine Maxwell', role: 'linked' },
      { name: 'Virginia Giuffre', role: 'victim-witness' },
      { name: 'Brad Edwards', role: 'attorney' },
    ],
    openQuestions: [
      {
        question:
          'Did Trump report the alleged assault of an underage girl at Mar-a-Lago to Palm Beach police when he banned Epstein?',
        priority: 'critical',
      },
      {
        question:
          'Were the 14 phone numbers in Epstein\'s directory ever formally analyzed by the SDNY trafficking investigation?',
        priority: 'critical',
      },
      {
        question:
          'What did the physical message pad entries say — were they calls only, or did they record conversation content?',
        priority: 'high',
      },
      {
        question:
          'Why was Trump\'s deposition successfully blocked? What legal arguments did Epstein\'s lawyers use?',
        priority: 'high',
      },
      {
        question:
          'Did the SDNY trafficking investigation formally assess the civil litigation record on the Trump-Epstein relationship?',
        priority: 'high',
      },
      {
        question:
          'What is the identity of "Jim Atkins" (phonetic) referenced in the FBI NTOC compilation as having introduced the 3501.045 victim to Epstein?',
        priority: 'high',
      },
      {
        question:
          'Why did AG Bondi order investigation of Epstein\'s ties to Trump\'s political opponents but not a symmetric investigation of Epstein\'s ties to Trump?',
        priority: 'medium',
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
    case_file_slug: 'npa-co-conspirators',
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
    case_file_slug: 'leon-black-prosecution-failure',
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
    case_file_slug: 'brunel-modeling-pipeline',
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
  // ─── Story 10: Three Million Pages of Nothing (DOJ scanning analysis) ──────
  {
    slug: 'three-million-pages-of-nothing',
    title: 'Three Million Pages of Nothing',
    deck: 'The DOJ released the Epstein files as required by law — every page printed, scanned at 96 DPI, and run through OCR. A systematic analysis across all 12 datasets confirms: the original metadata, text fidelity, and digital forensic value have been destroyed.',
    section: 'the-cover-up' as const,
    file: 'three-million-pages-of-nothing.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-14T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/c/c8/Department_of_Justice%2C_Washington%2C_D.C._2012.JPG',
    hero_image_caption:
      'The Robert F. Kennedy Department of Justice Building in Washington, D.C. — headquarters of the agency that printed, scanned, and OCR\'d 3.5 million pages of born-digital evidence before releasing them under the EFTA.',
    metadata: { source_analysis: 'scripts/scan-analysis-report.json' },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 5, is_primary: true },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00858973',
        description:
          'Email from Jeffrey Epstein (jeevacation@gmail.com) re: Scientific American editor — born-digital email scanned at 96 DPI, OCR reads @ as ®',
        page_reference: 'Full document',
      },
      {
        number: 2,
        bates_number: 'EFTA02006778',
        description:
          'Email from jeevacation@gmail.com — OCR garbles address to "mUeevacation©gmail.com," demonstrating systematic OCR degradation',
        page_reference: 'Full document',
      },
      {
        number: 3,
        bates_number: 'EFTA00005091',
        description:
          'Dataset 2 document — 100 pages, 42MB file size (42,601,905 bytes), demonstrating extreme file size bloat from scanning',
        page_reference: 'Full document (100 pages)',
      },
      {
        number: 4,
        bates_number: 'EFTA00000205',
        description:
          'Dataset 1 sample — 1-page hybrid scan, OCR text layer contains only the Bates stamp (1 word), 448KB for a single page',
        page_reference: 'Full document',
      },
      {
        number: 5,
        bates_number: 'EFTA01360906',
        description:
          'Deutsche Bank internal email (KYC case assignment) — born-digital email with Salesforce URL, scanned at 816×1056, OCR brackets misread',
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA02666792',
        description:
          'Dataset 12 sample — email from Brad Karp (Paul Weiss) to jeevacation@gmail.com, scanned at 816×1073 (different resolution batch than DS3-9)',
        page_reference: 'Full document',
      },
    ],
  },
  // ─── Story 11: The Washington List (D.C. journal cluster) ────────────────────
  {
    slug: 'the-washington-list',
    title: 'The Washington List',
    deck: 'Four men from one city, one company, one social circle — AOL\'s founding CEO, CEO, vice chairman, and SVP for policy — all named in the same victim\'s authenticated journals alongside the owner of the Washington NFL franchise. Deutsche Bank client records, Edge Foundation guest lists, and USVI property records independently place them in Epstein\'s orbit. None investigated. None charged.',
    section: 'the-network' as const,
    file: 'the-washington-list.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'master-intelligence-brief',
    published_at: '2026-03-14T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Capitol_Building_Full_View.jpg/1280px-Capitol_Building_Full_View.jpg',
    hero_image_caption:
      'The U.S. Capitol — the Washington, D.C. power network documented in Epstein\u2019s forensic journals connected AOL co-founders, an NFL team owner, and a vice chairman, all named in the same cluster.',
    metadata: { source_analysis: 'entity enrichment — D.C. journal cluster analysis' },
    entities: [
      { name: 'Jim Kimsey', mention_count: 6, is_primary: true },
      { name: 'Steve Case', mention_count: 6, is_primary: true },
      { name: 'Ted Leonsis', mention_count: 6, is_primary: true },
      { name: 'Dan Snyder', mention_count: 5, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 10, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: false },
      { name: 'George Vradenburg III', mention_count: 3, is_primary: false },
      { name: 'Alan Dershowitz', mention_count: 1, is_primary: false },
      { name: 'Larry Summers', mention_count: 1, is_primary: false },
      { name: 'Marvin Minsky', mention_count: 1, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02731420',
        description:
          'Victim handwritten scrapbook journal #1 (13 pages), marked "CONFIDENTIAL FOR ATTORNEY\'S EYES ONLY." Names 30+ men the victim was directed to have sexual encounters with.',
        page_reference: 'Full document (13 pages)',
      },
      {
        number: 2,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Epstein contact directory ("black book") with 1,571 names, multiple entries for D.C.-area figures including all four AOL executives',
        page_reference: 'Evidence inventory section',
      },
      {
        number: 3,
        bates_number: 'EFTA02731465',
        description:
          'Victim handwritten scrapbook journal #2 (8 pages), marked "CONFIDENTIAL FOR ATTORNEY\'S EYES ONLY." Contains George Vradenburg reference and AOL platform accusation.',
        page_reference: 'p. 5',
      },
      {
        number: 4,
        bates_number: 'EFTA02731420',
        description:
          'Victim journal #1 — "flights of horror" passage naming Leonsis, Case, Snyder, the Gregorys, and Colgan alongside Epstein. Language of property: "being borrowed" and "rented."',
        page_reference: 'p. 11',
      },
      {
        number: 5,
        bates_number: 'EFTA02731420',
        description:
          'Victim journal #1 — "Joe Gibbs is so nice but Dan Snyder is a pig! A red skin hoggett(sp?)!" alongside Joe Gibbs positive description.',
        page_reference: 'p. 4',
      },
      {
        number: 6,
        bates_number: 'EFTA00521006',
        description:
          'Blank aircraft passenger release form from Joe Gibbs Racing, Inc. found in Epstein\'s files — suggests shared private aviation access between Redskins social circle and Epstein operation.',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 7,
        bates_number: 'EFTA02731420',
        description:
          'Victim journal #1 — "Why would they all allow Mr. Leonsis wait this long? Why would he bring a friend and make a video?" Specific allegation of filmed sexual abuse with third-party participant.',
        page_reference: 'p. 5 (journal #2, EFTA02731465)',
      },
      {
        number: 8,
        bates_number: 'EFTA01413261',
        description:
          'Deutsche Bank Wealth Management client records — Dan Snyder listed as client. Internal documents discuss "strategic lending dialog" including boat loans and stadium financing, "$25mm managed investments."',
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA01472840',
        description:
          'Deutsche Bank planning document — projected $25mm managed investments for Snyder with "strategic lending" dialog.',
        page_reference: 'Full document',
      },
      {
        number: 10,
        bates_number: 'EFTA01416472',
        description:
          'Deutsche Bank client event list — Snyder and Epstein placed at the same invitation-only Deutsche Bank gatherings: "Dan Snyder and Karl Schreiber — dinner and preview" alongside "Jeffrey Epstein — preview."',
        page_reference: 'Full document',
      },
      {
        number: 11,
        bates_number: 'EFTA01478894',
        description:
          'Deutsche Bank client records — Steve Case listed as "Steve Case, Revolution LLC (former Chairman of AOL)" in Deutsche Bank Wealth Management division.',
        page_reference: 'Full document',
      },
      {
        number: 12,
        bates_number: 'EFTA02548313',
        description:
          'Edge Foundation billionaire science dinner guest lists — Steve Case attended multiple annual dinners alongside Jeffrey Epstein, Jeff Bezos, Sergey Brin, Bill Gates, and Elon Musk. Hosted by literary agent John Brockman.',
        page_reference: 'Full document',
      },
      {
        number: 13,
        bates_number: 'HOUSE_OVERSIGHT_016552',
        description:
          'House Oversight property records — Jim Kimsey (as Stephen P. Kimsey) owned $1.2 million Villa Fiorentina condominium in the US Virgin Islands, same territory as Epstein\'s Little St. James.',
        page_reference: 'Full document',
      },
      {
        number: 14,
        bates_number: 'EFTA01082667',
        description:
          'Trilateral Commission membership roster — Kimsey listed as "James Kimsey, Founding CEO of AOL." Elite networking body where Epstein cultivated relationships.',
        page_reference: 'p. 4',
      },
      {
        number: 15,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Harvard donations during Larry Summers\' presidency and MIT connections (Marvin Minsky) as institutional access points.',
        page_reference: 'Network analysis section',
      },
      {
        number: 16,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Jean-Luc Brunel\'s MC2 modeling agency as international recruitment pipeline.',
        page_reference: 'Co-conspirator analysis',
      },
      {
        number: 17,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — 2007 NPA blanket immunity provision covering unnamed "potential co-conspirators," negotiated by Epstein\'s defense team.',
        page_reference: 'Legal framework section',
      },
      {
        number: 18,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Dershowitz role as Epstein defense attorney who negotiated NPA, later named as having sexually abused victims.',
        page_reference: 'NPA analysis section',
      },
      {
        number: 19,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — no charges filed against journal-named individuals, no law enforcement interviews of D.C. cluster members.',
        page_reference: 'Charging recommendations',
      },
      {
        number: 20,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Section D (charging analysis) entirely redacted under Category C institutional protection. The section that would have addressed these names remains sealed.',
        page_reference: 'Section D',
      },
    ],
  },
  // ─── Story 12: The Last Night (MCC death) ──────────────────────────────────
  {
    slug: 'the-last-night',
    title: 'The Last Night',
    deck: 'Two officers slept while browsing furniture websites. Five mandatory counts were falsified. The cameras on Epstein\'s tier were already broken. His cellmate had been removed that morning. Then the charges were dropped.',
    section: 'the-cover-up' as const,
    file: 'the-last-night.md',
    byline: 'Derek Emsbach',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-14T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/4/46/MCC_New_York_jeh.JPG',
    hero_image_caption:
      'The Metropolitan Correctional Center at 150 Park Row in Lower Manhattan. The federal detention facility where Jeffrey Epstein died on August 10, 2019 was permanently closed in 2021.',
    metadata: { source_analysis: 'docs/investigation/DS12_EXPANSION_Analysis.md' },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 8, is_primary: true },
      { name: 'Darren Indyke', mention_count: 2, is_primary: false },
      { name: 'Richard Kahn', mention_count: 1, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02731790',
        description:
          'Prosecution slide deck, US v. Noel & Thomas — complete MCC timeline, false count slips, video evidence, DVR failure, cellmate removal, 75+ falsified round entries',
        page_reference: 'Full document',
      },
      {
        number: 2,
        bates_number: 'EFTA02731812',
        description:
          'Grand jury transcript, Session 1 — FBI agent testimony on video surveillance, bribery investigation (no evidence), financial records review, unprecedented 5 missed counts',
        page_reference: 'Full document',
      },
      {
        number: 3,
        bates_number: 'EFTA02731852',
        description:
          'Grand jury transcript, Session 2 — Epstein\'s last will signed Aug 8, 2019 naming Indyke and Kahn as executors of $577M+ estate; 6-count indictment voted',
        page_reference: 'Full document',
      },
      {
        number: 4,
        bates_number: 'EFTA02732243',
        description:
          'Consolidated discovery conference transcript — estate possessed 700K+ documents, produced only 3 (one clawed back); 4 parallel civil cases',
        page_reference: 'Full transcript',
      },
      {
        number: 5,
        bates_number: 'EFTA02732143',
        description:
          'Boies Schiller opposition brief — "estate has taken the position of attempting to prove Epstein\'s innocence"; documents discovery obstruction',
        page_reference: 'Full document',
      },
    ],
  },
  // ─── Story 13: The Governor's Ranch (Bill Richardson) ─────────────────────────
  {
    slug: 'the-governors-ranch',
    title: "The Governor's Ranch",
    deck: "A pilot testified under oath that he saw Bill Richardson at Epstein's Zorro Ranch. Campaign records show $100K+ flowing through a shell entity named after the ranch. The governor's own staff coordinated visits through Epstein's scheduler. Richardson died in 2023 — never investigated.",
    section: 'the-network' as const,
    file: 'the-governors-ranch.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'master-intelligence-brief',
    published_at: '2026-03-14T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Desert_Landscape_-_New_Mexico_%285989098056%29.jpg/1280px-Desert_Landscape_-_New_Mexico_%285989098056%29.jpg',
    hero_image_caption:
      "The New Mexico desert — where Jeffrey Epstein's 10,000-acre Zorro Ranch hosted political figures including Governor Bill Richardson, documented by sworn pilot testimony and campaign finance records.",
    metadata: { source_analysis: 'docs/investigation/DS12_EXPANSION_Analysis.md' },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 12, is_primary: true },
      { name: 'Bill Richardson', mention_count: 10, is_primary: true },
      { name: 'Lesley Groff', mention_count: 3, is_primary: true },
      { name: 'Bill Clinton', mention_count: 2, is_primary: false },
      { name: 'Ghislaine Maxwell', mention_count: 1, is_primary: false },
      { name: 'Les Wexner', mention_count: 1, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01247021',
        description:
          "Larry Morrison sworn deposition — pilot testifies seeing Richardson at Ranch Central being escorted to main house for dinner with Epstein, 'well before' February 2007",
        page_reference: 'Deposition pp. 167-169',
      },
      {
        number: 2,
        bates_number: 'EFTA02731941',
        description:
          'Public record — Bill Richardson dies August 28, 2023, at age 75 in Massachusetts; never investigated for Epstein connection',
        page_reference: 'Public record',
      },
      {
        number: 3,
        bates_number: 'EFTA02731941',
        description:
          'Public record — Richardson political career: Governor 2003-2011, UN Ambassador, Energy Secretary, 2008 presidential candidate, Commerce Secretary nominee (withdrawn Jan 2009)',
        page_reference: 'Public record',
      },
      {
        number: 4,
        bates_number: 'EFTA01296884',
        description:
          "Campaign finance records — Epstein donated $100K+ to Richardson campaigns via Zorro Trust, a shell entity named after the ranch",
        page_reference: 'Full document',
      },
      {
        number: 5,
        bates_number: 'EFTA01713378',
        description:
          'Additional campaign contribution records — Zorro Trust donations to Richardson, corporate vehicle obscuring personal connection',
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA02731941',
        description:
          'Juliette civil complaint — estate executors Darren Indyke and Richard Kahn named as defendants in four simultaneous civil cases; same attorneys who managed Zorro Trust',
        page_reference: 'Complaint header',
      },
      {
        number: 7,
        bates_number: 'EFTA02033176',
        description:
          "Lesley Groff scheduling emails — ongoing coordination with Richardson's governor's office for Zorro Ranch visits",
        page_reference: 'Full document',
      },
      {
        number: 8,
        bates_number: 'EFTA02407935',
        description:
          "August 2010 email from Janis Hartley (Richardson Deputy CoS) coordinating ranch visits — after Epstein's 2008 conviction and sex offender registration",
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA02731941',
        description:
          'Juliette complaint ¶50 — describes meeting "another important government official" at Zorro Ranch in 2004; "another" distinguishes from Cape Town official (Clinton)',
        page_reference: 'Complaint ¶50',
      },
      {
        number: 10,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — 2007 NPA blanket immunity provision covering unnamed "potential co-conspirators"',
        page_reference: 'Legal framework section',
      },
    ],
  },
  // ─── Story 14: Normal for This Client (Deutsche Bank) ────────────────────────
  {
    slug: 'normal-for-this-client',
    title: 'Normal for This Client',
    deck: 'Deutsche Bank opened 76 accounts for a convicted sex offender, processed millions in payments to "ostensible foreign models" and co-conspirators, watched his attorney structure cash withdrawals — and when compliance flagged a wire to a Russian woman, the analyst wrote: "Once this type of activity is normal for this client it is not deemed suspicious."',
    section: 'follow-the-money' as const,
    file: 'normal-for-this-client.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 11,
    is_featured: false,
    case_file_slug: 'deutsche-bank-compliance-failure',
    published_at: '2026-03-14T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Deutsche-Bank-Frankfurt-am-Main.jpg/1280px-Deutsche-Bank-Frankfurt-am-Main.jpg',
    hero_image_caption:
      "Deutsche Bank's Frankfurt headquarters — the institution managed the Epstein relationship from 2013 to 2018, generating an estimated $8-20 million in revenue before a $150 million regulatory penalty.",
    metadata: {
      source_analysis:
        'docs/investigation/sources/DEUTSCHE_BANK/Analysis.md',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 18, is_primary: true },
      { name: 'Darren Indyke', mention_count: 8, is_primary: true },
      { name: 'Lesley Groff', mention_count: 3, is_primary: false },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: false },
      { name: 'Richard D. Kahn', mention_count: 3, is_primary: false },
      { name: 'Alan Dershowitz', mention_count: 1, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00151495',
        description:
          'NYDFS Consent Order — monitoring team member: "Once this type of activity is normal for this client it is not deemed suspicious"',
        page_reference: 'p. 12',
      },
      {
        number: 2,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank Presentation to SDNY — 76 accounts, 30+ shell entities, "ostensible foreign models" payments, full financial infrastructure mapped across 19 exhibits',
        page_reference: 'Exhibits A-S (52 pages)',
      },
      {
        number: 3,
        bates_number: 'EFTA01656556',
        description:
          'FinCEN SAR — Indyke tells teller he wants to "avoid all the paperwork and going over his cash limit"',
        page_reference: 'Full document',
      },
      {
        number: 4,
        bates_number: 'EFTA00151495',
        description:
          'NYDFS Consent Order — onboarding memo: "charged with soliciting an underage prostitution in 2007," 13 months served, 17 civil settlements',
        page_reference: 'pp. 4-5',
      },
      {
        number: 5,
        bates_number: 'EFTA00151495',
        description:
          'NYDFS Consent Order — Paul Morris projection: "estimated flows of $100-300 [million]... w/ revenue of $2-4 million annually"',
        page_reference: 'p. 3',
      },
      {
        number: 6,
        bates_number: 'EFTA00151495',
        description:
          'NYDFS Consent Order — EXECUTIVE-1 approval email: "Neither suggest [it] requires rep risk and we can move ahead"',
        page_reference: 'p. 4',
      },
      {
        number: 7,
        bates_number: 'EFTA00151495',
        description:
          'NYDFS Consent Order — cascading compliance failures: conditions never communicated, monitoring reduced to internet age-checks, reference letters during offboarding',
        page_reference: 'pp. 6-18',
      },
      {
        number: 8,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank Presentation — Exhibit M: $6.37M+ co-conspirator legal expenses ($5.5M Link & Rockenbach for Groff, $87K+ Haddon Morgan for Maxwell)',
        page_reference: 'Exhibit M',
      },
      {
        number: 9,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank Presentation — Exhibit R: tuition payments to 20+ schools ($98K The New School, $34K Institut Villa Pierrefeu, $42K+ Glion Institute)',
        page_reference: 'Exhibit R',
      },
      {
        number: 10,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank Presentation — Exhibit P: high-profile payments ($2.08M Joichi Ito, $269K Chomsky, $200K de Jongh, $100K Dershowitz, $250K Larsen)',
        page_reference: 'Exhibit P',
      },
      {
        number: 11,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank Presentation — Exhibit J: $800K+ cash withdrawals, monthly $7,500 pattern, $108K single visit',
        page_reference: 'Exhibit J',
      },
      {
        number: 12,
        bates_number: 'EFTA01418996',
        description:
          'Dmitri Saks EDD on Southern Financial LLC — "40 underage girls had come forward," 17 settlements, recommends High Risk + ARRC escalation',
        page_reference: 'Full document',
      },
      {
        number: 13,
        bates_number: 'EFTA00151495',
        description:
          'NYDFS Consent Order — EXECUTIVE-1 and Morris home visit: "asked about the veracity of recent allegations and appeared to be satisfied"',
        page_reference: 'p. 7',
      },
      {
        number: 14,
        bates_number: 'EFTA01356506',
        description:
          'Elizabeth Ford (Head of Compliance Americas) email — three conditions for continuing the Epstein relationship',
        page_reference: 'Full document',
      },
      {
        number: 15,
        bates_number: 'EFTA01422803',
        description:
          'Internal DB emails Oct 2018 — offboarding decision after Miami Herald series, Oldfield reference letters: "unaware of any problems"',
        page_reference: 'Full document',
      },
      {
        number: 16,
        bates_number: 'EFTA00161594',
        description:
          'NYDFS press release — "$150 million penalty... first enforcement action by a regulator against a financial institution for dealings with Jeffrey Epstein"',
        page_reference: 'Full document',
      },
    ],
  },
  // ─── Story 15: The Four Names (NPA Co-Conspirators) ─────────────────────────
  {
    slug: 'the-four-names',
    title: 'The Four Names',
    deck: 'By May 2007, federal prosecutors had an 82-page prosecution memo and a 53-page sealed indictment ready for the grand jury. Four months later, the government signed a Non-Prosecution Agreement granting blanket immunity to every co-conspirator — naming four women explicitly: Sarah Kellen, Adriana Ross, Lesley Groff, and Nadia Marcinkova. None was required to cooperate. None was ever charged.',
    section: 'the-cover-up' as const,
    file: 'the-four-names.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 12,
    is_featured: false,
    case_file_slug: 'npa-co-conspirators',
    published_at: '2026-03-14T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Palm_Beach_County_Courthouse_%28East_face%29.jpg/1280px-Palm_Beach_County_Courthouse_%28East_face%29.jpg',
    hero_image_caption:
      'The Palm Beach County Courthouse — where Epstein entered his state guilty plea on June 30, 2008, activating the NPA that immunized his co-conspirators from federal prosecution.',
    metadata: {
      source_analysis:
        'docs/investigation/sources/NPA_CO_CONSPIRATORS/Analysis.md',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 20, is_primary: true },
      { name: 'Lesley Groff', mention_count: 5, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: true },
      { name: 'Sarah Kellen', mention_count: 18, is_primary: true },
      { name: 'Nadia Marcinkova', mention_count: 14, is_primary: true },
      { name: 'Adriana Ross', mention_count: 8, is_primary: true },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01186070',
        description:
          'CVRA Motion for Summary Judgment — 82-page prosecution memo and 53-page indictment referenced; Villafaña: "sitting on the shelf since May"',
        page_reference: 'pp. 3, 11 (¶¶12, 25)',
      },
      {
        number: 2,
        bates_number: 'EFTA01186070',
        description:
          'CVRA Motion — NPA immunity provision ¶40: "including but not limited to Sarah Kellen, Adrian Ross, Lesley Groff, or Nadia Marcinkova"; confidentiality provision; Lefkowitz: "keep this from becoming public"',
        page_reference: 'pp. 14-21 (¶¶28, 37, 40-41)',
      },
      {
        number: 3,
        bates_number: 'EFTA01653420',
        description:
          'FBI Organizational Chart — Kellen: "at least 10 girls state she is the direct point of contact for scheduling"; role descriptions for all four co-conspirators',
        page_reference: 'Full document',
      },
      {
        number: 4,
        bates_number: 'EFTA01659794',
        description:
          'Sealed Federal Indictment — Kellen named as defendant; Overt Act (2): led Jane Doe #2 (age 14) upstairs to Epstein\'s bedroom; took nude photographs',
        page_reference: 'pp. 1-10',
      },
      {
        number: 5,
        bates_number: 'EFTA01245817',
        description:
          'FBI 302 — victim interview: Kellen set up massage table, arranged lotions, scheduled via phone, called victims "ahead of time to advise of dates"',
        page_reference: 'pp. 4-7',
      },
      {
        number: 6,
        bates_number: 'EFTA01688916',
        description:
          'Daily Beast articles — Kellen 364 flight legs; Marcinkova FAA pilot; Maxwell trial context; post-Epstein identities',
        page_reference: 'pp. 18-28',
      },
      {
        number: 7,
        bates_number: 'EFTA00081180',
        description:
          'Edwards v. Epstein Undisputed Facts — "Nadia Marcinkova (Epstein\'s live-in sex slave)"; E.W. forced to perform sex acts on Marcinkova; A.H. same',
        page_reference: 'pp. 7-9 (¶¶11, 13, 27)',
      },
      {
        number: 8,
        bates_number: 'EFTA00585893',
        description:
          'Epstein gift declaration — Harley Davidson motorcycle to Peter Marcinkova, Malinovia 14, Presov, Slovakia 08001; valued at $9,905',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 9,
        bates_number: 'EFTA00081180',
        description:
          'Edwards v. Epstein — Epstein redirected airplane from Teterboro to USVI to prevent FBI serving Marcinkova target letter; "verbally harassed Ms. Marcinkova"',
        page_reference: 'pp. 9-10 (¶20)',
      },
      {
        number: 10,
        bates_number: 'EFTA01699906',
        description:
          'FBI Briefing Document — Ross "admits during a proffer she was trained by [Kellen]"; "instructed to remove items from Palm Beach and Virgin Island homes and have them destroyed"',
        page_reference: 'p. 3',
      },
      {
        number: 11,
        bates_number: 'EFTA01186070',
        description:
          'CVRA Motion — Lefkowitz to Villafaña on day NPA signed: "Please do whatever you can to keep this from becoming public"',
        page_reference: 'p. 17 (¶37)',
      },
      {
        number: 12,
        bates_number: 'EFTA00081180',
        description:
          'Edwards v. Epstein — FBI letters to victims Jan & May 2008: "currently under investigation... request your continued patience"; plea hearing July 11, 2008',
        page_reference: 'pp. 12-16 (¶¶29-38)',
      },
      {
        number: 13,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Maxwell conviction December 2021; sex trafficking, conspiracy, transporting minor; 20-year sentence',
        page_reference: 'Legal framework section',
      },
    ],
  },
  {
    slug: 'the-conveyor-belt',
    title: 'The Conveyor Belt',
    deck: 'In 1988, CBS 60 Minutes exposed Jean-Luc Brunel as a serial predator in the modeling industry. Sixteen years later, Jeffrey Epstein wired him $1 million to start MC2 Model Management — a modeling agency his own business partner confirmed to the FBI was a "transport agency of underage girls." Brunel operated for thirty-two years after the first public exposure. He was finally arrested — by French police, not American ones — in December 2020. He was found dead in his prison cell two months later.',
    section: 'the-operation' as const,
    file: 'the-conveyor-belt.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 11,
    is_featured: false,
    case_file_slug: 'brunel-modeling-pipeline',
    published_at: '2026-03-14T12:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Lower_Manhattan%2C_New_York_skyline_from_Liberty_Island_2021.jpg/1280px-Lower_Manhattan%2C_New_York_skyline_from_Liberty_Island_2021.jpg',
    hero_image_caption:
      'Lower Manhattan — MC2 Model Management operated at 6 West 14th Street, where Brunel ran the modeling agency Epstein capitalized with a $1 million wire transfer.',
    metadata: {
      source_analysis: 'docs/investigation/sources/BRUNEL/Analysis.md',
    },
    entities: [
      { name: 'Jean-Luc Brunel', mention_count: 28, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 22, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 3, is_primary: false },
      { name: 'Lesley Groff', mention_count: 2, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01480954',
        description:
          'Jezebel/JPMorgan due diligence report — 60 Minutes investigation: "nearly two dozen models" assaulted; Bonnouvrier: "drugs and silent rape"; Casablancas: "should be behind bars"; $1M founding of MC2',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 2,
        bates_number: 'EFTA01733832',
        description:
          'Epstein libel claims document — confirms $1M wire to Brunel offshore account; racketeering complaint about MC2; MC2 at 6 W 14th St, Brunel 85%, Fuller 15%',
        page_reference: 'pp. 1-5',
      },
      {
        number: 3,
        bates_number: 'EFTA02810334',
        description:
          'JPMorgan lawsuit expert report — JPMorgan DDR: "unknown if money was secret investment or payment for services as a procurer"; "racketeering that involved luring in minor children for sexual play for money"',
        page_reference: 'pp. 60-62',
      },
      {
        number: 4,
        bates_number: 'EFTA01590181',
        description:
          'JPMorgan funds transfer request — $25,000 wire from "Jeffrey E Epstein" to "MC2 Model Management" at TD Bank, dated November 16, 2012',
        page_reference: 'Full document (3 pages)',
      },
      {
        number: 5,
        bates_number: 'EFTA01657299',
        description:
          'FBI internal email chain — Cordero confirms MC2 trafficking (11 points): "transport agency of underage girls"; "principal supplier"; "principal business is to transport underage girls for sexual pleasure"',
        page_reference: 'Full document (6 pages)',
      },
      {
        number: 6,
        bates_number: 'EFTA00173806',
        description:
          'FBI victim interview — pipeline: nightclub recruitment → Epstein massage → Brunel modeling interview → island transport; Epstein "became rough and forceful"; career threats',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 7,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — victim visa sponsored by Brunel agency while not working; Epstein "paid Brunel $1 million to keep her in the country"; Brunel brought ~15-year-old to Virgin Islands',
        page_reference: 'pp. 47-48',
      },
      {
        number: 8,
        bates_number: 'EFTA00079597',
        description:
          'French MLAT request — Paris investigation charges; 3+ victim testimonies (drugging, rape through Karin Models); Avenue Foch search: photos, videos, 4500 Brunel emails, CD-ROM with 62 names',
        page_reference: 'Full document (7 pages)',
      },
      {
        number: 9,
        bates_number: 'EFTA01746651',
        description:
          'Email chain (Fuller → Kahn → Epstein) — "Jean Luc no longer wants to sponsor [her] in light of recent circumstances" (March 2015)',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 10,
        bates_number: 'EFTA01731290',
        description:
          'Grand Jury Presentation outline — Operation Leap Year: 19 Jane Does, 22+ counts; evidence organized by flights, calls, meetings',
        page_reference: 'Full document (17 pages)',
      },
      {
        number: 11,
        bates_number: 'EFTA01653331',
        description:
          'SDNY arrest briefing (July 3, 2019) — Brunel named as 1 of 4 immediate approach targets; "recruited minors for sexual activity with Epstein, and himself participated"',
        page_reference: 'Full document (5 pages)',
      },
      {
        number: 12,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Brunel attorney: "not willing to meet with us for a proffer and would invoke his Fifth Amendment privilege" (Aug-Sept 2019)',
        page_reference: 'pp. 63-65',
      },
      {
        number: 13,
        bates_number: 'EFTA00079596',
        description:
          'DOJ MLAT referral — Brunel arrested in Paris, French request forwarded to SDNY; DOJ attaché in Paris mentions during Maxwell bail discussions',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 14,
        bates_number: 'EFTA00174043',
        description:
          'FBI/AFP intelligence — Brunel found dead in Prison de la Santé, Feb 19, 2022; lawyers: "not guided by guilt but a profound sense of injustice"; Giuffre: "ends another chapter"',
        page_reference: 'pp. 1-3',
      },
    ],
  },
  {
    slug: 'the-architecture-of-opacity',
    title: 'The Architecture of Opacity',
    deck: 'Two days before his death, Jeffrey Epstein signed a trust agreement transferring $577 million in assets to "The 1953 Trust" — managed by the same two men who controlled his 30+ shell companies. Buried in its provisions: a loyalty clause that threatened employees with losing million-dollar bequests if they were deemed "disloyal." It took the Southern District of New York eleven months to demand the estate promise not to use it against witnesses.',
    section: 'follow-the-money' as const,
    file: 'the-architecture-of-opacity.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 14,
    is_featured: false,
    case_file_slug: 'shell-company-infrastructure',
    published_at: '2026-03-14T18:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Drake%27s_Seat%3B_Saint_Thomas%2C_United_States_Virgin_Islands.jpg/1280px-Drake%27s_Seat%3B_Saint_Thomas%2C_United_States_Virgin_Islands.jpg',
    hero_image_caption:
      'St. Thomas, U.S. Virgin Islands — where all 30+ Epstein shell companies were registered at the same address: 6100 Red Hook Quarter B3. The USVI registration concealed beneficial ownership across $577 million in assets.',
    metadata: {
      source_analysis: 'docs/investigation/sources/SHELL_COMPANIES/Analysis.md',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 30, is_primary: true },
      { name: 'Darren Indyke', mention_count: 18, is_primary: true },
      { name: 'Lesley Groff', mention_count: 6, is_primary: false },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00027979',
        description:
          'Probate petition — full estate inventory: $577,672,654 total. Will dated August 8, 2019 (2 days before death). Executors: Indyke and Kahn. Successor executor: Boris Nikolic. Everything to The 1953 Trust.',
        page_reference: 'Full document (21 pages)',
      },
      {
        number: 2,
        bates_number: 'EFTA01266204',
        description:
          'The 1953 Trust agreement — complete trust document. Sections 2.3 (bequests: $50M Indyke, $25M Kahn, $10M Maxwell), 2.5(A) (2-year lockout), 2.5(B) (loyalty clause: "disloyalty" as termination cause). All property to Karyna Shuliak.',
        page_reference: 'Full document (16+ pages)',
      },
      {
        number: 3,
        bates_number: 'EFTA01424505',
        description:
          'CDD forms email from Bebe Avdiu (Indyke legal assistant) listing all 15 entities in the Southern Financial relationship at Deutsche Bank',
        page_reference: 'Full document (4 pages)',
      },
      {
        number: 4,
        bates_number: 'EFTA01424842',
        description:
          'Complete authorized signers for ALL Southern Financial entities — Butterfly Trust, JEGE, Plan D, Southern Financial, HBRK, Hyperion Air, Jeepers, Haze Trust, Zorro, etc. Same 5 people across 20+ entities.',
        page_reference: 'Full document (13 pages)',
      },
      {
        number: 5,
        bates_number: 'EFTA01421742',
        description:
          'Deutsche Bank entity spreadsheet with purposes — Southern Financial: "formed to hold personal wealth and invest"; Zorro: "real estate holding company"; Hyperion Air: "holds funds for airplane costs"; Plan D: "formed by one individual for one individual"',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 6,
        bates_number: 'EFTA00082467',
        description:
          'First quarterly accounting with Schedule B — all entity values: Southern Trust $236M, Southern Financial $176M, Nautilus $63M, Maple $56M, Poplar $22M, Plan D $17M, Cypress $17M, Laurel $12M, SCIJEP $9M, Hyperion $4.5M',
        page_reference: 'Full document (11 pages)',
      },
      {
        number: 7,
        bates_number: 'EFTA01588813',
        description:
          '$1.5M wire transfer FROM Jeepers Inc TO Jeffrey Epstein at JPMorgan Chase (July 15, 2013); also $125K from Southern Trust to Adfin Solutions',
        page_reference: 'Full document (3 pages)',
      },
      {
        number: 8,
        bates_number: 'EFTA01583466',
        description:
          'Plan D LLC operating agreement — formed October 19, 2012; sole member Jeffrey E. Epstein; purpose: "any lawful activity"',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 9,
        bates_number: 'EFTA01424585',
        description:
          'Deutsche Bank ACU reviews — Jeepers: "sub S managing various investments"; Mort: "entity holding shares of private company Jawbone"; Haze Trust: "investment vehicle"',
        page_reference: 'Full document (6 pages)',
      },
      {
        number: 10,
        bates_number: 'EFTA01420392',
        description:
          'Butterfly Trust compliance — Deutsche Bank asks Richard Kahn: "What is the purpose of this trust, as it is not cleared within the original trust agreement?" Kahn defers to Stewart Oldfield.',
        page_reference: 'Full document (4 pages)',
      },
      {
        number: 11,
        bates_number: 'EFTA01423947',
        description:
          'Caterpillar Trust transfer memo — Lesley Groff directing interest transfers, March 2019. Trust wound down April 2019, three months before arrest.',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 12,
        bates_number: 'EFTA00031989',
        description:
          'SDNY letter re: Section 2.5(B) — estate counsel Marc Weinstein (Hughes Hubbard & Reed) confirms: trust provision "has not been and will not be used" to retaliate against witnesses cooperating with law enforcement. July 27, 2020.',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 13,
        bates_number: 'EFTA01422395',
        description:
          'Deutsche Bank KYC review — Gratitude America Ltd and Mort Inc under "high-risked" Southern Financial relationship. Epstein as president, Kahn and Indyke as directors.',
        page_reference: 'Full document (6 pages)',
      },
      {
        number: 14,
        bates_number: 'EFTA01928357',
        description:
          'Boris Nikolic email to Epstein (2014) — personal correspondence. Also EFTA02032070: Nikolic + Kimbal Musk + Epstein Halloween costume discussion (2012)',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 15,
        bates_number: 'EFTA00019322',
        description:
          'Internal DOJ email: "As for where his assets actually go, it all goes to the acting Trustees of the 1953 Trust — i.e., nobody is named herein."',
        page_reference: 'Full document (1 page)',
      },
    ],
  },
  {
    slug: 'the-worst-dancer-in-the-world',
    title: 'The Worst Dancer in the World',
    deck: 'An FBI 302 documents three sexual encounters between Prince Andrew and a seventeen-year-old victim across three countries. Four redaction variants of the same interview survive in the EFTA corpus. The SDNY requested an interview. The FBI sent an MLAT request. No law enforcement agency in any country has questioned him under oath. The documentary record is complete. The accountability is zero.',
    section: 'the-operation' as const,
    file: 'the-worst-dancer-in-the-world.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: true,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-15T12:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Buckingham_Palace_%282947066459%29.jpg/1280px-Buckingham_Palace_%282947066459%29.jpg',
    hero_image_caption:
      'Buckingham Palace — seat of the British monarchy, whose institutional machinery was used to maintain contact with a convicted sex offender through official royal staff and formal correspondence.',
    metadata: {
      source_analysis: 'docs/investigation/sources/PRINCE_ANDREW',
    },
    entities: [
      { name: 'Prince Andrew', mention_count: 25, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 12, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 8, is_primary: true },
      { name: 'Virginia Giuffre', mention_count: 8, is_primary: true },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00208128',
        description:
          'FBI FD-302 — interview of Virginia Giuffre at U.S. Consulate Sydney, March 17, 2011. Least-redacted variant (Rev. 10-6-95 form). Describes London encounter, Club Tramp, "worst dancer in the world," foot fetish, CBP travel records corroboration.',
        page_reference: 'Full document (12 pages)',
      },
      {
        number: 2,
        bates_number: 'EFTA01688359',
        description:
          'FBI FD-302 — same Giuffre interview, heavily redacted variant (Rev. 05-08-10 form). Describes New York encounter at Epstein Manhattan residence, puppet incident with Prince Andrew.',
        page_reference: 'Full document (12 pages)',
      },
      {
        number: 3,
        bates_number: 'EFTA01699638',
        description:
          'FBI FD-302 — same Giuffre interview, intermediate redaction variant. Describes third encounter on Little St. James: "was using Xanax heavily at the time," non-English-speaking models on island.',
        page_reference: 'Full document (12 pages)',
      },
      {
        number: 4,
        bates_number: 'EFTA00147383',
        description:
          'Internal FBI email, August 16, 2019 (6 days after Epstein death): "At this point we don\'t have plans to interview Prince Andrew." Prompted by media inquiry from James Beal, U.S. Editor of The Sun.',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 5,
        bates_number: 'EFTA00017042',
        description:
          'Geoffrey Berman SDNY press conference, January 27, 2020: "Prince Andrew has provided zero cooperation." Federal prosecutor publicly calling out member of British Royal Family.',
        page_reference: 'pp. 1-3',
      },
      {
        number: 6,
        bates_number: 'EFTA00019885',
        description:
          'Blackfords LLP letter, February 14, 2020 — Prince Andrew\'s lawyers accuse SDNY of violating confidentiality: "We cannot advise the Duke to speak to prosecutors who cannot be trusted to deal with him fairly."',
        page_reference: 'Full document (3 pages)',
      },
      {
        number: 7,
        bates_number: 'EFTA00149613',
        description:
          'Internal FBI email, June 2020 — MLAT request status: SDNY submitted formal Mutual Legal Assistance Treaty request to UK. "Nothing new here." UK Home Office later refused to proceed.',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 8,
        bates_number: 'EFTA01990003',
        description:
          'Prince Andrew Christmas email to Epstein, December 24-25, 2010. Forwarded to jeevacation@gmail.com and eeyacation@gmail.com. Signed "HRH The Duke of York KG."',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 9,
        bates_number: 'EFTA00764698',
        description:
          'Amanda Thirsk (Deputy Private Secretary to HRH The Duke of York) invitation to Epstein for Prince Andrew\'s 50th birthday at St. James\'s Palace, February 26, 2010. Issued through Duke of York\'s Office.',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 10,
        bates_number: 'EFTA02415487',
        description:
          'Epstein office phone message, October 26, 2010: "Duke of York returned your call. He is on the way to a state banquet dinner... he said he will ring you back on your cell in 3 hours time."',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 11,
        bates_number: 'EFTA02816521',
        description:
          'DOJ release index — docket entries for Giuffre v. Prince Andrew, case 21-cv-06702 (SDNY, filed August 2021). Civil lawsuit settled February 2022 for reported $12 million.',
        page_reference: 'pp. 197-199',
      },
    ],
  },
  {
    slug: 'shes-here',
    title: "She's Here",
    deck: "An FBI 302 documents a Brazilian victim sent by Jeffrey Epstein to former Senate Majority Leader George Mitchell at two luxury hotels — the Beverly Hills Hotel and the Four Seasons in Washington, D.C. Mitchell was on the phone with Epstein when she arrived. Fifteen scheduling documents show the relationship continued for years after Epstein's conviction. Mitchell was formally listed as a witness with \"knowledge of sexual trafficking conduct.\" No law enforcement agency has interviewed him.",
    section: 'the-network' as const,
    file: 'shes-here.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 12,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-15T16:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/2023_United_States_Capitol_118th_Congress%2C_sunrise.jpg/1280px-2023_United_States_Capitol_118th_Congress%2C_sunrise.jpg',
    hero_image_caption:
      'The United States Capitol — where George Mitchell served as Senate Majority Leader from 1989 to 1995. After leaving office, he maintained a relationship with Jeffrey Epstein that continued years after Epstein\'s conviction.',
    metadata: {
      source_analysis: 'FBI FD-302 EFTA02857849, scheduling corpus, Apollo deposition EFTA01165407',
    },
    entities: [
      { name: 'George Mitchell', mention_count: 30, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 15, is_primary: true },
      { name: 'Lesley Groff', mention_count: 8, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 5, is_primary: false },
      { name: 'Leon Black', mention_count: 4, is_primary: false },
      { name: 'Virginia Giuffre', mention_count: 2, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02857849',
        description:
          'FBI FD-302 — victim interview August 21, 2020 (DS12, less-redacted version). Brazilian victim describes being sent by Epstein to George Mitchell at Beverly Hills Hotel (LA) and Four Seasons (DC). Mitchell on phone with Epstein: "She\'s here." Multiple sexual encounters at both locations.',
        page_reference: 'Full document (8 pages)',
      },
      {
        number: 2,
        bates_number: 'EFTA01248273',
        description:
          'FBI FD-302 — same victim interview (DS9, more heavily redacted version). Substantively identical account with additional redactions of names and identifying details.',
        page_reference: 'Full document (8 pages)',
      },
      {
        number: 3,
        bates_number: 'EFTA01155017',
        description:
          'Handwritten contact list from Epstein records. "1.george Mitchell" is the first entry. List continues with Leon, Boris (Nikolic), Bill Richardson, Jes (Staley), Summers, Weinstein, Milken, Pritzker.',
        page_reference: 'Full document (3 pages)',
      },
      {
        number: 4,
        bates_number: 'EFTA01983409',
        description:
          'Email March 19, 2012 — two seminar invite lists. "Seminar-POWER": Bill Clinton, Bill Gates, George Mitchell, Michael Ovitz. "Seminar-MONEY": Bezos, Brin, Andreessen, Schmidt, Thiel, Simons.',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 5,
        bates_number: 'EFTA02408153',
        description:
          'Email August 2, 2010 to jeevacation@gmail.com: "George Mitchell returned your phone call."',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 6,
        bates_number: 'EFTA02407784',
        description:
          'Email August 13, 2010 — Lesley Groff to Epstein: called Mitchell\'s office about Yom Kippur dinner, "it would mean a lot to you if the Senator could join you." Includes Mitchell cell number.',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 7,
        bates_number: 'EFTA02419244',
        description:
          'Email September 10, 2010 — Groff to Epstein: "I know you still have Senator Mitchell and Larry Summers on your radar... emailed Senator Mitchell\'s assistants several times."',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 8,
        bates_number: 'EFTA02421885',
        description:
          'Email October 25, 2010 — Groff to Mitchell\'s three staffers (Julia Reed, Janice Neal, Maher Bitar): "Jeffrey Epstein would like to speak with Senator Mitchell."',
        page_reference: 'Full document (2 pages)',
      },
      {
        number: 9,
        bates_number: 'EFTA00560723',
        description:
          'Email January 28, 2011 — Epstein instructs Groff to "schedule George Mitchell to come see him and Peter Mandelson while Peter is in NY."',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 10,
        bates_number: 'EFTA02415821',
        description:
          'Email November 30, 2010 — Groff arranging for Mitchell to "stop by and sit down for a chat with you and Andrew" (Prince Andrew reference).',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 11,
        bates_number: 'EFTA02148518',
        description:
          'Calendar February 12, 2013: "check in with Senator George Mitchell to see if he is around for a possible lunch on March 1 with JE and Bill Gates."',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 12,
        bates_number: 'EFTA01948080',
        description:
          'Schedule November 6, 2013: 10:30am "Appt w/Senator George Mitchell" followed by 2-5pm meeting at "LEON\'S OFFICE" (Leon Black, 9 West 57th Street, 48th Floor).',
        page_reference: 'Full document (1 page)',
      },
      {
        number: 13,
        bates_number: 'EFTA01165407',
        description:
          'Deposition transcript (95 pages): "Epstein and WR back channel to George Mitchell to preempt a blowup." WR = Senator Warren Rudman. Mitchell used as diplomatic intermediary between Epstein and Apollo Global Management.',
        page_reference: 'pp. 73-74',
      },
      {
        number: 14,
        bates_number: 'EFTA01249058',
        description:
          'AUSA "Highly Confidential" memo, March 9, 2011 — lists Mitchell among "important people" named by victim. Notes encounters were videotaped, consistent with blackmail theory.',
        page_reference: 'Full document (3 pages)',
      },
      {
        number: 15,
        bates_number: 'EFTA00157613',
        description:
          'Juan Alessi witness preparation memo, June 8, 2021 — Epstein\'s Palm Beach house manager lists famous visitors including "Senator George Mitchell, John Kennedy Jr., Alan Dershowitz... Prince Andrew."',
        page_reference: 'p. 4',
      },
      {
        number: 16,
        bates_number: 'EFTA01182998',
        description:
          'Formal witness list — Mitchell is #53: "Has knowledge of Ghislaine Maxwell and Jeffrey Epstein\'s sexual trafficking conduct and interaction with underage minors."',
        page_reference: 'p. 57',
      },
      {
        number: 17,
        bates_number: 'DOJ-OGR-00022656',
        description:
          'Maxwell trial testimony — cross-examination by Todd Blanche. Maxwell: "Yeah, I do remember George... I was friendly with his wife... Heather." Confirmed traveling to Rome with Mitchell and Epstein as a foursome.',
        page_reference: 'pp. 199-200',
      },
      {
        number: 18,
        bates_number: 'EFTA01116468',
        description:
          'Virginia Giuffre account (91 pages): Mitchell "frequently visited Epstein\'s New York residence." Description: "very clean-cut. You wouldn\'t think of him being part of Jeffrey\'s crew."',
        page_reference: 'pp. 46-48',
      },
    ],
  },
  // ─── Story 20: They Use It to Find Us (AOL platform accusation) ──────────────
  {
    slug: 'they-use-it-to-find-us',
    title: 'They Use It to Find Us',
    deck: 'A teenage victim pasted AOL clippings into her journal and wrote seven words never publicly reported: "They use it to find us." Four of AOL\'s top five executives appear in the same journals as men she was directed to have sexual encounters with. The company\'s SVP for policy — the executive most responsible for child safety — is named among those who "dont care if this happens." This is the only accusation in the EFTA corpus that implicates a technology platform as an instrument of the trafficking operation.',
    section: 'the-operation' as const,
    file: 'they-use-it-to-find-us.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'master-intelligence-brief',
    published_at: '2026-03-16T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Aol-logo.svg/1280px-Aol-logo.svg.png',
    hero_image_caption:
      'The AOL logo — in the early 2000s, America Online was the dominant internet service provider in the United States. A teenage victim accused the company of being used as a tool to find and target girls like her.',
    metadata: {
      source_analysis: 'DC/AOL cluster deep-dive — victim journal analysis, platform accusation',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 8, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 4, is_primary: true },
      { name: 'Jim Kimsey', mention_count: 5, is_primary: true },
      { name: 'Steve Case', mention_count: 5, is_primary: true },
      { name: 'Ted Leonsis', mention_count: 4, is_primary: true },
      { name: 'Dan Snyder', mention_count: 3, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02731465',
        description:
          'Victim handwritten scrapbook journal #2 (8 pages) — p.6 contains AOL clippings pasted into margins with victim\'s handwritten accusation: "That company does not protect kids!" and "They use it to find us!" Same page documents pregnancy at "over 20 weeks" while underage.',
        page_reference: 'p. 6',
      },
      {
        number: 2,
        bates_number: 'EFTA02731420',
        description:
          'Victim handwritten scrapbook journal #1 (13 pages), marked "CONFIDENTIAL FOR ATTORNEY\'S EYES ONLY." Names 30+ men including four AOL executives.',
        page_reference: 'Full document (13 pages)',
      },
      {
        number: 3,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — AOL chat rooms documented as environment where adults routinely accessed minors in early 2000s. Child safety enforcement described as reactive.',
        page_reference: 'Evidence context section',
      },
      {
        number: 4,
        bates_number: 'EFTA02731420',
        description:
          'Victim journal #1 — "flights of horror" passage naming Leonsis, Case, Snyder, and Kimsey alongside Epstein. Kimsey described as "deranged."',
        page_reference: 'pp. 5, 11',
      },
      {
        number: 5,
        bates_number: 'HOUSE_OVERSIGHT_016552',
        description:
          'House Oversight property records — Jim Kimsey (as Stephen P. Kimsey) owned $1.2 million Villa Fiorentina condominium in the US Virgin Islands, same territory as Epstein\'s Little St. James island.',
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA01082667',
        description:
          'Trilateral Commission membership roster — Kimsey listed as "James Kimsey, Founding CEO of AOL."',
        page_reference: 'p. 4',
      },
      {
        number: 7,
        bates_number: 'EFTA02548313',
        description:
          'Edge Foundation billionaire science dinner guest lists — Steve Case attended multiple annual dinners alongside Jeffrey Epstein, Jeff Bezos, Bill Gates, and Elon Musk.',
        page_reference: 'Full document',
      },
      {
        number: 8,
        bates_number: 'EFTA01478894',
        description:
          'Deutsche Bank client records — Steve Case listed as "Steve Case, Revolution LLC (former Chairman of AOL)" in Wealth Management division.',
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA02731465',
        description:
          'Victim journal #2 — "Why would they all allow Mr. Leonsis wait this long? Why would he bring a friend and make a video?" Allegation of filmed sexual abuse.',
        page_reference: 'p. 5',
      },
      {
        number: 10,
        bates_number: 'EFTA02731465',
        description:
          'Victim journal #2 — George Vradenburg III listed among those who "dont care if this happens." Vradenburg was AOL\'s SVP for Global and Strategic Policy, overseeing child safety.',
        page_reference: 'p. 5',
      },
      {
        number: 11,
        bates_number: 'EFTA01413261',
        description:
          'Deutsche Bank Wealth Management client records — Dan Snyder listed as client alongside Epstein. Bank opened 76 accounts for Epstein\'s shell entities after 2008 conviction, later fined $150M.',
        page_reference: 'Full document',
      },
      {
        number: 12,
        bates_number: 'EFTA01472840',
        description:
          'Deutsche Bank internal planning document — "$25mm managed investments" for Snyder with "strategic lending" including boat loans and stadium financing.',
        page_reference: 'Full document',
      },
      {
        number: 13,
        bates_number: 'EFTA01416472',
        description:
          'Deutsche Bank client event list — Snyder and Epstein at same invitation-only gatherings.',
        page_reference: 'Full document',
      },
      {
        number: 14,
        bates_number: 'EFTA00521006',
        description:
          'Blank aircraft passenger release form from Joe Gibbs Racing, Inc. found in Epstein\'s files — suggests shared private aviation access between Redskins social circle and Epstein.',
        page_reference: 'Full document (1 page)',
      },
    ],
  },
  // ─── Story 21: The Source of All His Wealth (Wexner financial engine) ────────
  {
    slug: 'the-source-of-all-his-wealth',
    title: 'The Source of All His Wealth',
    deck: 'Federal prosecutors wrote one sentence that reframes the entire Epstein case: his misconduct and fees from managing Les Wexner\'s finances "appears to account for virtually all of Epstein\'s wealth." Wexner\'s $7 billion retail empire — Victoria\'s Secret, The Limited, Abercrombie & Fitch — was managed exclusively by Epstein with virtually no oversight. When Wexner departed in 2007, the entity through which Epstein managed wealth collapsed from $66 million in fee income to $100,000. The Manhattan townhouse that became the primary abuse site was transferred from Wexner at a discount of $35-66 million. The brand was weaponized for recruitment. And when Wexner discovered the theft, he chose private settlement over law enforcement.',
    section: 'follow-the-money' as const,
    file: 'the-source-of-all-his-wealth.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 9,
    is_featured: false,
    case_file_slug: 'master-intelligence-brief',
    published_at: '2026-03-16T00:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Columbus-ohio-leveque-702702.jpg/1280px-Columbus-ohio-leveque-702702.jpg',
    hero_image_caption:
      'The L Brands headquarters in Columbus, Ohio — Les Wexner built a $7 billion retail empire including Victoria\'s Secret, and Jeffrey Epstein managed his personal finances for nearly two decades.',
    metadata: {
      source_analysis: 'Wexner financial deep-dive — prosecution memo, power of attorney, Financial Trust fee collapse, townhouse transfer, $46M charitable routing',
    },
    entities: [
      { name: 'Les Wexner', mention_count: 25, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 18, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 3, is_primary: false },
      { name: 'Virginia Giuffre', mention_count: 2, is_primary: false },
      { name: 'Richard Kahn', mention_count: 1, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — Wexner attorney proffer summary: Epstein controlled all Wexner personal finances with "virtually no oversight." Fees and misconduct "appears to account for virtually all of Epstein\'s wealth." Townhouse and plane sold at "deeply discounted price."',
        page_reference: 'pp. 64-65',
      },
      {
        number: 2,
        bates_number: 'EFTA01365971',
        description:
          'Power of attorney filed in Franklin County, Ohio (1991) — grants Epstein authority to borrow money, pay expenses, sign contracts, and handle all financial dealings on Wexner\'s behalf. "He had absolute control."',
        page_reference: 'Full document',
      },
      {
        number: 3,
        bates_number: 'EFTA01682059',
        description:
          'Financial Trust Company records — fee income collapse: $66 million (2006), $4 million (2007), $100,000 (2008). Tracks precisely to Wexner\'s departure, proving Wexner was Epstein\'s sole source of revenue.',
        page_reference: 'Full document',
      },
      {
        number: 4,
        bates_number: 'EFTA02731069',
        description:
          'SDNY corporate prosecution analysis memo — analyzes whether Nine East 71st Street Corporation (Wexner\'s shell) could be criminally charged. Property valued at $55-86 million, transferred to Epstein for ~$20 million. Criminal acts at address "beginning in at least 2002."',
        page_reference: 'Full document',
      },
      {
        number: 5,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — describes 9 East 71st Street mansion as primary abuse site. Search warrant executed July 6, 2019; photographs of victims found. Maxwell coordinated logistics from this address.',
        page_reference: 'pp. 3-8',
      },
      {
        number: 6,
        bates_number: 'EFTA02731941',
        description:
          'Civil complaint filed by victim "Juliette" — Epstein told her "his good friend Les Wexner owned Victoria\'s Secret" during recruitment, using the brand as a credibility lure.',
        page_reference: 'Full document',
      },
      {
        number: 7,
        bates_number: 'EFTA01681842',
        description:
          'Dershowitz affidavit — allegation that Wexner asked a victim to "dress up in baby doll lingerie of the type made by Victoria\'s Secret."',
        page_reference: 'Full document',
      },
      {
        number: 8,
        bates_number: 'EFTA01654937',
        description:
          'C.O.U.Q. Foundation / YLK Charitable Fund records — $46 million in stock and other assets contributed from Epstein\'s foundation to Wexner\'s charitable fund in 2008, just before Epstein\'s Palm Beach jail sentence. Richard Kahn replaced Maxwell as treasurer.',
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA01656152',
        description:
          'FBI case presentation slides — under "PROMINENT NAMES," Wexner entry records: victim "stated Epstein earned his money from having homosexual sex with Wexner." Reported via anonymous NTOCs.',
        page_reference: 'Wexner slide',
      },
      {
        number: 10,
        bates_number: 'EFTA01657683',
        description:
          'Virginia Giuffre recorded telephone interview, April 7, 2011 — asked if Les Wexner has "relevant information about Jeffrey\'s taking advantage of underage girls," Giuffre answered: "I think he has relevant information, but I don\'t think he\'ll tell you the truth."',
        page_reference: 'p. 26',
      },
      {
        number: 11,
        bates_number: 'EFTA01656152',
        description:
          'FBI case presentation slides — distinguishes "FBI-attended Proffers" (Groff, Visoski, Rodgers) from "SDNY Attorney Proffers" (Les Wexner, Abigail Wexner). The Wexners were interviewed through counsel, not by FBI agents.',
        page_reference: 'Proffer classification slide',
      },
      {
        number: 12,
        bates_number: 'EFTA02731082',
        description:
          '2007 Non-Prosecution Agreement — blanket immunity provision for unnamed "potential co-conspirators." May extend to Wexner as an uncharged individual connected to Epstein\'s financial infrastructure.',
        page_reference: 'NPA section',
      },
      {
        number: 13,
        bates_number: 'EFTA01617356',
        description:
          'Text message records, November 2015 — someone texts Epstein: "Are you still close w Les Wexner? He seems very nice." Eight years after the claimed severance of the relationship.',
        page_reference: 'Full document',
      },
    ],
  },
  {
    slug: 'the-other-predator',
    title: 'The Other Predator',
    deck: 'EFTA documents reveal Harvey Weinstein and Jeffrey Epstein shared guest lists, social fixers, and geography for years — and Virginia Giuffre\'s authenticated journals place Weinstein inside the trafficking operation. No law enforcement agency ever mapped the overlap.',
    section: 'the-operation' as const,
    file: 'the-other-predator.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 9,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-16T12:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Hotel_du_cap_eden_roc.jpg/1280px-Hotel_du_cap_eden_roc.jpg',
    hero_image_caption:
      'The Hotel du Cap-Eden-Roc at Cap d\'Antibes, near Cannes — where Epstein\'s scheduling documents place overlapping social events with Weinstein in May 2012.',
    metadata: {
      source_analysis: 'Corpus search: guest lists, Peggy Siegal emails, Cannes scheduling, Giuffre victim journals, Deutsche Bank compliance records',
    },
    entities: [
      { name: 'Harvey Weinstein', mention_count: 20, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 15, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 3, is_primary: false },
      { name: 'Leon Black', mention_count: 1, is_primary: false },
      { name: 'Glenn Dubin', mention_count: 1, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01990615',
        description:
          'Epstein scheduling document, Cannes Film Festival May 2012 — lists "Harvey Weinstein and Len Blavatnik lunch on boat" alongside Vanity Fair party and Naomi Campbell fashion show.',
        page_reference: 'p. 2',
      },
      {
        number: 2,
        bates_number: 'EFTA00758094',
        description:
          'Formal RSVP tracking sheet — dinner guest list including "Mr. & Mrs. Harvey Weinstein" alongside Leon Black, Glenn Dubin, Charlie Rose, Martha Stewart, Diane von Furstenberg, Mortimer Zuckerman, Jean Pigozzi. Ghislaine Maxwell listed under "Replied NO."',
        page_reference: 'pp. 1-3',
      },
      {
        number: 3,
        bates_number: 'EFTA01832704',
        description:
          'Social event report — "Guests included Harvey Weinstein and family, Nicolas Berggruen, Nat Rothschild, Frederic Fekkai, LA Reid, Russell Simmons, Martha Stewart, Jean Pigozzi."',
        page_reference: 'Full document',
      },
      {
        number: 4,
        bates_number: 'EFTA01421293',
        description:
          'Deutsche Bank compliance document — records 2003 New York Magazine bidding war. "Epstein bid to acquire New York magazine... film producer Harvey Weinstein." Both outbid by Bruce Wasserstein.',
        page_reference: 'p. 17',
      },
      {
        number: 5,
        bates_number: 'EFTA01832581',
        description:
          'Peggy Siegal email to Epstein from Cannes — "Was on Harvey Weinstein\'s yacht this morning. He made me read all the rave reviews on \'Blue Valentine\' and showed me 10 mins of new film about Marilyn Monroe."',
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA01832862',
        description:
          'Email exchange — Peggy Siegal writing directly to Harvey Weinstein about George Lucas, forwarded into Epstein\'s email orbit.',
        page_reference: 'Full document',
      },
      {
        number: 7,
        bates_number: 'EFTA02014290',
        description:
          'Peggy Siegal email to Epstein — "At Tribeca Grill waiting to hear Harvey Weinstein speak... what devotion to my work." April 22, 2011.',
        page_reference: 'Full document',
      },
      {
        number: 8,
        bates_number: 'EFTA02731465',
        description:
          'Virginia Giuffre handwritten victim journals — forensically authenticated, contemporaneous entries naming men she was directed by Epstein and Maxwell to have sexual encounters with. Harvey Weinstein among the names.',
        page_reference: 'Journal entries',
      },
      {
        number: 9,
        bates_number: 'EFTA01155017',
        description:
          'Handwritten contact list recovered from Epstein\'s files — first-name entries including dozens of figures in Epstein\'s network.',
        page_reference: 'pp. 1-3',
      },
      {
        number: 10,
        bates_number: 'EFTA02731082',
        description:
          'SDNY prosecution memo — documents Epstein\'s employment contracts with "golden handcuffs" provisions: loyalty clauses threatening termination and financial forfeiture for cooperation with law enforcement.',
        page_reference: 'Employment section',
      },
      {
        number: 11,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank consent order — $150 million penalty for processing approximately $150 million through 76 Epstein-related accounts while flagging but not reporting suspicious transactions.',
        page_reference: 'Full document',
      },
      {
        number: 12,
        bates_number: 'EFTA02731082',
        description:
          'Weinstein New York conviction, February 24, 2020 — criminal sexual act in the first degree and rape in the third degree. Sentenced to 23 years.',
        page_reference: 'Public record',
      },
      {
        number: 13,
        bates_number: 'EFTA02731082',
        description:
          'New York Court of Appeals overturns Weinstein conviction, April 25, 2024 — ruling trial judge improperly allowed testimony about prior uncharged conduct. Retrial ordered.',
        page_reference: 'Public record',
      },
      {
        number: 14,
        bates_number: 'EFTA02731082',
        description:
          'Weinstein Los Angeles conviction, December 19, 2022 — rape, forced oral copulation, sexual penetration by foreign object. Sentenced to 16 years consecutive to New York sentence.',
        page_reference: 'Public record',
      },
      {
        number: 15,
        bates_number: 'EFTA01615580',
        description:
          'iMessage records — "Harvey Weinstein, like Donald can\'t find anyone to be his lawyer." Preserved in Epstein communications corpus.',
        page_reference: 'p. 5',
      },
    ],
  },
  {
    slug: 'reversal-of-fortune',
    title: 'Reversal of Fortune',
    deck: 'EFTA documents reveal that Alan Dershowitz vacationed at Epstein\'s mansion during an active investigation, mined teenage victims\' MySpace profiles to discredit them before prosecutors, helped negotiate blanket immunity for unnamed co-conspirators — and was himself named in authenticated victim testimony as a participant in the abuse.',
    section: 'the-cover-up' as const,
    file: 'reversal-of-fortune.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 12,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-16T14:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Alan_dershowitz_2009_retouched_cropped.jpg/800px-Alan_dershowitz_2009_retouched_cropped.jpg',
    hero_image_caption:
      'Alan Dershowitz in 2009 — four years after vacationing at Epstein\'s Palm Beach mansion during an active police investigation, and two years after helping negotiate the Non-Prosecution Agreement.',
    metadata: {
      source_analysis: 'Corpus search: NYT profile, Palm Beach police reports, MySpace evidence packages, USAO meeting records, NPA negotiation documents, Giuffre testimony, FBI interview notes, court filings',
    },
    entities: [
      { name: 'Alan Dershowitz', mention_count: 35, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 20, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: false },
      { name: 'Virginia Giuffre', mention_count: 5, is_primary: false },
      { name: 'Prince Andrew', mention_count: 3, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01368194',
        description:
          'New York Times profile "Dershowitz on the Defense" (December 13, 2015) — Dershowitz quotes the Epstein case as "right in my wheelhouse." Documents December 2005 family vacation at Epstein\'s Palm Beach mansion during active police investigation.',
        page_reference: 'Full document',
      },
      {
        number: 2,
        bates_number: 'EFTA01688916',
        description:
          'Palm Beach Police Chief Michael Reiter deposition — lists Dershowitz as regular visitor to Epstein\'s Palm Beach property. Documents background checks on police chief and lead detective.',
        page_reference: 'p. 24',
      },
      {
        number: 3,
        bates_number: 'EFTA01681842',
        description:
          'Sharon Churcher email (2011) — "Don\'t forget Alan Dershowitz... JE\'s buddy and lawyer — good name for your pitch as he repped Claus von Bulow... We all suspect Alan is a pedo."',
        page_reference: 'p. 6',
      },
      {
        number: 4,
        bates_number: 'EFTA01661603',
        description:
          'Investigative compilation — Dershowitz quote: "I proposed to bring in Ken Starr because Jeffrey deserves the best representation possible. Ken Starr happens to be an excellent constitutional lawyer."',
        page_reference: 'p. 93',
      },
      {
        number: 5,
        bates_number: 'EFTA00723522',
        description:
          'New York Post "Billionaire\'s Defense Army" (August 9, 2006) — reports Epstein has "hired a platoon" of elite defense attorneys including Dershowitz, Roy Black, Gerald Lefcourt, and Kenneth Starr.',
        page_reference: 'p. 37',
      },
      {
        number: 6,
        bates_number: 'EFTA01688596',
        description:
          'Palm Beach detective investigative report — "Within the package was a letter from Alan Dershowitz and two www.myspace.com profiles" of teenage victims. Grand jury presentation postponed as a result.',
        page_reference: 'pp. 19-20',
      },
      {
        number: 7,
        bates_number: 'EFTA01682733',
        description:
          'Investigative report — "The case originally was going to be presented to the grand jury in February, but was postponed after Dershowitz produced information gleaned from the Web site myspace.com."',
        page_reference: 'p. 10',
      },
      {
        number: 8,
        bates_number: 'EFTA00745900',
        description:
          'Investigative account — "Prosecutors gave greater weight to the details Mr. Dershowitz provided about the girls in an apparent effort to assail their credibility."',
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA01688916',
        description:
          'Reiter deposition — Dershowitz "began sending the detective Facebook and MySpace posts to demonstrate that some of these girls were no angels." Background checks alleged on Reiter and Detective Recarey.',
        page_reference: 'p. 24',
      },
      {
        number: 10,
        bates_number: 'EFTA01779732',
        description:
          'Daily Mail investigation — "Reiter went up against the entire town of Palm Beach to do what was right but he is not chief any more because of this." Documents political pressure on investigators.',
        page_reference: 'pp. 6-7',
      },
      {
        number: 11,
        bates_number: 'EFTA01659896',
        description:
          'USAO records — September 2006 meeting. "Professor Dershowitz and other members of the defense team presented legal and factual arguments against a federal indictment." Team included Roy Black, Gerald Lefcourt, Lilly Ann Sanchez.',
        page_reference: 'pp. 1, 4',
      },
      {
        number: 12,
        bates_number: 'EFTA01659896',
        description:
          'NPA defense team roster — "Epstein\'s defense team included yourself, Ms. Sanchez, and Messrs. Dershowitz, Lefcourt, Lefkowitz, Lewis, Black, and Goldberger." Eight lawyers total.',
        page_reference: 'p. 4',
      },
      {
        number: 13,
        bates_number: 'EFTA01699841',
        description:
          'Miami Herald investigation — "Acosta, in 2011, would explain that he was unduly pressured by Epstein\'s heavy-hitting lawyers — Lefkowitz, Harvard professor Alan Dershowitz, Jack Goldberger, Roy Black, former U.S. Attorney Guy Lewis, Gerald Lefcourt, and Kenneth Starr."',
        page_reference: 'p. 11',
      },
      {
        number: 14,
        bates_number: 'EFTA01657816',
        description:
          'USAO timeline — "11/23/2007 — Unscheduled meeting between [AUSA], Alan Dershowitz and [individual]. (Drop in by [individual] and Dershowitz)." During final NPA negotiation week.',
        page_reference: 'Full document',
      },
      {
        number: 15,
        bates_number: 'EFTA02731465',
        description:
          'Virginia Giuffre handwritten victim journals — forensically authenticated, contemporaneous entries naming men she was directed to have sexual encounters with. Alan Dershowitz among the names.',
        page_reference: 'Journal entries',
      },
      {
        number: 16,
        bates_number: 'EFTA01657683',
        description:
          'Recorded attorney interview with Virginia Giuffre — interviewer asks: "Alan Dershowitz." Giuffre responds: "Yes." Same interview confirms Prince Andrew and others.',
        page_reference: 'p. 26',
      },
      {
        number: 17,
        bates_number: 'EFTA01656198',
        description:
          'FBI investigation notes — "Alan Dershowitz: [witness] stated she gave him a massage on Epstein\'s plane. (not a minor)." FBI categorizing allegations by victim age.',
        page_reference: 'p. 17',
      },
      {
        number: 18,
        bates_number: 'EFTA01657803',
        description:
          'Giuffre v. Maxwell court filing — lists NPA lobbying by Clinton, Prince Andrew, Dershowitz, Ken Starr, Sanchez, Lefkowitz, and Roy Black. Documents contacts between Judge Reinhart and Epstein-affiliated entities.',
        page_reference: 'pp. 2, 4',
      },
      {
        number: 19,
        bates_number: 'EFTA01368204',
        description:
          'New York Times reporting on Giuffre v. Dershowitz defamation litigation — "Two lawyers accused Alan Dershowitz of defamation for saying they had made up an accusation that he had sex with a teenager." Settled November 2022.',
        page_reference: 'Full document',
      },
    ],
  },
  {
    slug: 'power-dinner',
    title: 'Power Dinner',
    deck: 'Every documented interaction between Larry Summers and Jeffrey Epstein in the EFTA corpus falls after the 2008 conviction. The scheduling emails reveal six years of dinners with Bill Gates, breakfasts at Summers\' home, invitations to Little St. James — and Deutsche Bank payments to Summers\' consulting firm. The victim journals tell a different story.',
    section: 'follow-the-money' as const,
    file: 'power-dinner.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 11,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-16T16:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Lawrence_Summers_Treasury_portrait.jpg/400px-Lawrence_Summers_Treasury_portrait.jpg',
    hero_image_caption:
      'Larry Summers in his official Treasury Department portrait — taken during the Clinton administration, years before his documented post-conviction social relationship with Jeffrey Epstein.',
    metadata: {
      source_analysis: 'Corpus search: Groff scheduling emails, dinner/breakfast arrangements, Deutsche Bank consent order wire records, Giuffre victim journals, Wigdor Law attorney letter, Epstein social ranking lists',
    },
    entities: [
      { name: 'Larry Summers', mention_count: 30, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 25, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02189210',
        description:
          'Lesley Groff email to household staff — "Bill Gates, Larry Summers and Jes Staley are the attendees at the moment. Power dinner!!" Planning for May 2, 2011 dinner at Epstein\'s Manhattan townhouse.',
        page_reference: 'Full document',
      },
      {
        number: 2,
        bates_number: 'EFTA01844738',
        description:
          'Epstein email to Summers, January 8, 2012 — "If you would like, next time in ny we can have dinner with Woody Allen at my house.. He is terrific." Summers replies from Jamaica.',
        page_reference: 'Full document',
      },
      {
        number: 3,
        bates_number: 'EFTA01844414',
        description:
          'Epstein email to Summers, January 19, 2012 — "Woody Allen dinner my house 29th?" Follow-up January 27: "dinner with woody moved to the 31st."',
        page_reference: 'Full document',
      },
      {
        number: 4,
        bates_number: 'EFTA01901827',
        description:
          'Epstein email, February 2013 — "poppi, Larry Summers, his wife, Woody ALLen and soon yi will be at the house in palm beach tomororw for lunch around 230. why don\'t you bring whoever you want."',
        page_reference: 'Full document',
      },
      {
        number: 5,
        bates_number: 'EFTA02189226',
        description:
          'Groff email to Summers\' office, April 30, 2011 — "Good morning Larry. Jeffrey wanted me to let you know that on Monday night, Bill Gates will have already eaten dinner prior to his arrival."',
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA01844429',
        description:
          'Staff email, January 9, 2012 — "IN the dining room there are photos of Bill Gates with Larry Summers taken at the house the other day, should I have someone take them down. or is he ok with competition."',
        page_reference: 'Full document',
      },
      {
        number: 7,
        bates_number: 'EFTA01873597',
        description:
          'Scheduling document — "9:30 BREAKFAST w/Larry Summers at Larry\'s home." Includes Summers\' home address, wife Julie\'s cell number, and Google Maps directions from Charles Hotel in Cambridge.',
        page_reference: 'Full document',
      },
      {
        number: 8,
        bates_number: 'EFTA02019208',
        description:
          'Groff scheduling email — "Reminder Larry can no longer do breakfast on the 15th and is asking if you could meet..." Routine rescheduling of Epstein-Summers meetings.',
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA02006442',
        description:
          'Groff email — "Below from Julie in Larry Summers office re you and Larry have not been able to connect yet... shall I provide the ranch phone number for Larry?" Ranch = Zorro Ranch, New Mexico.',
        page_reference: 'Full document',
      },
      {
        number: 10,
        bates_number: 'EFTA01817477',
        description:
          'Epstein social ranking list — handwritten categories of contacts. Summers appears alongside "ehud barak, tony blair, bloomberg" in the top social tier.',
        page_reference: 'p. 1',
      },
      {
        number: 11,
        bates_number: 'EFTA02006674',
        description:
          'Epstein email to Boris Nikolic, September 21, 2012 — "you can invite david rubenstein to lunch on monday with LArry summers and ehud barak." Summers used as social bait to attract other power figures.',
        page_reference: 'p. 1',
      },
      {
        number: 12,
        bates_number: 'EFTA02007268',
        description:
          'Epstein email to Summers, February 10, 2011 — "ehud will be here for breakfast.. questions?" Inviting Summers to meet former Israeli PM Ehud Barak at Epstein\'s residence.',
        page_reference: 'Full document',
      },
      {
        number: 13,
        bates_number: 'EFTA01941328',
        description:
          'Epstein email to Summers, December 22, 2013 — "ehud is coming to spend time on the island, jan 23-25, want to join?" The island is Little St. James, site of documented trafficking and abuse.',
        page_reference: 'Full document',
      },
      {
        number: 14,
        bates_number: 'EFTA01681865',
        description:
          'Deutsche Bank consent order — documents $53,750 wire transfer on 11/7/2014 to "L H Summers Economic Consulting LLC." Wire details read: "Reference Kathy Ruemmler" (former White House counsel who advised Epstein).',
        page_reference: 'p. 37',
      },
      {
        number: 15,
        bates_number: 'EFTA01285208',
        description:
          'Deutsche Bank transaction records — additional wire transfers to "L H Summers Economic Consulting LLC" for "travel expenses." Multiple transactions documented.',
        page_reference: 'Full document',
      },
      {
        number: 16,
        bates_number: 'EFTA02043934',
        description:
          'Groff email, September 13, 2016 — "Good Morning Julie and Sarah! Jeffrey will be up at Harvard this coming Saturday Sept. 17th... he will be meeting with many interesting..." Eight years post-conviction.',
        page_reference: 'Full document',
      },
      {
        number: 17,
        bates_number: 'EFTA01916625',
        description:
          'Summers email to Epstein, 2014 — "Can we find someone who wants to be humanistic and poetic, or needs to give money to public tv or Harvard ed, to channel in 2 million range." Summers helping Epstein identify donation conduits.',
        page_reference: 'Full document',
      },
      {
        number: 18,
        bates_number: 'EFTA02731465',
        description:
          'Virginia Giuffre handwritten victim journals — forensically authenticated, contemporaneous entries naming Larry Summers among men she was directed to have sexual encounters with.',
        page_reference: 'Journal entries',
      },
      {
        number: 19,
        bates_number: 'EFTA02731420',
        description:
          'Giuffre victim journal page 5 — "Both he and Larry Summers are fucking disgusting!" Written in context of being flown to Epstein\'s NYC townhouse by Dana Chasin. Wigdor Law letter (EFTA02731721) confirms: victim\'s family "knew Dana Chasin and that is how [victim] was flown to NYC the first time (where she had sex with Larry Summers)."',
        page_reference: 'p. 5',
      },
    ],
  },
  {
    slug: 'the-revolving-door',
    title: 'The Revolving Door',
    deck: 'On January 1, 2008, Bruce Reinhart was a federal prosecutor. On January 2, he was representing Jeffrey Epstein\'s co-conspirators. He set up his office next door to Epstein\'s work-release location, was paid $84,000 from Epstein\'s accounts, and filed a false affidavit that the DOJ later admitted was untrue. The perjury investigation was stonewalled. He became a federal magistrate judge.',
    section: 'the-cover-up' as const,
    file: 'the-revolving-door.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'prosecutorial-failure',
    published_at: '2026-03-16T20:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Bruce_Reinhart_%28FL%29.jpg/440px-Bruce_Reinhart_%28FL%29.jpg',
    hero_image_caption:
      'Bruce Reinhart — former AUSA turned Epstein defense attorney turned U.S. Magistrate Judge.',
    metadata: {
      source_analysis: 'Corpus search: CVRA complaint (EFTA00068215), Villafana testimony (EFTA00225378), court filings (EFTA01657803), Miami Herald investigation (EFTA00798522), JPMorgan wire records (EFTA01578729, EFTA01579090, EFTA01483035, EFTA01483182, EFTA01581347), Kellen deposition (EFTA00729910)',
    },
    entities: [
      { name: 'Bruce Reinhart', mention_count: 25, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 15, is_primary: true },
      { name: 'Alan Dershowitz', mention_count: 3, is_primary: false },
      { name: 'Sarah Kellen', mention_count: 4, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00798522',
        description:
          'Miami Herald investigation — "He left the U.S. Attorney\'s Office on Jan. 1, 2008, and went to work representing Epstein\'s employees on Jan. 2, 2008, court records show." Also notes Reinhart is now a U.S. magistrate judge.',
        page_reference: 'p. 24',
      },
      {
        number: 2,
        bates_number: 'EFTA00068215',
        description:
          'Prof. Cassell CVRA complaint — documents Reinhart\'s office location at 250 S. Australian Ave Suite 1400, same building/floor as Goldberger, next door to Florida Science Foundation (Epstein\'s work-release entity).',
        page_reference: 'pp. 6-7',
      },
      {
        number: 3,
        bates_number: 'EFTA00235751',
        description:
          'Victims\' Motion for CVRA Violations — "Reinhart undertook the representation of numerous Epstein employees and pilots... Specifically, he represented [Sarah Kellen], his housekeeper (Louella Ruboyo), his pilots." Representation paid by Epstein.',
        page_reference: 'p. 21',
      },
      {
        number: 4,
        bates_number: 'EFTA00729910',
        description:
          'Kellen deposition record — "At the deposition, she was represented by Bruce Reinhart. She invoked the Fifth on all substantive questions regarding her role in arranging for minor girls to come to Epstein\'s mansion to be sexually abused."',
        page_reference: 'p. 19',
      },
      {
        number: 5,
        bates_number: 'EFTA01578729',
        description:
          'JPMorgan Chase wire authorization — $20,000 from Epstein account to "Bruce E Reinhart, PA" at Gulfstream Business Bank. One of multiple documented wires totaling $84,000+. Additional wires at EFTA01579090 ($18,117), EFTA01483035 ($25,000), EFTA01483182 ($11,117), EFTA01581347 ($10,000).',
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA00225378',
        description:
          'AUSA Villafana testimony — "AUSA Reinhart was my office neighbor and colleague. I sought AUSA Reinhart\'s counsel on strategies for how to handle Epstein\'s personal assistants — whether they should be charged or if we should seek immunity for them." Reinhart then said he was "best friends" with Goldberger.',
        page_reference: 'p. 114',
      },
      {
        number: 7,
        bates_number: 'EFTA00209299',
        description:
          'Cassell letter to U.S. Attorney requesting investigation — documents Reinhart\'s sworn declaration ("I never learned any confidential, non-public information") and the government\'s July 2013 admission contradicting it. DE 213-1 at 9.',
        page_reference: 'pp. 1-3',
      },
      {
        number: 8,
        bates_number: 'EFTA00068221',
        description:
          'Cassell March 2014 letter requesting criminal investigation of Reinhart perjury — "it is now clear that former Assistant U.S. Attorney Bruce E. Reinhart has filed a false affidavit in the victims\' CVRA case."',
        page_reference: 'Full document',
      },
      {
        number: 9,
        bates_number: 'EFTA00068225',
        description:
          'Cassell January 2016 letter to U.S. Attorney Puerto Rico — documents the stonewalling: case bounced between 4 AUSAs, five phone calls unreturned, letter unanswered. "It appears obvious that the U.S. Attorney\'s Office is giving us the run-around."',
        page_reference: 'Full document',
      },
      {
        number: 10,
        bates_number: 'EFTA01657803',
        description:
          'Court filing — documents DOJ OPR investigation: "The Justice Department\'s Office of Professional Responsibility and/or other Government entities have collected information about: (a) Bruce Reinhart\'s possible involvement in the Epstein matter." Also documents contacts between Reinhart and Epstein-affiliated entities.',
        page_reference: 'pp. 4-5',
      },
    ],
  },
  {
    slug: 'the-rehabilitation',
    title: 'The Rehabilitation',
    deck: 'The EFTA corpus documents a four-year relationship between Bill Gates and Jeffrey Epstein — from January 2011 through September 2014. Gates stayed at Epstein\'s Paris apartment, invited Epstein to the Gates Foundation headquarters, authorized Epstein to negotiate his science advisor\'s severance, and participated in a coordinated PR rehabilitation strategy with pre-written talking points. A Stanford professor drafted the scripts. Gates was to be the public face.',
    section: 'the-network' as const,
    file: 'the-rehabilitation.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 11,
    is_featured: false,
    case_file_slug: null,
    published_at: '2026-03-16T22:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Bill_Gates_2017_%28cropped%29.jpg/440px-Bill_Gates_2017_%28cropped%29.jpg',
    hero_image_caption:
      'Bill Gates at a public event — co-founder of Microsoft and documented participant in Jeffrey Epstein\'s post-conviction rehabilitation strategy.',
    metadata: {
      source_analysis: 'Corpus search: 6,656 documents / 7,856 pages referencing Gates. Key documents: EFTA02030179 (Kosslyn PR scripts), EFTA02032102 (Gates Foundation visitor registration), EFTA01965179 (Gates authorizes Epstein to negotiate Nikolic severance), EFTA01844429 (trophy photos), EFTA01960417 (Melinda dinner), EFTA01959043 (donation offer), EFTA01747368 (Wolff rehabilitation claim)',
    },
    entities: [
      { name: 'Bill Gates', mention_count: 30, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 25, is_primary: true },
      { name: 'Larry Summers', mention_count: 6, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02030179',
        description:
          'Stephen Kosslyn email to Epstein — "Two scripts" for Gates and Epstein to use with reporters. Gates script: "Jeffrey Epstein has unquestioned financial expertise... everyone deserves a second chance." Kosslyn adds: "Great to see you last night! Thanks again for getting us invited."',
        page_reference: 'p. 1',
      },
      {
        number: 2,
        bates_number: 'EFTA02032102',
        description:
          'Gates Foundation official visitor management system email: "Dear Jeffrey Epstein, You have been registered as a visitor to the Bill & Melinda Gates Foundation on 07/15/11, starting at 3:30PM." Address: 500 5th Ave North, Seattle.',
        page_reference: 'p. 1',
      },
      {
        number: 3,
        bates_number: 'EFTA01301092',
        description:
          'Reference to Richard C. Henriques, Chief Financial Officer of the Bill & Melinda Gates Foundation — contact information in Epstein correspondence.',
        page_reference: 'p. 1',
      },
      {
        number: 4,
        bates_number: 'EFTA02102896',
        description:
          'Epstein assistant scheduling a call between Epstein and "Connie" (General Counsel of the Gates Foundation), coordinated through Diana Blair, Executive Assistant to the General Counsel. July 2014.',
        page_reference: 'p. 1',
      },
      {
        number: 5,
        bates_number: 'EFTA01844429',
        description:
          'Epstein email to Tom Barrack: "IN the dining room there are photos of Bill Gates with Larry Summers taken at the house the other day, should I have someone take them down. or is he ok with competition." January 9, 2012.',
        page_reference: 'p. 1',
      },
      {
        number: 6,
        bates_number: 'EFTA01797988',
        description:
          'Lesley Groff schedule email: "7:30 DINNER WITH BILL GATES AND BORIS NIKOLIC" (Jan 31, 2011). Then: "8:00 Dinner w/Bill Gates, Boris Nikolic and Peter Mandelson" (Feb 1, 2011). Two consecutive nights of dinners at Epstein\'s townhouse.',
        page_reference: 'p. 1',
      },
      {
        number: 7,
        bates_number: 'EFTA02189210',
        description:
          'Staff email: "dinner Monday night is at 9pm. Bill Gates, Larry Summers and Jes Staley are the attendees at the moment. Power dinner!!" May 2, 2011.',
        page_reference: 'p. 1',
      },
      {
        number: 8,
        bates_number: 'EFTA01960417',
        description:
          'Schedule: "7:30 BILL & Melinda GATES to arrive the house. 8:00pm DINNER: Bill, Melinda, Terje, Jagbland, JE. Larry & Lisa Summers are invited." September 2013 — Melinda Gates at Epstein\'s home.',
        page_reference: 'p. 1',
      },
      {
        number: 9,
        bates_number: 'EFTA01898746',
        description:
          'Epstein to multiple contacts: "will have bill gates staying with me in paris, what day can you come." March 2013. Confirmed by EFTA01899812 and EFTA01969029 (June 2013 Paris stay).',
        page_reference: 'p. 1',
      },
      {
        number: 10,
        bates_number: 'EFTA01832859',
        description:
          'Epstein coaching Boris Nikolic on job titles within Gates organization: "president Bill Gates investments.. president Bill Gates Interests." February 2011. Also EFTA01939674 confirming Nikolic\'s role as Chief Advisor for Science and Technology.',
        page_reference: 'p. 1',
      },
      {
        number: 11,
        bates_number: 'EFTA01965179',
        description:
          'Gates emails Epstein: "Larry Cohen is authorized to talk to you about the employment issues with Boris." Direct authorization for Epstein to negotiate Nikolic severance. EFTA01964544: Epstein raises 8 points including "If Melinda wants a divorce, how does Boris protect himself."',
        page_reference: 'p. 1',
      },
      {
        number: 12,
        bates_number: 'EFTA01866351',
        description:
          'Epstein to ME Karim Wade (son of Senegal\'s president): "Gates has asked me to do it.. he is coming on Monday the 2nd." April 2011 name-dropping.',
        page_reference: 'p. 1',
      },
      {
        number: 13,
        bates_number: 'EFTA02006672',
        description:
          'Epstein to NYT journalist Landon Thomas: "bill gates and I, are going to convene some very small gatherings on new solutions for the financial distress." September 2012. Also EFTA02032000: "boris (bill gates person)" to Moscow contacts.',
        page_reference: 'p. 1',
      },
      {
        number: 14,
        bates_number: 'EFTA01843425',
        description:
          'Epstein instructs staff to follow up with Jenna Mulhall-Brereton (Gates Foundation Global Health - Policy & Advocacy) about Ivory Coast — "she was at my house with Gates foundation." January 2012.',
        page_reference: 'p. 1',
      },
      {
        number: 15,
        bates_number: 'EFTA01832430',
        description:
          'Epstein to Summers: "I talked to Staley regarding the Donor advised fund. You and I are invited to Scene to spend serious time with Bill Gates." February 2011. DAF discussions continued through April 2014 (EFTA01928217: Gates: "I meet on the DAF on April 29"). Also EFTA02021155: Osborne to Epstein\'s island for "Gates donor advised funds."',
        page_reference: 'p. 1',
      },
      {
        number: 16,
        bates_number: 'EFTA01959043',
        description:
          'Epstein to Gates and Larry Cohen: "Boris told me of your kind offer to donate money in my name---- a. thank you, lets discuss b. my giving is always anonymous." Same email: "I just organized for a 300 million dollar gift that cost the donor zero." September 2013.',
        page_reference: 'p. 1',
      },
      {
        number: 17,
        bates_number: 'EFTA01747368',
        description:
          'Michael Wolff email: "It is Bill Gates who at the end of the summer began prodding Epstein to begin a process of public rehabilitation." Establishes Gates as the catalyst for rehabilitation strategy.',
        page_reference: 'p. 1',
      },
    ],
  },
  {
    slug: 'the-premiere-queen',
    title: 'The Premiere Queen',
    deck: 'Over fifty emails in the EFTA corpus document Peggy Siegal — New York\'s premier movie premiere publicist — as the professional social infrastructure of Jeffrey Epstein\'s post-conviction rehabilitation. She curated his dinner guest lists with network anchors, billionaire financiers, and Hollywood directors. She brokered celebrity introductions on demand. She bridged Epstein\'s network to Harvey Weinstein\'s. And she reported a $90,000 Weinstein payment to Epstein\'s office — not to her own.',
    section: 'the-operation' as const,
    file: 'the-premiere-queen.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: null,
    published_at: '2026-03-17T01:00:00Z',
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Peggy_Siegal_2012_Shankbone.JPG/440px-Peggy_Siegal_2012_Shankbone.JPG',
    hero_image_caption:
      'Peggy Siegal at a 2012 event — New York\'s premier movie premiere publicist, who curated Jeffrey Epstein\'s post-conviction guest lists and bridged his network to Harvey Weinstein\'s.',
    metadata: {
      source_analysis: 'Corpus search: 50+ emails spanning 2009-2015. Key documents: EFTA01899911 (25-name dinner guest list), EFTA02067532 (Weinstein $90K payment report), EFTA01788816 ("send some goons"), EFTA01763704 (Hathaway/Gates coffee), EFTA02078187 (amfAR Cannes ticket purchase), EFTA01987364 (company financials reported to Epstein), EFTA01832862 (Weinstein→Siegal→Epstein intelligence flow)',
    },
    entities: [
      { name: 'Peggy Siegal', mention_count: 30, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 25, is_primary: true },
      { name: 'Harvey Weinstein', mention_count: 8, is_primary: false },
      { name: 'Bill Gates', mention_count: 6, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01899911',
        description:
          'Siegal email "Some ideas" for March 21, 2013 dinner: 25+ names including Brian Williams, Katie Couric, George Stephanopoulos, Walter Isaacson, David Remnick, Woody Allen, Charlie Rose, Matt Lauer, Steve Schwarzman, Leon Black, Leonard Lauder, Barbara Walters. "This is just off the top of my head.... had Al Pacino last night for HBO\'s Spector."',
        page_reference: 'p. 1',
      },
      {
        number: 2,
        bates_number: 'EFTA01990853',
        description:
          'Siegal\'s office standing instruction to Epstein staff: "Send all screening invites asap. He is in NY." Epstein treated as priority VIP for all major film events.',
        page_reference: 'p. 1',
      },
      {
        number: 3,
        bates_number: 'EFTA02006600',
        description:
          'Hugh Jackman and Tom Hooper private screening of "Les Misérables" at AMC Lincoln Square. Siegal arranges Epstein attendance, mentions "the day at leon blacks" afterward.',
        page_reference: 'p. 1',
      },
      {
        number: 4,
        bates_number: 'EFTA02032496',
        description:
          '"The Great Gatsby" screening at MoMA arranged by Siegal for Epstein. Also references Standard Hotel and Anna Wintour lunch.',
        page_reference: 'p. 1',
      },
      {
        number: 5,
        bates_number: 'EFTA01763881',
        description:
          '"Zero Dark Thirty" screening at Sony arranged by Siegal for Epstein.',
        page_reference: 'p. 1',
      },
      {
        number: 6,
        bates_number: 'EFTA01899269',
        description:
          'Michael Douglas private screening invitation from Siegal: "There is no press and it\'s for Michael\'s friends. You are my plus one."',
        page_reference: 'p. 1',
      },
      {
        number: 7,
        bates_number: 'EFTA01835262',
        description:
          'Epstein to Siegal: "is ann hathaway, in ney on the 31st" — January 2011. Checking celebrity availability through his social director.',
        page_reference: 'p. 1',
      },
      {
        number: 8,
        bates_number: 'EFTA01763704',
        description:
          'Epstein to Siegal: "Can you bring ann Hathaway to have a coffee with bill gates and me" — February 2013. Celebrity deployment for Gates meeting.',
        page_reference: 'p. 1',
      },
      {
        number: 9,
        bates_number: 'EFTA01927179',
        description:
          'Epstein to Siegal: "I need 8 great seats to cabaret on May 31 please help." Siegal as personal concierge for cultural events.',
        page_reference: 'p. 1',
      },
      {
        number: 10,
        bates_number: 'EFTA01788816',
        description:
          'Siegal to Epstein about Weinstein: "as he owes me $90,000.!!! Can you send some goons after him? xoxo Peg" — October 12, 2015.',
        page_reference: 'p. 1',
      },
      {
        number: 11,
        bates_number: 'EFTA02067532',
        description:
          'Siegal to Epstein\'s assistant: "Please tell Jeffrey that Harvey Weinstein paid me the 90,000 he owed me for a year. Peggy" — November 16, 2015. Payment reported to Epstein\'s office.',
        page_reference: 'p. 1',
      },
      {
        number: 12,
        bates_number: 'EFTA02014290',
        description:
          'Siegal from Tribeca Film Festival: "waiting to hear Harvey Weinstein speak...what devotion to my work." Documents professional relationship with Weinstein.',
        page_reference: 'p. 1',
      },
      {
        number: 13,
        bates_number: 'EFTA01832862',
        description:
          'New Year\'s Day 2011 email chain: Siegal emails Weinstein about George Lucas, forwards intelligence to Epstein. Epstein responds: "Good reconnaissance we will make sure." Information flow: Weinstein → Siegal → Epstein.',
        page_reference: 'p. 1',
      },
      {
        number: 14,
        bates_number: 'EFTA01901796',
        description:
          'Epstein tells Siegal he is "in palm beach, with bill gates at the house." Siegal responds: "Very exciting about Bill Gates. Where is Melinda?"',
        page_reference: 'p. 1',
      },
      {
        number: 15,
        bates_number: 'EFTA02147469',
        description:
          'Siegal seeking Elton John AIDS Foundation Oscar party tickets for Epstein, invoking Boris Nikolic-Gates photo as social proof: "Jenna sent a photo of Boris with Bill Gates at an AIDS benefit in D.C."',
        page_reference: 'p. 1',
      },
      {
        number: 16,
        bates_number: 'EFTA02142824',
        description:
          'Lesley Groff to Siegal: "He\'s still meeting with Gates and large group of people" — explaining Epstein\'s unavailability.',
        page_reference: 'p. 1',
      },
      {
        number: 17,
        bates_number: 'EFTA01987364',
        description:
          'Siegal reports company financial structure to Epstein: "Bryan takes 40% of profit after expenses. He has grown the company and it is growing. Is that a lot to pay himself?" August 2011.',
        page_reference: 'p. 1',
      },
      {
        number: 18,
        bates_number: 'EFTA02032192',
        description:
          'Siegal coordinates mother Annette Siegal\'s estate through Epstein\'s attorney Phil Michaels — including sale of $2.1M Alpine, NJ house.',
        page_reference: 'p. 1',
      },
      {
        number: 19,
        bates_number: 'EFTA01975809',
        description:
          'Siegal relays instruction: "Jeffrey Epstein told me to sit tight" regarding estate management matters.',
        page_reference: 'p. 1',
      },
      {
        number: 20,
        bates_number: 'EFTA02078187',
        description:
          'Amanda Skarbnik (Siegal\'s assistant) to amfAR: "Peggy\'s friend, Jeffrey Epstein, is going to purchase a ticket on Peggy\'s behalf." CC\'d to Richard Kahn. May 2015 Cannes gala.',
        page_reference: 'p. 1',
      },
      {
        number: 21,
        bates_number: 'EFTA02014566',
        description:
          'Siegal\'s Cannes dispatch to Epstein: "Sitting next to Brett Ratner...he produced Woody\'s 3 hour documentary that just was shown at Cannes. We are about to see Roman Polanski documentary."',
        page_reference: 'p. 1',
      },
      {
        number: 22,
        bates_number: 'EFTA02024242',
        description:
          'Siegal from Cannes: "Have not stopped running to 2 or 3 films a day and every cockamamie party...changing my outfits 3 times a day."',
        page_reference: 'p. 1',
      },
    ],
  },
  {
    slug: 'the-white-house-counsel',
    title: 'The White House Counsel',
    deck: 'The EFTA corpus documents a seven-year relationship between Kathryn Ruemmler — former White House Counsel to President Obama — and convicted sex offender Jeffrey Epstein. She was named successor trustee of his $577 million trust and successor executor of his will. She dined with Woody Allen and Peter Thiel at his home. She met Bill Gates through his office. She introduced Cass Sunstein to his social circle. And when Bloomberg reported her as the leading candidate for Attorney General, it was Epstein who coached her on video presentation, glasses, and body language.',
    section: 'follow-the-money' as const,
    file: 'the-white-house-counsel.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 12,
    is_featured: false,
    case_file_slug: null,
    published_at: '2026-03-17T03:00:00Z',
    hero_image_url: null,
    hero_image_caption: null,
    metadata: {
      source_analysis: 'Corpus research: 20+ unique EFTA documents. Key documents: EFTA01266434 (2017 Trust — successor trustee Section 7.1), EFTA01266268 (Last Will — successor executor), EFTA02590624 (AG nomination coaching), EFTA02098691 (Gates/Four Seasons meeting), EFTA02097572 (Woody Allen dinner), EFTA02097728 (Kerrey/Thiel/Sunstein brunch), EFTA02088962 (ring delivery), EFTA02045273 (spa payment), EFTA01752843 (Brad Karp/Paul Weiss recruitment)',
    },
    entities: [
      { name: 'Kathryn Ruemmler', mention_count: 35, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 30, is_primary: true },
      { name: 'Bill Gates', mention_count: 6, is_primary: false },
      { name: 'Eva Andersson-Dubin', mention_count: 5, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02590624',
        description:
          'AG nomination email thread: Bloomberg article "Obama Favoring Former White House Counsel Kathryn Ruemmler to Succeed Holder" — Ruemmler sends to Epstein, late-night call arranged, next morning Epstein coaches on video, glasses, body language. "lets hire a video coach. you need to be trained."',
        page_reference: 'pp. 1-3',
      },
      {
        number: 2,
        bates_number: 'EFTA01266434',
        description:
          'Jeffrey E. Epstein 2017 Trust (23 pages). Section 7.1 — Successor Trustees: "KATHRYN RUEMMLER shall be appointed the successor trustee." Trust valued at ~$577M at Epstein\'s death.',
        page_reference: 'p. 18 (Section 7.1)',
      },
      {
        number: 3,
        bates_number: 'EFTA01266268',
        description:
          'Last Will and Testament of Jeffrey E. Epstein. Article THIRD: "I appoint EVA ANDERSSON DUBIN, as successor Executor, followed by KATHRYN RUEMMLER, as successor Executor." Executed June 2017.',
        page_reference: 'p. 1',
      },
      {
        number: 4,
        bates_number: 'EFTA02098691',
        description:
          'Google Calendar reminder: "3-3:30pm Meet Kathy Ruemmler at the Four Seasons w/Bill Gates" — September 8, 2014. Four Seasons, 57 East 57th Street.',
        page_reference: 'p. 1',
      },
      {
        number: 5,
        bates_number: 'EFTA02097572',
        description:
          'Lesley Groff schedule email: "7:00pm DINNER w/Woody Allen, Soon Yi, Kathy Ruemmler, and MAYBE Peter Thiel" — September 13, 2014.',
        page_reference: 'p. 1',
      },
      {
        number: 6,
        bates_number: 'EFTA02097728',
        description:
          'Lesley Groff schedule: "11:00am BRUNCH w/Bob Kerrey, Peter Thiel, Kathy Ruemmler and Cass" — September 14, 2014. Barney Greengrass catering.',
        page_reference: 'p. 1',
      },
      {
        number: 7,
        bates_number: 'EFTA02340944',
        description:
          'Ruemmler introduces Cass Sunstein to Epstein: "Thought of a smart person for you to meet: Cass Sunstein. He is in NY now; married to Sam Power. He was POTUS\'s regulatory czar." August 30, 2014.',
        page_reference: 'p. 1',
      },
      {
        number: 8,
        bates_number: 'EFTA02589191',
        description:
          'Epstein reply to Sunstein introduction: "Great, also week of 22 many interesting people at house." August 30, 2014.',
        page_reference: 'p. 1',
      },
      {
        number: 9,
        bates_number: 'EFTA02088962',
        description:
          'Ring delivery coordination: "Kathy, Jeffrey would like Jojo to deliver your ring to you!!" Leo hand-delivers to Latham & Watkins, 885 Third Avenue. December 5, 2014.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 10,
        bates_number: 'EFTA02079873',
        description:
          'Gift FedEx overnight: "I have a gift for you from Jeffrey that just could not wait!" Sent to Latham & Watkins DC, 555 Eleventh Street NW. April 22, 2015.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 11,
        bates_number: 'EFTA02045273',
        description:
          'Spa payment: "Jeffrey Epstein Amex for Kathy Ruemmler Spa Appt Today (Aug 14, 2016)" — Four Seasons Hotel Washington, DC. Epstein pays with his credit card.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 12,
        bates_number: 'EFTA02044853',
        description:
          'Flower delivery to Ruemmler\'s DC office. Ruemmler: "That is so sweet of Jeffrey and not necessary (per usual). :-)" — the "per usual" indicates recurring pattern. August 19, 2016.',
        page_reference: 'p. 1',
      },
      {
        number: 13,
        bates_number: 'EFTA02067830',
        description:
          'Amazon shipment: Samsung UN46C6300 46-inch TV ($1,099) shipped to "Kathryn Ruemmler." Order confirmation forwarded to Epstein\'s email. October 2010.',
        page_reference: 'pp. 1-3',
      },
      {
        number: 14,
        bates_number: 'EFTA01752843',
        description:
          'Epstein to Brad Karp (Chairman, Paul Weiss): "Hope you can convince Kathy Ruemmler." Karp: "Still working on 1." Recruiting sitting White House Counsel to law firm. December 6, 2013.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 15,
        bates_number: 'EFTA02713278',
        description:
          'Ruemmler forwards David Axelrod email about Paul Simon CURE benefit to Epstein. Axelrod: "Thanks again. Means the world to me! xoxo." October 3, 2015.',
        page_reference: 'p. 1',
      },
      {
        number: 16,
        bates_number: 'EFTA01914482',
        description:
          'Eva Fact vs. Fiction breast cancer luncheon invitation: "Please give it to anyone you would like, including Kathryn Ruemmler and Melinda Gates." Mount Sinai, September 29, 2014.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 17,
        bates_number: 'EFTA02098445',
        description:
          'Staff to Epstein: "Eva is asking for the name and details for the \'woman lawyer who work at the white house\' who is to join her at her Fact Vs. Fiction luncheon. Is this Kathy Ruemmler?" September 9, 2014.',
        page_reference: 'p. 1',
      },
      {
        number: 18,
        bates_number: 'EFTA02097902',
        description:
          'Ehud Barak meeting scheduling: "Might you be available to come see Jeffrey and Ehud Barak at 1pm on Tues Sept 23rd." Ruemmler: "Yes. I can do Tuesday." September 18, 2014.',
        page_reference: 'p. 1',
      },
    ],
  },
  {
    slug: 'the-september-salon',
    title: 'The September Salon',
    deck: 'In September 2014, the scheduling apparatus of a convicted sex offender orchestrated meetings at his Manhattan townhouse involving the Deputy Secretary of State (later CIA Director), the Secretary General of the Council of Europe, a former Israeli Prime Minister, a former White House Counsel, a former Treasury Secretary, a billionaire venture capitalist, and a filmmaker accused of child sexual abuse. The EFTA corpus preserves the emails that choreographed it all — including Epstein\'s request for "alone time" with America\'s second-highest diplomat.',
    section: 'the-network' as const,
    file: 'the-september-salon.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: null,
    published_at: '2026-03-17T12:00:00Z',
    hero_image_url: null,
    hero_image_caption: null,
    metadata: {
      source_analysis: 'Corpus research: 30+ unique EFTA documents from Thread 15 (September 2014 Convergence) and Thread 16 (Intelligence Asset Question). Key documents: EFTA02097661 (Sept 10 proposed schedule with compartmentalized time blocks), EFTA02097678 (People To See master list), EFTA01922017 (Burns as social currency), EFTA02095883/EFTA01748418 (Sept 24 Burns appointment), EFTA01968806/EFTA01970317 (Burns brokering), EFTA01928716 (Jagland Ritz rooms), EFTA01927644 (Jagland gratitude), EFTA01899436 (Jagland Strasbourg residence)',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 30, is_primary: true },
      { name: 'William J. Burns', mention_count: 15, is_primary: true },
      { name: 'Thorbjørn Jagland', mention_count: 10, is_primary: true },
      { name: 'Peter Thiel', mention_count: 10, is_primary: false },
      { name: 'Kathryn Ruemmler', mention_count: 8, is_primary: false },
      { name: 'Ehud Barak', mention_count: 5, is_primary: false },
      { name: 'Woody Allen', mention_count: 5, is_primary: false },
      { name: 'Bob Kerrey', mention_count: 4, is_primary: false },
      { name: 'Leon Black', mention_count: 3, is_primary: false },
      { name: 'Larry Summers', mention_count: 2, is_primary: false },
      { name: 'Lesley Groff', mention_count: 3, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02097661',
        description:
          'Epstein to Peter Thiel (Sept 10, 2014): "proposed schedule. 2 pm one on one you and I, 3-4 bill burns to join. i will need alone time with him after. 730 woody and kathy ruemmler for dinner." Compartmentalized time blocks revealing operational scheduling pattern.',
        page_reference: 'p. 1',
      },
      {
        number: 2,
        bates_number: 'EFTA02097678',
        description:
          'Groff schedule email (Sept 22, 2014): "People To See: Jagland, Terje, Thiel, Simon, Kathy, Cass, Woody, Jabor, Ehud, Leon, Stone, Maldives, Mada Kasak, India, Sommers, Boris, Barbro, Bill Burns." Master list of 16+ individuals.',
        page_reference: 'pp. 1-3',
      },
      {
        number: 3,
        bates_number: 'EFTA01922017',
        description:
          'Epstein to Thiel (May 21, 2014): "ehud, bill burns (dept sec of state), terje roed-larsen will all be at the house on jun 1." Burns identified by government title as social currency.',
        page_reference: 'p. 1',
      },
      {
        number: 4,
        bates_number: 'EFTA02095883',
        description:
          'Groff schedule (Sept 24, 2014): "5:00pm Appt w/Bill Burns." Second documented visit by sitting Deputy Secretary of State.',
        page_reference: 'p. 1',
      },
      {
        number: 5,
        bates_number: 'EFTA01968806',
        description:
          'Epstein to Terje Rød-Larsen: "I suggest you reach out to Bill Burns and tell him you are there if he needs help." Access brokering through diplomatic channels.',
        page_reference: 'p. 1',
      },
      {
        number: 6,
        bates_number: 'EFTA01970317',
        description:
          'Epstein to Terje: "I think John Kerry might be busy for awhile. they will turn to Bill Burns who will need more help. middle east syria egypt etc." Geopolitical intelligence analysis.',
        page_reference: 'p. 1',
      },
      {
        number: 7,
        bates_number: 'EFTA01615010',
        description:
          'Epstein to Steve Bannon (2018): "i suggest you meet bill burns. ask terje." Burns access brokered years after leaving government.',
        page_reference: 'p. 1',
      },
      {
        number: 8,
        bates_number: 'EFTA01899436',
        description:
          'Jagland to Epstein (March 2013): "Hi Jeff, they can stay in contact with my secretary Valerie Popp-Muess... Bill can come to my residence with his assistant if they want." Secretary General hosting Epstein at official Strasbourg residence.',
        page_reference: 'p. 1',
      },
      {
        number: 9,
        bates_number: 'EFTA01928716',
        description:
          'Epstein assistant to Ritz hotel: "Mr. Jagland had to cancel on Friday because he is involved with some negotiations with regards to the Ukraine and Mr. Putin. As such, we do not know when he will be able to use the rooms. Since Mr. Epstein paid for the rooms, can he get a credit..." Three rooms booked and paid by Epstein.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 10,
        bates_number: 'EFTA01899436',
        description:
          'Epstein to Jagland (March 2013): "i will land at 1230, i will send you the tail number of the plane, go to bills hotel, I am three, he is two." Private plane arrival at Secretary General residence in Strasbourg.',
        page_reference: 'p. 1',
      },
      {
        number: 11,
        bates_number: 'EFTA01927554',
        description:
          'Epstein email: "thorbjorn jagland will be on the island for the entire next week, come visit." Secretary General of Council of Europe on Epstein\'s private island.',
        page_reference: 'p. 1',
      },
      {
        number: 12,
        bates_number: 'EFTA01927644',
        description:
          'Jagland to Epstein (April 14, 2014): "Dear Jeffrey, it\'s unbelievable what you have done for me despite the fact that I could not come." Extraordinary gratitude for unspecified favors.',
        page_reference: 'p. 1',
      },
      {
        number: 13,
        bates_number: 'EFTA00016172',
        description:
          'SDNY prosecutors letter to Judge Berman (July 17, 2019): Austrian passport "contains numerous ingress and egress stamps, including stamps that reflect use of the passport to enter France, Spain, the United Kingdom, and Saudi Arabia in the 1980s."',
        page_reference: 'p. 1',
      },
      {
        number: 14,
        bates_number: 'EFTA00266155',
        description:
          'Wikipedia article preserved in corpus: concealed cameras throughout properties, CDs in safe labeled with young women\'s names, Epstein visited Israeli military bases April 2008.',
        page_reference: 'p. 2',
      },
      {
        number: 15,
        bates_number: 'EFTA01657240',
        description:
          'Congressional hearing (June 2024): FBI Director Christopher Wray refuses to confirm or deny whether FBI possesses Epstein\'s surveillance recordings.',
        page_reference: 'p. 1',
      },
    ],
  },
  {
    slug: 'the-intelligence-question',
    title: 'The Intelligence Question',
    deck: 'A U.S. Attorney said he was told Epstein "belonged to intelligence." An FBI document classified SECRET//NOFORN describes him as a "construct" running "an Israeli state-sponsored technology collection and extortion operation." An Austrian passport under a false name was found in his safe. Hidden cameras lined his properties. The FBI Director refuses to confirm whether recordings exist. And the future CIA Director had "alone time" in the house where it all happened.',
    section: 'the-cover-up' as const,
    file: 'the-intelligence-question.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 12,
    is_featured: false,
    case_file_slug: 'intelligence-diplomatic-network',
    published_at: '2026-03-17T18:00:00Z',
    hero_image_url: null,
    hero_image_caption: null,
    metadata: {
      source_analysis: 'Thread 16 (Intelligence Asset Question). 35 corpus source documents. Key: EFTA00030182 (Acosta "belonged to intelligence"), EFTA01683612 (FBI FD-1023 SECRET//NOFORN — "construct" / "Israeli state-sponsored technology collection and extortion operation"), EFTA00016172 (Austrian passport stamps), EFTA01656330 (FBI passport investigation), EFTA01689279 (victim hidden cameras), EFTA01657240 (Wray Glomar response), EFTA02507843 (Epstein forwards Maxwell/Mossad article), EFTA01748029 (Barak/Carbyne), EFTA00128843 (Nikolic DARPA FD-1023), EFTA02097661 (Burns "alone time")',
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 35, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 8, is_primary: false },
      { name: 'Les Wexner', mention_count: 3, is_primary: false },
      { name: 'Ehud Barak', mention_count: 5, is_primary: false },
      { name: 'William J. Burns', mention_count: 6, is_primary: false },
      { name: 'Boris Nikolic', mention_count: 4, is_primary: false },
      { name: 'Bill Gates', mention_count: 3, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00030182',
        description:
          'Internal SDNY email (July 10, 2019) forwarding Daily Beast article: Acosta told Trump transition team "I was told Epstein belonged to intelligence and to leave it alone" and that Epstein was "above his pay grade." The transition team hired him anyway.',
        page_reference: 'p. 1',
      },
      {
        number: 2,
        bates_number: 'EFTA01683612',
        description:
          'FBI FD-1023 (Confidential Human Source Reporting Document), classified SECRET//NOFORN. Filed Dec 23, 2021, FBI Los Angeles. Case: "(U) EPSTEIN, JEFFREY; CHILD SEX TRAFFICKING." Source describes Epstein as a "construct" running "an Israeli state-sponsored technology collection and extortion operation." Details Gates Foundation leadership (Desmond-Hellmann), Maxwell/Mossad connection, Wexner benefactor role, hidden recording infrastructure.',
        page_reference: 'pp. 1-3',
      },
      {
        number: 3,
        bates_number: 'EFTA01656330',
        description:
          'FBI internal emails re: Austrian passport investigation. Passport in name "MARIUS ROBERT FORTELNI" with Epstein photo, DOB 07/30/1954. Real Fortelni exists in FBI Sentinel/DIVS. Evidence item 1B76, 32 photos taken.',
        page_reference: 'pp. 1, 4',
      },
      {
        number: 4,
        bates_number: 'EFTA00016172',
        description:
          'SDNY prosecutors letter to Judge Berman (July 17, 2019): passport "contains numerous ingress and egress stamps, including stamps that reflect use of the passport to enter France, Spain, the United Kingdom, and Saudi Arabia in the 1980s." Signed by U.S. Attorney Geoffrey S. Berman.',
        page_reference: 'p. 1',
      },
      {
        number: 5,
        bates_number: 'EFTA01689279',
        description:
          'FBI 302 (witness interview report): victim stated she "felt like there were hidden cameras there."',
        page_reference: 'p. 1',
      },
      {
        number: 6,
        bates_number: 'EFTA00266155',
        description:
          'Wikipedia article preserved in corpus documenting: concealed cameras throughout properties, CDs in safe labeled with young women\'s names, Epstein visited Israeli military bases April 2008, considered fleeing to Israel.',
        page_reference: 'p. 2',
      },
      {
        number: 7,
        bates_number: 'EFTA01657240',
        description:
          'Congressional hearing (June 2024): FBI Director Christopher Wray refuses to confirm or deny whether FBI possesses Epstein\'s surveillance recordings. Glomar response.',
        page_reference: 'p. 1',
      },
      {
        number: 8,
        bates_number: 'EFTA01582934',
        description:
          'Reporting on Robert Maxwell death and Mossad ties. Six serving and former heads of Israeli intelligence attended his state funeral on the Mount of Olives in Jerusalem.',
        page_reference: 'p. 1',
      },
      {
        number: 9,
        bates_number: 'EFTA02507843',
        description:
          'Email forwarded by Epstein (March 15, 2018): "Robert Maxwell threatened Mossad. He told them that unless they gave him £400million to save his crumbling empire, he would expose all he had done for them." Details Maxwell\'s access to Thatcher, Reagan, Kremlin.',
        page_reference: 'p. 1',
      },
      {
        number: 10,
        bates_number: 'EFTA01748029',
        description:
          'Ehud Barak to Epstein email: "Reporty... Good conversation yesterday... I assume that by Monday evening we will be ripe for decision on the investment." Carbyne/Reporty emergency technology startup chaired by Barak, staffed by Unit 8200 alumni.',
        page_reference: 'p. 1',
      },
      {
        number: 11,
        bates_number: 'EFTA01950294',
        description:
          'Epstein forwards Unit 8200 article to Ehud Barak. Unit 8200 is Israel\'s signals intelligence unit (equivalent to NSA). Carbyne founding team included Unit 8200 alumni.',
        page_reference: 'p. 1',
      },
      {
        number: 12,
        bates_number: 'EFTA00128843',
        description:
          'FBI FD-1023 (UNCLASSIFIED), filed Nov 23, 2021, FBI San Francisco. Reports Boris Nikolic pursuing DARPA-funded AI company investments. Notes: "Nikolic was designated a executor of Jeffrey Epstein\'s estate."',
        page_reference: 'p. 1',
      },
      {
        number: 13,
        bates_number: 'EFTA02097661',
        description:
          'Epstein to Peter Thiel (Sept 10, 2014): Burns at Epstein\'s home with required "alone time." Burns later became CIA Director (March 2021).',
        page_reference: 'p. 1',
      },
      {
        number: 14,
        bates_number: 'EFTA00097901',
        description:
          'Internal SDNY memo documenting victim Maria Farmer\'s public statement: "He never in a trillion years would have taken his own life. He was an intelligence asset." Farmer reported Epstein to FBI in 1996.',
        page_reference: 'p. 1',
      },
      {
        number: 15,
        bates_number: 'EFTA01658887',
        description:
          'DOJ OIG report concluding Epstein "wasn\'t assisting the federal government in prosecuting Wall Street traders behind the collapse of investment bank Bear Stearns or serving as an intelligence asset." Conclusion appears to have been scope-limited.',
        page_reference: 'p. 29',
      },
    ],
  },
  // ─── Story 31: Fresh Meat (Hilton Head PROTECT SOURCE) ───────────────────────
  {
    slug: 'fresh-meat',
    title: 'Fresh Meat',
    deck: 'A thirteen-year-old girl answered a babysitting ad on a South Carolina island in the early 1980s. The man who called had no wife, no child, and no intention of paying her. Over the following years, Jeffrey Epstein drugged her systematically, photographed her, had her assaulted by associates, used the photographs to blackmail her mother into prison, and made her recruit other girls. She called the FBI four days after his arrest in 2019.',
    section: 'trump' as const,
    file: 'fresh-meat.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'trump-epstein-connection',
    published_at: new Date().toISOString(),
    hero_image_url: null,
    hero_image_caption: null,
    metadata: {
      source_documents: [
        'EFTA01245620 (FD-302 Interview #1, 07/24/2019)',
        'EFTA02858481 (FD-302 Interview #2, 08/07/2019)',
        'EFTA02858491 (FD-302 Interview #3, 08/20/2019)',
        'EFTA01245635 (EC 3501.045-013, FBI hotline origin, 07/19/2019)',
      ],
      case_number: '31E-NY-3027571',
      serials: ['216', '252', '264', '159'],
      protect_source: true,
    },
    entities: [
      { name: 'Jeffrey Epstein', mention_count: 38, is_primary: true },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01245620',
        description:
          'FD-302 Interview #1 (3501.045-001, 07/24/2019): Sea Pines Plantation babysitting ad, first encounter with Epstein, cocaine/alcohol/marijuana simultaneously, forced oral sex, Polaroid photographs in drawer, anal rape ("being nosy isn\'t good for you"), recruitment demand ("young fresh meat girls. Virgins."), "Don\'t bring me any niggers," group assault and "This is why fresh meat is good, you can do whatever you want."',
        page_reference: 'pp. 1-9',
      },
      {
        number: 2,
        bates_number: 'EFTA02858481',
        description:
          'FD-302 Interview #2 (3501.045-003, 08/07/2019): Polaroid photographs (tripod, breasts/face/full body), "probably given drugs on almost every interaction," Rick James concert in Savannah GA, Jim Atkins introduced (white male, gray hair, big ears, ~50s, Ohio university official), Atkins sexually assaulted victim multiple times, accountant "Cecil" (Black male) helps fix real estate books, blackmail of mother using explicit photographs, Epstein discloses childhood abuse by a boy in his family and possibly his aunt.',
        page_reference: 'pp. 1-10',
      },
      {
        number: 3,
        bates_number: 'EFTA02858491',
        description:
          'FD-302 Interview #3 (3501.045-005, 08/20/2019): Mother served approximately two years in federal prison in Columbia, SC (embezzlement conviction connected to Epstein/Atkins blackmail). Victim called Atkins at Ohio university: "I don\'t give a shit if you end up in the gutter. Don\'t ever contact me again. Your mother knows what will happen." Decades of threatening phone calls follow.',
        page_reference: 'pp. 1-4',
      },
      {
        number: 4,
        bates_number: 'EFTA01245635',
        description:
          'EC 3501.045-013 (07/19/2019): FBI hotline origin. Victim called July 10, 2019, four days after Epstein\'s July 6 arrest. "Occurred in the 1980s when the caller was approximately 13 to 15 years old and resided in the [island] area of South Carolina." Seattle FO assigned for in-person interview.',
        page_reference: 'pp. 1-2',
      },
    ],
  },

  // ─── Story 32: Let Me Teach You (Trump assault, NTOC pattern match) ──────────
  {
    slug: 'let-me-teach-you',
    title: 'Let Me Teach You',
    deck: 'An FBI Protect Source victim named Donald Trump as her assailant in three recorded interviews. A fourth session was dedicated solely to her account. She declined to proceed, asking \u201cwhat\u2019s the point?\u201d The FBI then catalogued 15+ additional complainants \u2014 and concluded it lacked predicate to investigate.',
    section: 'trump' as const,
    file: 'let-me-teach-you.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 8,
    is_featured: false,
    case_file_slug: 'trump-epstein-connection',
    published_at: new Date().toISOString(),
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/400px-Donald_Trump_official_portrait.jpg',
    hero_image_caption:
      'Donald Trump, official White House portrait. Trump is named by a Protect Source victim in three FBI interviews (2019), by a corroborating NTOC complainant (2025), and in a civil complaint by Katie Johnson (2016), dismissed after the plaintiff reported threats.',
    metadata: {
      source_docs: [
        'EFTA02858481',
        'EFTA02858491',
        'EFTA02858495',
        'EFTA01660651',
        'EFTA01655527',
      ],
    },
    entities: [
      { name: 'Donald Trump', mention_count: 28, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 12, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 2, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02858481',
        description:
          'FD-302 Interview #2, 3501.045-003 (08/07/2019) — Protect Source victim names Trump as assailant in NYC/NJ high-rise. "Introduced to someone with money, money... It was Donald Trump." Trump: "Let me teach you how little girls are supposed to be." Victim bites him. Trump: "get this little bitch the hell out of here." Blonde woman tip about bra. "Fresh meat," "untainted," "not jaded." Trump jealous of Epstein. Illegal building permits and casino money laundering. Two additional interactions victim declines to describe.',
        page_reference: 'pp. 7–8',
      },
      {
        number: 2,
        bates_number: 'EFTA02858491',
        description:
          'FD-302 Interview #3, 3501.045-005 (08/20/2019) — Trump "pulled [her] hair and punched [her] on the side of [her] head." Threatening calls over decades. "If it was not EPSTEIN, maybe it was the \'other one\'" — victim names Trump. Interstate 5 Oregon road incidents. "When he was running... more tracks to cover."',
        page_reference: 'pp. 1–3',
      },
      {
        number: 3,
        bates_number: 'EFTA02858495',
        description:
          'FD-302 Interview #4, 3501.045-007 (10/16/2019) — FBI schedules session dedicated to Trump allegations. Names Trump as "(current U.S. President) DONALD TRUMP." Victim asks "what\'s the point?" Cites statute of limitations. Declines to detail contacts. Interview ends.',
        page_reference: 'pp. 1–2',
      },
      {
        number: 4,
        bates_number: 'EFTA01660651',
        description:
          'FBI NTOC compilation (Aug 6–7, 2025) — Internal email cataloguing 15+ Trump complainants. Complainant 1: friend (age 13–14, NJ, ~35 years ago) forced oral sex on Trump, bit him, Trump hit her face — pattern match with 3501.045 victim. WFO dispatched to conduct interview.',
        page_reference: 'pp. 1–2',
      },
      {
        number: 5,
        bates_number: 'EFTA01655527',
        description:
          'FBI Daily News Briefing (Nov 17, 2025) — Reports July 2025 internal memo: "We did not uncover evidence that could predicate an investigation against uncharged third parties." Nov 2025: AG Bondi orders investigation of Epstein\'s ties to Trump\'s political opponents (Clinton, Summers, Hoffman).',
        page_reference: 'p. 3',
      },
    ],
  },
  // ─── Story 33: The Mar-a-Lago Connection (civil litigation evidence) ──────────
  {
    slug: 'the-mar-a-lago-connection',
    title: 'The Mar-a-Lago Connection',
    deck: 'Fourteen phone numbers. Message pads showing calls during the abuse period. A flight on Epstein\u2019s plane. A 15-year-old recruited from the spa. A sworn affidavit laying out seven grounds for deposition. The documented relationship between Donald Trump and Jeffrey Epstein, told entirely through civil litigation records.',
    section: 'trump' as const,
    file: 'the-mar-a-lago-connection.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 10,
    is_featured: false,
    case_file_slug: 'trump-epstein-connection',
    published_at: new Date().toISOString(),
    hero_image_url: null,
    hero_image_caption: null,
    metadata: {
      source_docs: [
        'EFTA01187465',
        'EFTA02803362',
        'EFTA01249325',
        'EFTA00105921',
        'EFTA00158636',
        'EFTA00208310',
        'EFTA01657683',
      ],
    },
    entities: [
      { name: 'Donald Trump', mention_count: 22, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 18, is_primary: true },
      { name: 'Ghislaine Maxwell', mention_count: 5, is_primary: false },
      { name: 'Virginia Giuffre', mention_count: 4, is_primary: false },
      { name: 'Brad Edwards', mention_count: 6, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA01187465',
        description:
          'Bradley Edwards Affidavit (April 2010) \u2014 7-point basis for deposing Trump: 14 phone numbers in Epstein\u2019s directory, message pads showing calls, plane flights, Mar-a-Lago ban, Jane Doe 102 recruitment, Palm Beach visits, "younger side" quote.',
        page_reference: 'pp. 6\u20138',
      },
      {
        number: 2,
        bates_number: 'EFTA02803362',
        description:
          'Florida Bulldog article + Edwards Affidavit exhibit. Trump on 2017 Palm Beach witness list. Scarola: Trump "had a relationship with Epstein that would have at least exposed them potentially to what was going on inside Epstein\u2019s Palm Beach home."',
        page_reference: 'pp. 1\u20134',
      },
      {
        number: 3,
        bates_number: 'EFTA01249325',
        description:
          'Mark Epstein deposition (Sept 21, 2009) pp.49-51. Trump flew on Epstein\u2019s smaller plane, FL to NY, late 1990s. "They were good friends."',
        page_reference: 'pp. 49\u201351',
      },
      {
        number: 4,
        bates_number: 'EFTA00105921',
        description:
          'Rodriguez affidavit p.3. Epstein\u2019s butler listed Trump among celebrities at Palm Beach home.',
        page_reference: 'p. 3',
      },
      {
        number: 5,
        bates_number: 'EFTA00158636',
        description:
          'FD-302: Separate victim (~20-22 years old) introduced to Trump by Epstein and Maxwell. "TRUMP was polite."',
        page_reference: 'p. 4',
      },
      {
        number: 6,
        bates_number: 'EFTA01657683',
        description:
          'Virginia Giuffre sworn telephone interview (April 7, 2011). Details of recruitment from Mar-a-Lago spa by Maxwell at age 15.',
        page_reference: 'pp. 2\u20133',
      },
      {
        number: 7,
        bates_number: 'EFTA00208310',
        description:
          'Palm Beach Daily News (March 1, 2011). Virginia Roberts (Giuffre) goes public. Lawsuit says Maxwell recruited her at The Mar-A-Lago Club where she worked as a changing room assistant.',
        page_reference: 'p. 1',
      },
    ],
  },
  // ─── Story 34: The Acosta Deal (NPA, appointment, intelligence claim) ─────────
  {
    slug: 'the-acosta-deal',
    title: 'The Acosta Deal',
    deck: "In 2017, Trump appointed the prosecutor who gave Epstein immunity — after that prosecutor told the transition team Epstein \"belonged to intelligence.\" In 2025, the same administration weaponized the files as opposition research while the FBI's own review found no predicate to investigate anyone.",
    section: 'trump' as const,
    file: 'the-acosta-deal.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 7,
    is_featured: false,
    case_file_slug: 'trump-epstein-connection',
    published_at: new Date().toISOString(),
    hero_image_url:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/400px-Donald_Trump_official_portrait.jpg',
    hero_image_caption:
      "Donald Trump, official White House portrait. Trump appointed Alexander Acosta — the prosecutor who negotiated Epstein's 2007 immunity agreement — as Secretary of Labor in 2017, after Acosta told the transition team Epstein \"belonged to intelligence.\"",
    metadata: {
      source_docs: [
        'EFTA00023059',
        'EFTA00030182',
        'EFTA01266434',
        'EFTA02590624',
        'EFTA00147443',
        'EFTA01655527',
      ],
    },
    entities: [
      { name: 'Donald Trump', mention_count: 12, is_primary: true },
      { name: 'Alexander Acosta', mention_count: 14, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 10, is_primary: true },
      { name: 'Kathryn Ruemmler', mention_count: 5, is_primary: false },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA00023059',
        description:
          "OPR report on the Epstein NPA — formal finding that Acosta \"agreed to several unusual and problematic terms in the NPA without the consideration required under the circumstances.\" Documents failure to notify victims as required by the Crime Victims' Rights Act.",
        page_reference: 'p. 11',
      },
      {
        number: 2,
        bates_number: 'EFTA00030182',
        description:
          "Internal SDNY email (July 10, 2019) forwarding Daily Beast article — Acosta told Trump transition team: \"I was told Epstein 'belonged to intelligence' and to leave it alone.\" Acosta described Epstein as \"above his pay grade.\" Transition team accepted this explanation and hired Acosta.",
        page_reference: 'Full document',
      },
      {
        number: 3,
        bates_number: 'EFTA01266434',
        description:
          'Epstein 2017 Trust — Section 7.1 names Kathryn Ruemmler as successor trustee: "In the event a Trustee resigns, is removed, becomes incapacitated or is unwilling or is unable to serve, KATHRYN RUEMMLER shall be appointed the successor trustee."',
        page_reference: 'p. 17, Section 7.1',
      },
      {
        number: 4,
        bates_number: 'EFTA02590624',
        description:
          "Email exchange between Epstein and Kathryn Ruemmler (Oct 14–15, 2014) — Epstein coaches Ruemmler on Attorney General nomination preparation: \"Let's hire a video coach. You need to be trained... No hand movement or head tilting or nodding. Blinking. You will need to get the right glasses. You have two months from today.\"",
        page_reference: 'Full document',
      },
      {
        number: 5,
        bates_number: 'EFTA00147443',
        description:
          "ECPAT-USA letter to White House calling for Acosta's resignation (July 9, 2019) — documents Epstein arrest on July 6, 2019, and that Acosta's deal \"allowed him to dodge federal charges.\" Acosta resigned July 19, 2019 — thirteen days after the arrest.",
        page_reference: 'Full document',
      },
      {
        number: 6,
        bates_number: 'EFTA01655527',
        description:
          "FBI Daily News Briefing (Nov 17, 2025) — Reports FBI internal memo from July 2025: \"We did not uncover evidence that could predicate an investigation against uncharged third parties.\" Also reports that AG Bondi, at Trump's urging, ordered Manhattan U.S. Attorney to investigate Epstein's ties to Clinton, Summers, and Reid Hoffman.",
        page_reference: 'p. 3',
      },
    ],
  },
  // ─── Story 35: Two More Interactions (Gaps in the Record) ──────────────────
  {
    slug: 'two-more-interactions',
    title: 'Two More Interactions',
    deck: 'On page eight of an FBI 302, after describing an assault by Donald Trump, a protected victim told agents she had two additional interactions with him — then asked to move on. Those interactions were never recorded. The agent interview notes that might have captured stray details are absent from the public corpus. The photographs are redacted. This is a story about what isn\'t in the file.',
    section: 'trump' as const,
    file: 'two-more-interactions.md',
    byline: 'EFTA Investigation Team',
    reading_time_minutes: 9,
    is_featured: false,
    case_file_slug: 'trump-epstein-connection',
    published_at: new Date().toISOString(),
    hero_image_url: null,
    hero_image_caption: null,
    metadata: {
      source_documents: [
        'EFTA02858481 (FD-302 Interview #2, 3501.045-003, 08/07/2019)',
        'EFTA01245620 (FD-302 Interview #1, 3501.045-001, 07/24/2019)',
        'EFTA02858495 (FD-302 Interview #4, 3501.045-007, 10/16/2019)',
        'EFTA02858491 (FD-302 Interview #3, 3501.045-005, 08/20/2019)',
        'EFTA01245635 (EC 3501.045-013, FBI Lead to Seattle, 07/19/2019)',
        'EFTA00095751 (Production manifest, 3501.045 series index)',
        'EFTA01245629-631 (Photograph stubs, fully redacted)',
        'EFTA01660651 (FBI NTOC compilation, Aug 2025)',
      ],
      case_number: '31E-NY-3027571',
      protect_source: true,
    },
    entities: [
      { name: 'Donald Trump', mention_count: 22, is_primary: true },
      { name: 'Jeffrey Epstein', mention_count: 14, is_primary: true },
    ],
    citations: [
      {
        number: 1,
        bates_number: 'EFTA02858481',
        description:
          'FD-302 Interview #2 (3501.045-003, 08/07/2019): Trump encounter — "Let me teach you how little girls are supposed to be." Forced oral sex, victim bit Trump, Trump struck her. "Get this little bitch the hell out of here." Blonde woman\'s bra remark. "II stated she had two additional interactions with TRUMP, but she asked that the interview move on to a different subject for the time being." Shared "fresh meat/untainted/not jaded" language. Blackmail and money laundering discussions overheard.',
        page_reference: 'pp. 7-8',
      },
      {
        number: 2,
        bates_number: 'EFTA01245620',
        description:
          'FD-302 Interview #1 (3501.045-001, 07/24/2019): Witness recognized Epstein in photograph sent by friend; cropped image to show only Epstein. Agents recognized uncropped original as "widely distributed photograph of JEFFREY EPSTEIN and current United States President DONALD TRUMP." Witness said the other person was "someone she had met."',
        page_reference: 'pp. 7-8',
      },
      {
        number: 3,
        bates_number: 'EFTA02858495',
        description:
          'FD-302 Interview #4 (3501.045-007, 10/16/2019): FBI scheduled dedicated session for Trump allegations. Victim attended but declined to proceed, citing statute of limitations: "What\'s the point?"',
        page_reference: 'pp. 1-2',
      },
      {
        number: 4,
        bates_number: 'EFTA02858491',
        description:
          'FD-302 Interview #3 (3501.045-005, 08/20/2019): Clarified Trump struck victim — "pulled her hair and punched her on the side of her head." Threatening calls: "Fuck you. You better keep your mouth closed." "When he was running... more tracks to cover." Under her breath: "if it was not EPSTEIN, maybe it was the \'other one\'... Trump." I-5 vehicular assault attempts.',
        page_reference: 'pp. 2-4',
      },
      {
        number: 5,
        bates_number: 'EFTA01245635',
        description:
          'EC 3501.045-013 (07/19/2019): FBI hotline intake — woman reported being victim of sexual exploitation by Epstein in the 1980s when approximately 13-15 years old, residing in the island area of South Carolina. New York office routed lead to Seattle Field Office.',
        page_reference: 'pp. 1-2',
      },
      {
        number: 6,
        bates_number: 'EFTA00095751',
        description:
          'Production manifest (witness index): Lists all 15 sub-documents in the 3501.045 series — 4 FD-302s, 3 sets of interview notes, 3 photographs, 2 intake reports, 1 electronic communication, 1 law enforcement report, 1 license record. Notes and photographs not accessible in corpus.',
        page_reference: 'p. 7',
      },
      {
        number: 7,
        bates_number: 'EFTA01245629',
        description:
          'Photograph stub (3501.045-008): Single-page cover sheet, fully redacted. One of three photographs submitted as part of the witness case file. No descriptive text accessible.',
        page_reference: 'p. 1',
      },
      {
        number: 8,
        bates_number: 'EFTA01660651',
        description:
          'FBI NTOC compilation (Aug 2025): 15+ complainants naming Trump in connection with sexual assault allegations. Complainant 1 matches 3501.045 victim pattern — friend (age 13-14, NJ), forced oral sex on Trump, bit him, Trump struck her face. WFO dispatched.',
        page_reference: 'Full document',
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
          is_published: !SEED_AS_DRAFT,
          is_featured: story.is_featured,
          published_at: SEED_AS_DRAFT ? null : story.published_at,
          case_file_id: caseFileId,
          hero_image_url: story.hero_image_url,
          hero_image_caption: story.hero_image_caption,
          editorial_status: SEED_AS_DRAFT ? 'review' : 'published',
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
