import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  RELATIONSHIP_TYPES,
  EVIDENCE_STRENGTHS,
  EVIDENCE_TYPES,
  EVIDENCE_CATEGORIES,
  EVIDENCE_ITEM_STRENGTHS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_PRIORITIES,
  ENTITY_TYPES,
  ENTITY_CATEGORIES,
  ENTITY_STATUSES,
  EVENT_TYPES,
} from '@/lib/ai/tools'

interface ApplyRequest {
  type: 'connection' | 'tier_change' | 'evidence' | 'platform' | 'new_entity' | 'event' | 'entity_document_link'
  data: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: ApplyRequest = await request.json()

  if (!body.type || !body.data) {
    return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
  }

  try {
    switch (body.type) {
      case 'connection':
        return await applyConnection(body.data, supabase)
      case 'tier_change':
        return await applyTierChange(body.data, supabase)
      case 'evidence':
        return await applyEvidenceItem(body.data, supabase)
      case 'platform':
        return await applyPlatformSuggestion(body.data, supabase)
      case 'new_entity':
        return await applyNewEntity(body.data, supabase)
      case 'event':
        return await applyEvent(body.data, supabase)
      case 'entity_document_link':
        return await applyEntityDocumentLink(body.data, supabase)
      default:
        return NextResponse.json({ error: `Unknown suggestion type: ${body.type}` }, { status: 400 })
    }
  } catch (error) {
    // Postgres unique violation
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'This record already exists (duplicate)' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to apply suggestion'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function applyConnection(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { entity_a_id, entity_b_id, relationship_type, evidence_strength, description } = data as {
    entity_a_id: string
    entity_b_id: string
    relationship_type: string
    evidence_strength: string
    description: string
  }

  if (!entity_a_id || !entity_b_id || !relationship_type || !evidence_strength || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!RELATIONSHIP_TYPES.has(relationship_type)) {
    return NextResponse.json({ error: `Invalid relationship_type: ${relationship_type}` }, { status: 400 })
  }
  if (!EVIDENCE_STRENGTHS.has(evidence_strength)) {
    return NextResponse.json({ error: `Invalid evidence_strength: ${evidence_strength}` }, { status: 400 })
  }

  // Re-check no duplicate (race condition guard)
  const { data: existing } = await supabase
    .from('entity_connections')
    .select('id')
    .or(
      `and(entity_a.eq.${entity_a_id},entity_b.eq.${entity_b_id}),and(entity_a.eq.${entity_b_id},entity_b.eq.${entity_a_id})`,
    )
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Connection already exists' }, { status: 409 })
  }

  const { error } = await supabase.from('entity_connections').insert({
    entity_a: entity_a_id,
    entity_b: entity_b_id,
    relationship_type,
    evidence_strength,
    description,
  })

  if (error) throw error
  return NextResponse.json({ success: true, message: 'Connection created' })
}

async function applyTierChange(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { entity_id, new_tier, justification } = data as {
    entity_id: string
    new_tier: number
    justification: string
  }

  if (!entity_id || !new_tier || !justification) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!Number.isInteger(new_tier) || new_tier < 1 || new_tier > 6) {
    return NextResponse.json({ error: `Invalid tier: ${new_tier}` }, { status: 400 })
  }

  // Verify entity exists
  const { data: entity } = await supabase
    .from('entities')
    .select('id')
    .eq('id', entity_id)
    .single()

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('entities')
    .update({ tier: new_tier, tier_justification: justification })
    .eq('id', entity_id)

  if (error) throw error
  return NextResponse.json({ success: true, message: `Tier updated to ${new_tier}` })
}

async function applyEvidenceItem(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { entity_id, document_id, evidence_type, description, category, strength, date } =
    data as {
      entity_id: string
      document_id: string | null
      evidence_type: string
      description: string
      category: string
      strength: string
      date: string | null
    }

  if (!entity_id || !evidence_type || !description || !category || !strength) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!EVIDENCE_TYPES.has(evidence_type)) {
    return NextResponse.json({ error: `Invalid evidence_type: ${evidence_type}` }, { status: 400 })
  }
  if (!EVIDENCE_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 })
  }
  if (!EVIDENCE_ITEM_STRENGTHS.has(strength)) {
    return NextResponse.json({ error: `Invalid strength: ${strength}` }, { status: 400 })
  }

  // Verify entity exists
  const { data: entity } = await supabase
    .from('entities')
    .select('id')
    .eq('id', entity_id)
    .single()
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }

  // Verify document if referenced
  if (document_id) {
    const { data: doc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', document_id)
      .single()
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
  }

  const { error } = await supabase.from('evidence_items').insert({
    entity_id,
    document_id: document_id ?? null,
    evidence_type,
    description,
    category,
    strength,
    date: date ?? null,
  })

  if (error) throw error
  return NextResponse.json({ success: true, message: 'Evidence item created' })
}

async function applyPlatformSuggestion(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { category, title, description, rationale, priority } = data as {
    category: string
    title: string
    description: string
    rationale: string
    priority: string
  }

  if (!category || !title || !description || !rationale || !priority) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!SUGGESTION_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 })
  }
  if (!SUGGESTION_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: `Invalid priority: ${priority}` }, { status: 400 })
  }

  const { error } = await supabase.from('platform_suggestions').insert({
    category,
    title,
    description,
    rationale,
    priority,
    status: 'proposed',
  })

  if (error) throw error
  return NextResponse.json({ success: true, message: 'Suggestion saved to backlog' })
}

async function applyNewEntity(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    name, entity_type, tier, category, bio, status, aliases,
    document_id, role_in_document,
  } = data as {
    name: string
    entity_type: string
    tier: number
    category: string
    bio: string | null
    status: string
    aliases: string[]
    document_id: string | null
    role_in_document: string | null
  }

  if (!name || !entity_type || !tier || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!ENTITY_TYPES.has(entity_type)) {
    return NextResponse.json({ error: `Invalid entity_type: ${entity_type}` }, { status: 400 })
  }
  if (!ENTITY_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 })
  }
  if (!Number.isInteger(tier) || tier < 1 || tier > 6) {
    return NextResponse.json({ error: `Invalid tier: ${tier}` }, { status: 400 })
  }
  if (status && !ENTITY_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
  }

  // Create the entity
  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .insert({
      name,
      entity_type,
      tier,
      category,
      bio: bio ?? null,
      status: status ?? 'identified',
      aliases: aliases ?? [],
    })
    .select('id')
    .single()

  if (entityError) throw entityError

  // Link to source document if provided
  if (document_id && entity) {
    await supabase.from('entity_documents').insert({
      entity_id: entity.id,
      document_id,
      role_in_document: role_in_document ?? 'mentioned',
    })
  }

  return NextResponse.json({
    success: true,
    message: `Entity "${name}" created (Tier ${tier})${document_id ? ' and linked to document' : ''}`,
    entity_id: entity?.id,
  })
}

async function applyEvent(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { title, description, date, event_type, significance, document_id, entity_ids } =
    data as {
      title: string
      description: string
      date: string
      event_type: string
      significance: number | null
      document_id: string | null
      entity_ids: string[]
    }

  if (!title || !description || !date || !event_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: `Invalid event_type: ${event_type}` }, { status: 400 })
  }

  // Create the event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      title,
      description,
      date,
      event_type,
      significance: significance ?? null,
    })
    .select('id')
    .single()

  if (eventError) throw eventError

  // Link to source document
  if (document_id && event) {
    await supabase.from('event_documents').insert({
      event_id: event.id,
      document_id,
    })
  }

  // Link to entities
  if (entity_ids && entity_ids.length > 0 && event) {
    const entityEventRows = entity_ids.map((entityId) => ({
      entity_id: entityId,
      event_id: event.id,
    }))
    await supabase.from('entity_events').insert(entityEventRows)
  }

  return NextResponse.json({
    success: true,
    message: `Event "${title}" created on ${date}`,
    event_id: event?.id,
  })
}

async function applyEntityDocumentLink(
  data: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { entity_id, document_id, role_in_document, excerpt } = data as {
    entity_id: string
    document_id: string
    role_in_document: string
    excerpt: string | null
  }

  if (!entity_id || !document_id || !role_in_document) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify both exist
  const [entityCheck, docCheck] = await Promise.all([
    supabase.from('entities').select('id, name').eq('id', entity_id).single(),
    supabase.from('documents').select('id, bates_number').eq('id', document_id).single(),
  ])

  if (!entityCheck.data) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }
  if (!docCheck.data) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Check for existing link
  const { data: existing } = await supabase
    .from('entity_documents')
    .select('id')
    .eq('entity_id', entity_id)
    .eq('document_id', document_id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Link already exists' }, { status: 409 })
  }

  const { error } = await supabase.from('entity_documents').insert({
    entity_id,
    document_id,
    role_in_document,
    excerpt: excerpt ?? null,
  })

  if (error) throw error

  return NextResponse.json({
    success: true,
    message: `Linked ${entityCheck.data.name} to ${docCheck.data.bates_number}`,
  })
}
