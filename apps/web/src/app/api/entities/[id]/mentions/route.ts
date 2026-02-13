import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

const CACHE_DAYS = 7

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch entity with metadata (check cache)
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id, name, metadata, entity_type, category, tier, is_public')
      .eq('id', id)
      .single()

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    // Check for cached summary
    const meta = (entity.metadata ?? {}) as Record<string, unknown>
    const cached = meta.mentions_summary as {
      text: string
      generated_at: string
      doc_count: number
      role_distribution: Record<string, number>
    } | undefined

    // Fetch current document count for staleness check
    const { count: docCount } = await supabase
      .from('entity_documents')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', id)

    const currentDocCount = docCount ?? 0

    if (cached) {
      const age = Date.now() - new Date(cached.generated_at).getTime()
      const maxAge = CACHE_DAYS * 24 * 60 * 60 * 1000
      // Return cache if fresh AND doc count hasn't changed
      if (age < maxAge && cached.doc_count === currentDocCount) {
        return NextResponse.json({ summary: cached, fromCache: true })
      }
    }

    // No useful cache — generate fresh summary
    if (currentDocCount === 0) {
      return NextResponse.json({ summary: null, reason: 'no_documents' })
    }

    // Fetch all entity_documents with document data
    const { data: entityDocs } = await supabase
      .from('entity_documents')
      .select('role_in_document, excerpt, page_number, document:documents(id, bates_number, title, document_type, original_date, severity)')
      .eq('entity_id', id)
      .order('created_at', { ascending: true })

    if (!entityDocs || entityDocs.length === 0) {
      return NextResponse.json({ summary: null, reason: 'no_documents' })
    }

    // Build role distribution
    const roleDistribution: Record<string, number> = {}
    for (const ed of entityDocs) {
      const role = ed.role_in_document ?? 'unknown'
      roleDistribution[role] = (roleDistribution[role] ?? 0) + 1
    }

    // Prepare excerpts for Claude (limit to 30 to avoid token overload)
    const excerptEntries = entityDocs
      .filter((ed) => ed.excerpt)
      .slice(0, 30)
      .map((ed) => {
        const doc = ed.document as unknown as { bates_number: string | null; title: string | null; document_type: string | null; original_date: string | null } | null
        return `[${doc?.bates_number ?? 'Unknown'}] (${ed.role_in_document ?? 'mentioned'}) "${ed.excerpt}" — ${doc?.title ?? doc?.document_type ?? 'Document'}, ${doc?.original_date ?? 'undated'}`
      })

    // Respect victim privacy
    const isVictim = entity.category === 'victim'
    const isPublic = entity.is_public === true

    if (isVictim && !isPublic) {
      const protectedSummary = {
        text: 'This individual is identified as a victim. Their mentions across documents are protected for privacy.',
        generated_at: new Date().toISOString(),
        doc_count: currentDocCount,
        role_distribution: roleDistribution,
      }
      return NextResponse.json({ summary: protectedSummary, fromCache: false })
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() })

    const prompt = `You are an intelligence analyst summarizing how a person or entity appears across investigation documents.

Entity: ${entity.name}
Type: ${entity.entity_type ?? 'unknown'}
Category: ${entity.category ?? 'unknown'}
Tier: ${entity.tier ?? 'unknown'}

This entity appears in ${currentDocCount} document(s) with these roles:
${Object.entries(roleDistribution).map(([role, count]) => `- ${role}: ${count}`).join('\n')}

${excerptEntries.length > 0 ? `Key excerpts from documents:\n${excerptEntries.join('\n\n')}` : 'No excerpts available.'}

Write a concise summary (2-4 sentences) of how this entity appears across the investigation documents. Focus on:
- Their primary role (subject of investigation, mentioned in passing, witness, author of correspondence, etc.)
- Key themes or patterns in how they're referenced
- Any notable quotes or contexts

Be factual and cite specific documents (by Bates number) where relevant. Do not speculate beyond what the excerpts show. Write in third person, past tense where appropriate. Keep it under 150 words.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Cache in entity metadata
    const summaryData = {
      text,
      generated_at: new Date().toISOString(),
      doc_count: currentDocCount,
      role_distribution: roleDistribution,
    }

    await supabase
      .from('entities')
      .update({
        metadata: { ...meta, mentions_summary: summaryData },
      })
      .eq('id', id)

    return NextResponse.json({ summary: summaryData, fromCache: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
