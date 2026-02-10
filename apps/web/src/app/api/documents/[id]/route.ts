import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  Document,
  Dataset,
  EntityDocument,
  Entity,
  Redaction,
  EvidenceItem,
  EventDocument,
  Event,
} from '@efta/shared'

interface DocumentWithDataset extends Document {
  dataset: Dataset | null
}

interface EntityDocumentWithEntity extends EntityDocument {
  entity: Entity
}

interface EventDocumentWithEvent extends EventDocument {
  event: Event
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch document and all relations in parallel
    const [
      documentResult,
      entitiesResult,
      redactionsResult,
      evidenceResult,
      eventsResult,
    ] = await Promise.all([
      // 1. Document with dataset join
      supabase
        .from('documents')
        .select('*, dataset:datasets(*)')
        .eq('id', id)
        .single(),

      // 2. Entities linked to this document
      supabase
        .from('entity_documents')
        .select('*, entity:entities(*)')
        .eq('document_id', id),

      // 3. Redactions on this document
      supabase
        .from('redactions')
        .select('*')
        .eq('document_id', id),

      // 4. Evidence items referencing this document
      supabase
        .from('evidence_items')
        .select('*')
        .eq('document_id', id),

      // 5. Events sourced from this document
      supabase
        .from('event_documents')
        .select('*, event:events(*)')
        .eq('document_id', id),
    ])

    // Handle 404
    if (documentResult.error) {
      if (documentResult.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }
      throw new Error(`Failed to fetch document: ${documentResult.error.message}`)
    }

    if (entitiesResult.error) {
      throw new Error(`Failed to fetch document entities: ${entitiesResult.error.message}`)
    }
    if (redactionsResult.error) {
      throw new Error(`Failed to fetch redactions: ${redactionsResult.error.message}`)
    }
    if (evidenceResult.error) {
      throw new Error(`Failed to fetch evidence: ${evidenceResult.error.message}`)
    }
    if (eventsResult.error) {
      throw new Error(`Failed to fetch events: ${eventsResult.error.message}`)
    }

    return NextResponse.json({
      document: documentResult.data as DocumentWithDataset,
      entities: entitiesResult.data as EntityDocumentWithEntity[],
      redactions: redactionsResult.data as Redaction[],
      evidence: evidenceResult.data as EvidenceItem[],
      events: eventsResult.data as EventDocumentWithEvent[],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
