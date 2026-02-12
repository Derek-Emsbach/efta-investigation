import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ForensicMeta {
  pipeline?: string
  pdf_version?: string
  metadata_status?: string
  eof_markers?: number
  has_javascript?: boolean
  has_forms?: boolean
  has_embedded_files?: boolean
  creation_date?: string | null
  mod_date?: string | null
  creator?: string | null
  producer?: string | null
  fonts?: string[]
  page_sizes?: string[]
}

interface AnomalyRecord {
  id: string
  bates_number: string | null
  title: string | null
  type: string
  details: string
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Run all queries in parallel
    const [docsResult, redactionsResult, suspectResult, entityPatternsResult] =
      await Promise.all([
        // All documents with forensic_metadata
        supabase
          .from('documents')
          .select(
            'id, bates_number, title, page_count, forensic_metadata, created_at'
          ),

        // All redactions with category breakdown
        supabase
          .from('redactions')
          .select(
            'id, document_id, page_number, category, is_suspect, red_flags, assessment, notes'
          ),

        // Suspect redactions with document info
        supabase
          .from('redactions')
          .select(
            'id, document_id, category, is_suspect, red_flags, assessment, notes, documents!inner(bates_number, title)'
          )
          .eq('is_suspect', true)
          .order('created_at', { ascending: false })
          .limit(100),

        // Entity-redaction patterns: entities linked to documents that have redactions
        supabase
          .from('redactions')
          .select(
            'document_id, category, is_suspect, documents!inner(id, bates_number, entity_documents(entity_id, entities(name, tier)))'
          ),
      ])

    if (docsResult.error) throw docsResult.error
    if (redactionsResult.error) throw redactionsResult.error

    const docs = docsResult.data ?? []
    const redactions = redactionsResult.data ?? []

    // ── Pipeline Distribution ──────────────────────────────
    const pipelineCounts: Record<string, { count: number; totalPages: number }> =
      {}
    const anomalies: AnomalyRecord[] = []
    const timelineDocs: {
      id: string
      bates: string | null
      creationDate: string
      pipeline: string
    }[] = []

    for (const doc of docs) {
      const meta = (doc.forensic_metadata ?? {}) as ForensicMeta
      if (!meta.pipeline && Object.keys(meta).length === 0) continue

      const pipeline = meta.pipeline ?? 'unknown'
      if (!pipelineCounts[pipeline]) {
        pipelineCounts[pipeline] = { count: 0, totalPages: 0 }
      }
      pipelineCounts[pipeline].count++
      pipelineCounts[pipeline].totalPages += doc.page_count ?? 0

      // Collect creation_date for timeline
      if (meta.creation_date) {
        timelineDocs.push({
          id: doc.id,
          bates: doc.bates_number,
          creationDate: meta.creation_date,
          pipeline,
        })
      }

      // ── Anomaly Detection ──────────────────────────────
      if (pipeline === 'unknown') {
        anomalies.push({
          id: doc.id,
          bates_number: doc.bates_number,
          title: doc.title,
          type: 'Unknown Pipeline',
          details: `PDF v${meta.pdf_version ?? '?'}, ${meta.eof_markers ?? '?'} EOF markers`,
        })
      }

      if (
        pipeline === 'standard' &&
        meta.metadata_status === 'retained'
      ) {
        anomalies.push({
          id: doc.id,
          bates_number: doc.bates_number,
          title: doc.title,
          type: 'Metadata Not Stripped',
          details:
            'Standard pipeline doc with metadata retained — expected stripped',
        })
      }

      if (
        pipeline === 'alternate' &&
        meta.eof_markers !== undefined &&
        meta.eof_markers !== 3
      ) {
        anomalies.push({
          id: doc.id,
          bates_number: doc.bates_number,
          title: doc.title,
          type: 'Wrong EOF Count',
          details: `Alternate pipeline with ${meta.eof_markers} EOF markers (expected 3)`,
        })
      }

      if (meta.has_javascript) {
        anomalies.push({
          id: doc.id,
          bates_number: doc.bates_number,
          title: doc.title,
          type: 'Embedded JavaScript',
          details: 'PDF contains JavaScript — potential security concern',
        })
      }

      if (meta.has_forms) {
        anomalies.push({
          id: doc.id,
          bates_number: doc.bates_number,
          title: doc.title,
          type: 'Contains Forms',
          details: 'PDF contains interactive form fields',
        })
      }
    }

    const docsWithMeta = docs.filter(
      (d) => d.forensic_metadata && Object.keys(d.forensic_metadata as object).length > 0
    ).length

    const pipelineDetails = Object.entries(pipelineCounts)
      .map(([pipeline, { count, totalPages }]) => ({
        pipeline,
        count,
        avgPages: count > 0 ? Math.round(totalPages / count) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // ── Redaction Breakdown ────────────────────────────────
    const categoryBreakdown = { A: 0, B: 0, C: 0, D: 0 }
    let suspectCount = 0
    let legitimateCount = 0
    const levelDistribution: Record<string, number> = {}

    for (const r of redactions) {
      const cat = r.category as 'A' | 'B' | 'C' | 'D'
      if (cat in categoryBreakdown) categoryBreakdown[cat]++
      if (r.is_suspect) suspectCount++
      else legitimateCount++
      if (r.assessment) {
        levelDistribution[r.assessment] =
          (levelDistribution[r.assessment] ?? 0) + 1
      }
    }

    // ── Suspect Redactions ─────────────────────────────────
    const suspectRedactions = (suspectResult.data ?? []).map((r) => {
      const docInfo = r.documents as unknown as {
        bates_number: string | null
        title: string | null
      } | null
      return {
        id: r.id,
        documentId: r.document_id,
        bates: docInfo?.bates_number ?? null,
        category: r.category,
        redFlags: r.red_flags ?? [],
        assessment: r.assessment,
        notes: r.notes,
      }
    })

    // ── Entity-Redaction Patterns ──────────────────────────
    const entityMap: Record<
      string,
      {
        entityName: string
        tier: number
        suspectCount: number
        totalRedactions: number
        documentIds: Set<string>
      }
    > = {}

    for (const r of entityPatternsResult.data ?? []) {
      const docInfo = r.documents as unknown as {
        id: string
        bates_number: string | null
        entity_documents: Array<{
          entity_id: string
          entities: { name: string; tier: number } | null
        }>
      } | null
      if (!docInfo?.entity_documents) continue

      for (const ed of docInfo.entity_documents) {
        if (!ed.entities) continue
        const key = ed.entities.name
        if (!entityMap[key]) {
          entityMap[key] = {
            entityName: ed.entities.name,
            tier: ed.entities.tier,
            suspectCount: 0,
            totalRedactions: 0,
            documentIds: new Set(),
          }
        }
        entityMap[key].totalRedactions++
        if (r.is_suspect) entityMap[key].suspectCount++
        entityMap[key].documentIds.add(r.document_id)
      }
    }

    const entityPatterns = Object.values(entityMap)
      .map((e) => ({
        entityName: e.entityName,
        tier: e.tier,
        suspectCount: e.suspectCount,
        totalRedactions: e.totalRedactions,
        documentCount: e.documentIds.size,
      }))
      .sort((a, b) => b.suspectCount - a.suspectCount)
      .slice(0, 50)

    // Sort timeline by creation date
    timelineDocs.sort(
      (a, b) =>
        new Date(a.creationDate).getTime() -
        new Date(b.creationDate).getTime()
    )

    return NextResponse.json({
      pipeline: {
        standard: pipelineCounts['standard']?.count ?? 0,
        alternate: pipelineCounts['alternate']?.count ?? 0,
        unknown: pipelineCounts['unknown']?.count ?? 0,
      },
      pipelineDetails,
      timeline: timelineDocs.slice(0, 200),
      anomalies: anomalies.slice(0, 100),
      redactions: {
        categoryBreakdown,
        suspectCount,
        legitimateCount,
        total: redactions.length,
        levelDistribution,
      },
      suspectRedactions,
      entityPatterns,
      stats: {
        documentsAnalyzed: docsWithMeta,
        totalDocuments: docs.length,
        anomalyCount: anomalies.length,
        suspectRedactionCount: suspectCount,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
