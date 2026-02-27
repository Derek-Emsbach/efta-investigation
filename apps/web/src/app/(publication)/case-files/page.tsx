import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Case Files — The Epstein Record',
  description:
    'Investigation reports compiled from systematic analysis of EFTA document releases.',
  openGraph: {
    title: 'Case Files — The Epstein Record',
    description:
      'Investigation reports compiled from analysis of EFTA documents.',
    type: 'website',
    siteName: 'The Epstein Record',
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-accent-red/10 text-accent-red border-accent-red/30',
  complete: 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/30',
  archived: 'bg-text-muted/10 text-text-muted border-text-muted/30',
}

export default async function CaseFilesPage() {
  const { data: caseFiles } = await supabase
    .from('case_files')
    .select(
      'id, slug, case_id, title, status, summary, completion_percentage, published_at',
    )
    .eq('is_published', true)
    .order('case_id', { ascending: true })

  const allCaseFiles = caseFiles ?? []

  // Group by status
  const active = allCaseFiles.filter((cf) => cf.status === 'active')
  const complete = allCaseFiles.filter((cf) => cf.status === 'complete')
  const archived = allCaseFiles.filter((cf) => cf.status === 'archived')

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 font-mono text-xs text-text-muted">
        <a href="/" className="hover:text-text-secondary transition-colors">
          Home
        </a>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Case Files</span>
      </nav>

      <header className="mb-10">
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary">
          Investigation Reports
        </h1>
        <p className="mt-3 font-body text-lg text-text-secondary max-w-2xl">
          Systematic investigation reports compiled from EFTA document analysis.
          Each report traces a specific thread through the evidence.
        </p>
        <div className="mt-4 h-[3px] w-16 bg-accent-red" />
      </header>

      {allCaseFiles.length === 0 ? (
        <p className="font-body text-text-secondary">
          Investigation reports are being compiled. Check back soon.
        </p>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <CaseFileGroup
              label="Active Investigations"
              caseFiles={active}
            />
          )}
          {complete.length > 0 && (
            <CaseFileGroup
              label="Completed"
              caseFiles={complete}
            />
          )}
          {archived.length > 0 && (
            <CaseFileGroup
              label="Archived"
              caseFiles={archived}
            />
          )}
        </div>
      )}
    </div>
  )
}

function CaseFileGroup({
  label,
  caseFiles,
}: {
  label: string
  caseFiles: {
    id: string
    slug: string
    case_id: string
    title: string
    status: string
    summary: string | null
    completion_percentage: number
    published_at: string | null
  }[]
}) {
  return (
    <section>
      <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-text-primary mb-4">
        {label}
        <span className="ml-2 text-text-muted font-normal">
          ({caseFiles.length})
        </span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {caseFiles.map((cf) => (
          <Link
            key={cf.id}
            href={`/case-files/${cf.slug}`}
            className="block border border-border-default p-5 hover:border-accent-gold/40 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-accent-red">
                {cf.case_id}
              </span>
              <span
                className={`font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 border ${
                  STATUS_STYLES[cf.status] ?? ''
                }`}
              >
                {cf.status}
              </span>
            </div>
            <h3 className="font-display text-base font-semibold text-text-primary leading-snug group-hover:text-accent-gold transition-colors">
              {cf.title}
            </h3>
            {cf.summary && (
              <p className="mt-2 font-body text-xs text-text-secondary line-clamp-3">
                {cf.summary}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              {cf.completion_percentage > 0 && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-1 bg-border-default">
                    <div
                      className="h-full bg-accent-gold"
                      style={{ width: `${cf.completion_percentage}%` }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-text-muted">
                    {cf.completion_percentage}%
                  </span>
                </div>
              )}
              {cf.published_at && (
                <span className="font-mono text-[9px] text-text-muted ml-3">
                  {new Date(cf.published_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
