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
