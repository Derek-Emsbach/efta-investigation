import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import type {
  Story,
  StorySection,
  StoryEntity,
  StoryCitation,
  Entity,
  Document,
} from '@efta/shared'
import { StoryHero } from '@/components/publication/story/story-hero'
import { StorySidebar } from '@/components/publication/story/story-sidebar'
import { ReadingProgress } from '@/components/publication/story/reading-progress'
import { ArticleJsonLd } from '@/components/publication/json-ld'
import { renderMarkdown } from '@/lib/markdown-renderer'
import { PrintButton } from '@/components/ui/print-button'
import { CyclopsPromo } from '@/components/publication/promo/cyclops-promo'
import { SourceAttributionBar } from '@/components/publication/promo/source-attribution-bar'
import { SourceAdSlot } from '@/components/publication/promo/source-ad-slot'
import { RelatedStories } from '@/components/publication/story/related-stories'
import { ShareButtons } from '@/components/publication/story/share-buttons'
import { CommentSection } from '@/components/publication/comments/comment-section'

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
    return { title: 'Story Not Found — The Epstein Crimes' }
  }

  const description = story.deck ?? `${story.title} by ${story.byline}`

  return {
    title: `${story.title} — The Epstein Crimes`,
    description,
    openGraph: {
      title: story.title,
      description,
      type: 'article',
      siteName: 'The Epstein Crimes',
      images: [`/api/og?title=${encodeURIComponent(story.title)}&type=story`],
    },
    twitter: {
      card: 'summary_large_image',
      title: story.title,
      description,
    },
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

  // Find related stories: prioritize shared entities, fall back to same section
  type RelatedStoryRow = {
    slug: string
    title: string
    deck: string | null
    section: StorySection | null
    published_at: string | null
    hero_image_url: string | null
    reading_time_minutes: number | null
    is_published?: boolean
    shared_entity_count?: number
  }

  const entityIds = entities.map((e) => e.entity_id)
  const relatedByEntity = entityIds.length > 0
    ? await supabase
        .from('story_entities')
        .select('story_id, story:stories(slug, title, deck, section, published_at, hero_image_url, reading_time_minutes, is_published)')
        .in('entity_id', entityIds)
        .neq('story_id', typedStory.id)
    : { data: [] }

  // Deduplicate and rank by shared entity count
  const storyScores = new Map<string, { story: RelatedStoryRow; count: number }>()
  for (const row of relatedByEntity.data ?? []) {
    const s = row.story as unknown as RelatedStoryRow | null
    if (!s || !s.is_published) continue
    const existing = storyScores.get(s.slug)
    if (existing) {
      existing.count++
    } else {
      storyScores.set(s.slug, { story: s, count: 1 })
    }
  }

  const relatedStories: RelatedStoryRow[] = [...storyScores.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([, v]) => ({ ...v.story, shared_entity_count: v.count }))

  // If fewer than 3, backfill with same-section stories
  if (relatedStories.length < 3 && typedStory.section) {
    const existingSlugs = new Set(relatedStories.map((s) => s.slug))
    existingSlugs.add(slug)
    const { data: sectionStories } = await supabase
      .from('stories')
      .select('slug, title, deck, section, published_at, hero_image_url, reading_time_minutes')
      .eq('section', typedStory.section)
      .eq('is_published', true)
      .neq('slug', slug)
      .order('published_at', { ascending: false })
      .limit(3)
    for (const s of (sectionStories ?? []) as RelatedStoryRow[]) {
      if (relatedStories.length >= 3) break
      if (!existingSlugs.has(s.slug)) {
        relatedStories.push({ ...s, shared_entity_count: 0 })
        existingSlugs.add(s.slug)
      }
    }
  }

  // Final backfill: any recent stories
  if (relatedStories.length < 3) {
    const existingSlugs = new Set(relatedStories.map((s) => s.slug))
    existingSlugs.add(slug)
    const { data: recentStories } = await supabase
      .from('stories')
      .select('slug, title, deck, section, published_at, hero_image_url, reading_time_minutes')
      .eq('is_published', true)
      .neq('slug', slug)
      .order('published_at', { ascending: false })
      .limit(6)
    for (const s of (recentStories ?? []) as RelatedStoryRow[]) {
      if (relatedStories.length >= 3) break
      if (!existingSlugs.has(s.slug)) {
        relatedStories.push({ ...s, shared_entity_count: 0 })
        existingSlugs.add(s.slug)
      }
    }
  }

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
    autoLink: true,
  }

  const bodyNodes = renderMarkdown(typedStory.body_markdown, renderContext)

  return (
    <>
      <ArticleJsonLd
        title={typedStory.title}
        description={typedStory.deck ?? ''}
        datePublished={typedStory.published_at ?? undefined}
        authorName={typedStory.byline ?? undefined}
        section={typedStory.section ?? undefined}
        slug={slug}
      />
      <ReadingProgress />

      <article className="mx-auto max-w-7xl px-6 py-10">
        {/* Breadcrumb + print */}
        <div className="mb-8 flex items-center justify-between">
          <nav className="font-mono text-xs text-text-muted">
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
          <PrintButton />
        </div>

        {/* 2-column: article + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12">
          {/* Article */}
          <div>
            {typedStory.hero_image_url && (
              <div className="mb-6">
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <Image
                    src={typedStory.hero_image_url}
                    alt={typedStory.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 700px"
                    className="object-cover"
                    priority
                    unoptimized={!typedStory.hero_image_url.includes('wikimedia.org')}
                  />
                </div>
                {typedStory.hero_image_caption && (
                  <p className="font-sans text-xs text-text-muted mt-2 pt-2 border-t border-border-default">
                    {typedStory.hero_image_caption}
                  </p>
                )}
              </div>
            )}

            <StoryHero story={typedStory} citationCount={citations.length} />

            {/* Share bar */}
            <div className="mb-8 -mt-4">
              <ShareButtons title={typedStory.title} slug={slug} />
            </div>

            {/* Body */}
            <div className="story-body">
              {bodyNodes}
            </div>

            {/* Cyclops Digital promo */}
            <div className="mt-10">
              <CyclopsPromo variant="inline" />
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
                <p className="mt-2">
                  Research and initial drafting assisted by Claude AI (Anthropic). All articles
                  are reviewed, fact-checked, and edited by Derek Emsbach.
                </p>
              </div>
            </div>

            {/* Related stories */}
            <RelatedStories stories={relatedStories} />

            {/* Source attribution */}
            <SourceAttributionBar />

            {/* Comments */}
            <CommentSection
              contentType="story"
              contentId={typedStory.id}
              currentPath={`/stories/${slug}`}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <StorySidebar
              entities={entities}
              citations={citations}
              caseFile={caseFileResult.data as { slug: string; case_id: string; title: string } | null}
            />
            <SourceAdSlot variant="sidebar" seed={`story-${slug}`} />
          </div>
        </div>
      </article>
    </>
  )
}
