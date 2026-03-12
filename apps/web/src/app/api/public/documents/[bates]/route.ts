import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

// Use service role to bypass RLS (public endpoint, reads only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bates: string }> }
) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { bates } = await params

    // 1. Fetch document by bates_number
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*, dataset:datasets(id, name, number)')
      .eq('bates_number', bates)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 2. Fetch all relations in parallel
    const [
      entitiesResult,
      eventsResult,
      imagesResult,
      citationsResult,
      redactionsResult,
    ] = await Promise.all([
      // Entities linked to this document
      supabase
        .from('entity_documents')
        .select('role_in_document, excerpt, page_number, entity:entities(id, name, slug, tier, category, profile_published)')
        .eq('document_id', doc.id),

      // Events referencing this document
      supabase
        .from('event_documents')
        .select('event:events(id, date, title, event_type, significance)')
        .eq('document_id', doc.id),

      // Extracted images
      supabase
        .from('document_images')
        .select('id, page_number, image_type, tags, caption, is_redacted')
        .eq('document_id', doc.id)
        .order('page_number', { ascending: true }),

      // Story citations that reference this document
      supabase
        .from('story_citations')
        .select('citation_number, description, page_reference, story:stories(slug, title, section, is_published)')
        .eq('document_id', doc.id),

      // Redactions for summary
      supabase
        .from('redactions')
        .select('category, suspect_flag')
        .eq('document_id', doc.id),
    ])

    // Filter entities to published only
    const entities = (entitiesResult.data ?? [])
      .filter((ed: Record<string, unknown>) => {
        const entity = ed.entity as Record<string, unknown> | null
        return entity?.profile_published === true
      })
      .map((ed: Record<string, unknown>) => {
        const entity = ed.entity as Record<string, unknown>
        return {
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          tier: entity.tier,
          category: entity.category,
          role_in_document: ed.role_in_document,
          excerpt: ed.excerpt,
          page_number: ed.page_number,
        }
      })

    // Sort events by date
    const events = (eventsResult.data ?? [])
      .map((ed: Record<string, unknown>) => ed.event as Record<string, unknown>)
      .filter(Boolean)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((a.date as string) ?? '').localeCompare((b.date as string) ?? '')
      )

    // Filter citations to published stories only
    const storyCitations = (citationsResult.data ?? [])
      .filter((sc: Record<string, unknown>) => {
        const story = sc.story as Record<string, unknown> | null
        return story?.is_published === true
      })
      .map((sc: Record<string, unknown>) => {
        const story = sc.story as Record<string, unknown>
        return {
          citation_number: sc.citation_number,
          description: sc.description,
          page_reference: sc.page_reference,
          story: { slug: story.slug, title: story.title, section: story.section },
        }
      })

    // Aggregate redactions into summary
    const redactions = redactionsResult.data ?? []
    const byCategory: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
    let suspectCount = 0
    for (const r of redactions) {
      const cat = (r as Record<string, unknown>).category as string
      if (cat && cat in byCategory) byCategory[cat]++
      if ((r as Record<string, unknown>).suspect_flag) suspectCount++
    }

    // Build document response (exclude extracted_text and file_url)
    const document = {
      id: doc.id,
      bates_number: doc.bates_number,
      title: doc.title,
      document_type: doc.document_type,
      original_date: doc.original_date,
      page_count: doc.page_count,
      file_size_bytes: doc.file_size_bytes,
      summary: doc.summary,
      classification: doc.classification,
      severity: doc.severity,
      processing_status: doc.processing_status,
      flags: doc.flags,
      forensic_metadata: doc.forensic_metadata,
      text_excerpt: doc.extracted_text?.slice(0, 2000) ?? null,
      has_file: !!doc.file_url,
      dataset: doc.dataset,
    }

    return NextResponse.json({
      document,
      entities,
      events,
      images: imagesResult.data ?? [],
      storyCitations,
      redactionSummary: {
        total: redactions.length,
        byCategory,
        suspectCount,
      },
    }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
