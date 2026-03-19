import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

interface PendingEntity {
  name: string
  tier: number
  category: string
  context: string
}

interface PendingRedaction {
  page: number
  current_category: string
  proposed_category: string
  reason: string
}

/**
 * POST: Batch approve/reject auto-review suggestions.
 *
 * Body:
 *   action: 'approve_entity' | 'reject_entity' | 'approve_redaction' | 'reject_redaction' | 'approve_all_safe'
 *   document_id: UUID
 *   index?: number (which suggestion to act on — required for single approve/reject)
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin()
    if (result instanceof NextResponse) return result
    const { supabase } = result

    const body = await request.json()
    const { action, document_id, index } = body

    if (!document_id || !action) {
      return NextResponse.json({ error: 'document_id and action required' }, { status: 400 })
    }

    // Fetch the auto_review results from the processing queue
    const { data: queueItems } = await supabase
      .from('processing_queue')
      .select('id, results')
      .eq('document_id', document_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({ error: 'No completed queue item found' }, { status: 404 })
    }

    const queueItem = queueItems[0]
    const results = (queueItem.results ?? {}) as Record<string, unknown>
    const autoReview = (results.auto_review ?? {}) as Record<string, unknown>

    const pendingEntities = (autoReview.pending_entities ?? []) as PendingEntity[]
    const pendingRedactions = (autoReview.pending_redactions ?? []) as PendingRedaction[]

    let applied = 0

    switch (action) {
      case 'approve_entity': {
        if (index === undefined || index < 0 || index >= pendingEntities.length) {
          return NextResponse.json({ error: 'Invalid entity index' }, { status: 400 })
        }
        const entity = pendingEntities[index]
        // Create entity as draft
        const { data: newEntity, error: createError } = await supabase
          .from('entities')
          .insert({
            name: entity.name,
            tier: entity.tier,
            category: entity.category,
            entity_type: entity.category,
            bio: entity.context || `Auto-review entity from document ${document_id}`,
            processing_status: 'needs_review',
          })
          .select('id')
          .single()

        if (createError) throw new Error(`Failed to create entity: ${createError.message}`)

        // Link to document
        await supabase.from('entity_documents').upsert({
          entity_id: newEntity.id,
          document_id,
          role_in_document: 'mentioned',
          excerpt: `[auto-review approved] ${entity.context}`,
        }, { onConflict: 'entity_id,document_id,role_in_document' })

        // Remove from pending
        pendingEntities.splice(index, 1)
        applied = 1
        break
      }

      case 'reject_entity': {
        if (index === undefined || index < 0 || index >= pendingEntities.length) {
          return NextResponse.json({ error: 'Invalid entity index' }, { status: 400 })
        }
        pendingEntities.splice(index, 1)
        break
      }

      case 'approve_all_safe': {
        // Approve all T5/T6 entities only
        const safe = pendingEntities.filter(e => e.tier >= 5)
        for (const entity of safe) {
          const { data: newEntity, error: createError } = await supabase
            .from('entities')
            .insert({
              name: entity.name,
              tier: entity.tier,
              category: entity.category,
              entity_type: entity.category,
              bio: entity.context || `Auto-review entity from document ${document_id}`,
              processing_status: 'needs_review',
            })
            .select('id')
            .single()

          if (createError) continue

          await supabase.from('entity_documents').upsert({
            entity_id: newEntity.id,
            document_id,
            role_in_document: 'mentioned',
            excerpt: `[auto-review approved] ${entity.context}`,
          }, { onConflict: 'entity_id,document_id,role_in_document' })

          applied++
        }
        // Keep only T1-T4 as still pending
        const remaining = pendingEntities.filter(e => e.tier < 5)
        pendingEntities.length = 0
        pendingEntities.push(...remaining)
        break
      }

      case 'approve_redaction': {
        if (index === undefined || index < 0 || index >= pendingRedactions.length) {
          return NextResponse.json({ error: 'Invalid redaction index' }, { status: 400 })
        }
        const redaction = pendingRedactions[index]
        // Update the redaction record category
        await supabase
          .from('redactions')
          .update({ category: redaction.proposed_category })
          .eq('document_id', document_id)
          .eq('page_number', redaction.page)

        pendingRedactions.splice(index, 1)
        applied = 1
        break
      }

      case 'reject_redaction': {
        if (index === undefined || index < 0 || index >= pendingRedactions.length) {
          return NextResponse.json({ error: 'Invalid redaction index' }, { status: 400 })
        }
        pendingRedactions.splice(index, 1)
        break
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    // Update the queue item with modified pending lists
    const updatedAutoReview = {
      ...autoReview,
      pending_entities: pendingEntities,
      pending_redactions: pendingRedactions,
      has_pending: pendingEntities.length > 0 || pendingRedactions.length > 0,
    }
    const updatedResults = { ...results, auto_review: updatedAutoReview }

    await supabase
      .from('processing_queue')
      .update({ results: updatedResults })
      .eq('id', queueItem.id)

    return NextResponse.json({
      success: true,
      action,
      applied,
      remaining_entities: pendingEntities.length,
      remaining_redactions: pendingRedactions.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
