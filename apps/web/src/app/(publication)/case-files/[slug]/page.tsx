import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type {
  CaseFile,
  CaseFileEntity,
  Entity,
  OpenQuestion,
} from '@efta/shared'
import { CaseFileCover } from '@/components/publication/case-file/case-file-cover'
import { FindingsMarkdown } from '@/components/publication/case-file/findings-markdown'
import { EntityRoster } from '@/components/publication/case-file/entity-roster'
import { OpenQuestions } from '@/components/publication/case-file/open-questions'
import { ReportSidebar } from '@/components/publication/case-file/report-sidebar'
import { PrintButton } from '@/components/ui/print-button'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { data: cf } = await supabase
    .from('case_files')
    .select('case_id, title, summary')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!cf) {
    return { title: 'Case File Not Found — The Epstein Crimes' }
  }

  const description = cf.summary?.slice(0, 160) ?? `Investigation report ${cf.case_id}`

  return {
    title: `${cf.case_id}: ${cf.title} — The Epstein Crimes`,
    description,
    openGraph: {
      title: `${cf.case_id}: ${cf.title}`,
      description,
      type: 'article',
      siteName: 'The Epstein Crimes',
      images: [`/api/og?title=${encodeURIComponent(cf.title)}&subtitle=${encodeURIComponent(cf.case_id)}&type=case-file`],
    },
    twitter: {
      card: 'summary',
      title: `${cf.case_id}: ${cf.title}`,
      description,
    },
  }
}

export default async function CaseFilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: caseFile, error } = await supabase
    .from('case_files')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !caseFile) {
    notFound()
  }

  const typedCaseFile = caseFile as CaseFile

  // Fetch relations in parallel
  const [entitiesResult, questionsResult] = await Promise.all([
    supabase
      .from('case_file_entities')
      .select('*, entity:entities(id, name, slug, tier, entity_type, category, profile_published)')
      .eq('case_file_id', typedCaseFile.id),

    supabase
      .from('open_questions')
      .select('*')
      .eq('case_file_id', typedCaseFile.id)
      .order('priority', { ascending: true }),
  ])

  const entities = (entitiesResult.data ?? []) as (CaseFileEntity & { entity: Entity })[]
  const questions = (questionsResult.data ?? []) as OpenQuestion[]

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      {/* Breadcrumb + print */}
      <div className="mb-6 flex items-center justify-between">
        <nav className="font-mono text-xs text-text-muted">
          <a href="/" className="hover:text-text-secondary transition-colors">
            Home
          </a>
          <span className="mx-2">/</span>
          <a href="/case-files" className="hover:text-text-secondary transition-colors">
            Case Files
          </a>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{typedCaseFile.case_id}</span>
        </nav>
        <PrintButton />
      </div>

      {/* Cover */}
      <CaseFileCover caseFile={typedCaseFile} />

      {/* Report body: main + sidebar */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
        {/* Main content */}
        <div className="space-y-12">
          {/* Findings */}
          <div id="findings">
            <FindingsMarkdown
              markdown={typedCaseFile.findings_markdown}
              entities={entities
                .filter((e) => e.entity?.slug && e.entity?.profile_published)
                .map((e) => ({
                  slug: e.entity.slug!,
                  name: e.entity.name,
                  tier: e.entity.tier,
                }))}
            />
          </div>

          {/* Entity roster */}
          <div id="entities">
            <EntityRoster entities={entities} />
          </div>

          {/* Open questions */}
          <div id="questions">
            <OpenQuestions questions={questions} />
          </div>

          {/* Methodology notes */}
          {typedCaseFile.methodology_notes && (
            <section id="methodology">
              <h2 className="font-display text-2xl font-bold text-text-primary pb-3 mb-6 border-b-2 border-text-primary">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted block mb-1">
                  Section 06
                </span>
                Methodology
              </h2>
              <div className="font-body text-sm leading-relaxed text-text-secondary whitespace-pre-line">
                {typedCaseFile.methodology_notes}
              </div>
            </section>
          )}

          {/* Report footer */}
          <div className="border-t-2 border-text-primary pt-6 mt-12">
            <div className="font-body text-[11px] text-text-muted leading-relaxed">
              <p>
                This investigation report is part of the EFTA Investigation — a systematic
                analysis of documents released under the Epstein Files Transparency Act.
                All findings are evidence-based and sourced to specific EFTA documents.
              </p>
              <p className="mt-2">
                Entity tier classifications reflect evidence strength, not guilt.
                See methodology notes for analytical framework and limitations.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-16 lg:self-start order-first lg:order-last">
          <ReportSidebar
            caseFile={typedCaseFile}
            entities={entities}
            questionCount={questions.length}
          />
        </aside>
      </div>
    </div>
  )
}
