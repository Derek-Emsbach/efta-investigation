import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type {
  Story,
  StoryEntity,
  StoryCitation,
  Entity,
  Document,
} from '@efta/shared'
import { StoryHero } from '@/components/publication/story/story-hero'
import { StorySidebar } from '@/components/publication/story/story-sidebar'
import { ReadingProgress } from '@/components/publication/story/reading-progress'
import { renderMarkdown } from '@/lib/markdown-renderer'

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
  const { data: story } = await supabase
    .from('stories')
    .select('title, deck, byline')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!story) {
    return { title: 'Story Not Found — The Epstein Record' }
  }

  return {
    title: `${story.title} — The Epstein Record`,
    description: story.deck ?? `${story.title} by ${story.byline}`,
  }
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: story, error } = await supabase
    .from('stories')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !story) {
    notFound()
  }

  const typedStory = story as Story

  // Fetch relations in parallel
  const [entitiesResult, citationsResult, caseFileResult] = await Promise.all([
    supabase
      .from('story_entities')
      .select('*, entity:entities(id, name, slug, tier, category, profile_published)')
      .eq('story_id', typedStory.id),

    supabase
      .from('story_citations')
      .select('*, document:documents(id, bates_number, title, document_type)')
      .eq('story_id', typedStory.id)
      .order('citation_number', { ascending: true }),

    typedStory.case_file_id
      ? supabase
          .from('case_files')
          .select('id, slug, case_id, title, status')
          .eq('id', typedStory.case_file_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const entities = (entitiesResult.data ?? []) as (StoryEntity & { entity: Entity })[]
  const citations = (citationsResult.data ?? []) as (StoryCitation & { document: Document | null })[]

  // Build render context for the markdown renderer
  const renderContext = {
    citations: citations.map((c) => ({
      citation_number: c.citation_number,
      description: c.description,
      bates_number: c.bates_number,
      document: c.document ? { bates_number: c.document.bates_number, title: c.document.title } : null,
    })),
    entities: entities
      .filter((se) => se.entity?.slug)
      .map((se) => ({
        slug: se.entity.slug!,
        name: se.entity.name,
        tier: se.entity.tier,
      })),
  }

  const bodyNodes = renderMarkdown(typedStory.body_markdown, renderContext)

  return (
    <>
      <ReadingProgress />

      <article className="mx-auto max-w-5xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="mb-8 font-mono text-xs text-text-muted">
          <a href="/" className="hover:text-text-secondary transition-colors">
            Home
          </a>
          <span className="mx-2">/</span>
          <a href="/stories" className="hover:text-text-secondary transition-colors">
            Stories
          </a>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">{typedStory.title}</span>
        </nav>

        {/* 2-column: article + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12">
          {/* Article */}
          <div>
            <StoryHero story={typedStory} citationCount={citations.length} />

            {/* Body */}
            <div className="story-body">
              {bodyNodes}
            </div>

            {/* Methodology note */}
            <div className="mt-12 pt-6 border-t border-border-default">
              <div className="font-body text-[11px] text-text-muted leading-relaxed">
                <p>
                  This article is based on documents released under the Epstein Files
                  Transparency Act (EFTA). All claims are sourced to specific EFTA documents
                  identified by Bates number. Entity tier classifications reflect evidence
                  strength, not legal determinations.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <StorySidebar
            entities={entities}
            citations={citations}
            caseFile={caseFileResult.data as { slug: string; case_id: string; title: string } | null}
          />
        </div>
      </article>
    </>
  )
}
