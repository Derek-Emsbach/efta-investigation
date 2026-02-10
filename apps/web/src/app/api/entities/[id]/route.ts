import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  Entity,
  EntityDocument,
  EntityEvent,
  EntityConnection,
  EvidenceItem,
  Document,
  Event,
} from '@efta/shared'

interface ConnectionWithEntity extends EntityConnection {
  connected_entity: Entity
}

interface EntityDocumentWithDocument extends EntityDocument {
  document: Document
}

interface EntityEventWithEvent extends EntityEvent {
  event: Event
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch entity and all relations in parallel
    const [
      entityResult,
      documentsResult,
      eventsResult,
      connectionsAsAResult,
      connectionsAsBResult,
      evidenceResult,
    ] = await Promise.all([
      // 1. Entity record
      supabase.from('entities').select('*').eq('id', id).single(),

      // 2. Documents linked to this entity (with full document data)
      supabase
        .from('entity_documents')
        .select('*, document:documents(*)')
        .eq('entity_id', id),

      // 3. Events linked to this entity (with full event data)
      supabase
        .from('entity_events')
        .select('*, event:events(*)')
        .eq('entity_id', id),

      // 4. Connections where this entity is entity_a
      supabase
        .from('entity_connections')
        .select('*, connected_entity:entities!entity_b(*)')
        .eq('entity_a', id),

      // 5. Connections where this entity is entity_b
      supabase
        .from('entity_connections')
        .select('*, connected_entity:entities!entity_a(*)')
        .eq('entity_b', id),

      // 6. Evidence items for this entity
      supabase.from('evidence_items').select('*').eq('entity_id', id),
    ])

    // Handle 404
    if (entityResult.error) {
      if (entityResult.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
      }
      throw new Error(`Failed to fetch entity: ${entityResult.error.message}`)
    }

    if (documentsResult.error) {
      throw new Error(`Failed to fetch entity documents: ${documentsResult.error.message}`)
    }
    if (eventsResult.error) {
      throw new Error(`Failed to fetch entity events: ${eventsResult.error.message}`)
    }
    if (connectionsAsAResult.error) {
      throw new Error(`Failed to fetch connections (as A): ${connectionsAsAResult.error.message}`)
    }
    if (connectionsAsBResult.error) {
      throw new Error(`Failed to fetch connections (as B): ${connectionsAsBResult.error.message}`)
    }
    if (evidenceResult.error) {
      throw new Error(`Failed to fetch evidence: ${evidenceResult.error.message}`)
    }

    // Merge connections from both directions
    const connections: ConnectionWithEntity[] = [
      ...(connectionsAsAResult.data as ConnectionWithEntity[]),
      ...(connectionsAsBResult.data as ConnectionWithEntity[]),
    ]

    // Sort events by date (ascending) — events come with joined event data
    const events = (eventsResult.data as EntityEventWithEvent[]).sort((a, b) => {
      const dateA = a.event?.date ?? ''
      const dateB = b.event?.date ?? ''
      return dateA.localeCompare(dateB)
    })

    return NextResponse.json({
      entity: entityResult.data as Entity,
      documents: documentsResult.data as EntityDocumentWithDocument[],
      events,
      connections,
      evidence: evidenceResult.data as EvidenceItem[],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
