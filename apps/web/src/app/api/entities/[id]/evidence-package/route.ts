import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/r2/client'

/**
 * GET /api/entities/[id]/evidence-package
 *
 * Assembles a zip file containing:
 * - summary.txt: Entity profile + connections + events
 * - documents/*.pdf: All linked documents from R2
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    // Fetch entity + linked data in parallel
    const [entityResult, docsResult, connectionsResult, eventsResult] = await Promise.all([
      supabase
        .from('entities')
        .select('name, entity_type, tier, category, status, description, metadata')
        .eq('id', id)
        .single(),
      supabase
        .from('entity_documents')
        .select(`
          role_in_document,
          excerpt,
          document:documents(id, bates_number, title, document_type, original_date, file_url, page_count, severity, summary)
        `)
        .eq('entity_id', id)
        .limit(50),
      supabase
        .from('entity_connections')
        .select(`
          relationship_type,
          evidence_strength,
          description,
          entity_a_detail:entities!entity_connections_entity_a_fkey(name, tier),
          entity_b_detail:entities!entity_connections_entity_b_fkey(name, tier)
        `)
        .or(`entity_a.eq.${id},entity_b.eq.${id}`)
        .limit(100),
      supabase
        .from('entity_events')
        .select(`
          role,
          event:events(title, event_type, date, description, significance)
        `)
        .eq('entity_id', id)
        .limit(100),
    ])

    if (entityResult.error || !entityResult.data) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const entity = entityResult.data
    const docs = docsResult.data ?? []
    const connections = connectionsResult.data ?? []
    const events = eventsResult.data ?? []

    // Build summary text
    const lines: string[] = [
      `EVIDENCE PACKAGE: ${entity.name}`,
      `${'='.repeat(60)}`,
      '',
      `Entity Type: ${entity.entity_type ?? 'Unknown'}`,
      `Tier: ${entity.tier ?? 'Unassigned'}`,
      `Category: ${entity.category ?? 'N/A'}`,
      `Status: ${entity.status ?? 'N/A'}`,
      '',
    ]

    if (entity.description) {
      lines.push('DESCRIPTION', '-'.repeat(40), entity.description, '')
    }

    // Documents section
    lines.push(`LINKED DOCUMENTS (${docs.length})`, '-'.repeat(40))
    for (const link of docs) {
      const doc = link.document as unknown as Record<string, unknown> | null
      if (!doc) continue
      lines.push(
        `  ${doc.bates_number ?? 'Unknown'} — ${doc.title ?? 'Untitled'}`,
        `    Type: ${doc.document_type ?? 'Unknown'} | Date: ${doc.original_date ?? 'N/A'} | Pages: ${doc.page_count ?? 'N/A'} | Severity: ${doc.severity ?? 'N/A'}`,
        `    Role: ${link.role_in_document ?? 'N/A'}`,
      )
      if (link.excerpt) {
        lines.push(`    Excerpt: "${link.excerpt}"`)
      }
      if (doc.summary) {
        lines.push(`    Summary: ${doc.summary}`)
      }
      lines.push('')
    }

    // Connections section
    lines.push(`CONNECTIONS (${connections.length})`, '-'.repeat(40))
    for (const conn of connections) {
      const a = conn.entity_a_detail as unknown as Record<string, unknown> | null
      const b = conn.entity_b_detail as unknown as Record<string, unknown> | null
      lines.push(
        `  ${a?.name ?? '?'} → ${conn.relationship_type} → ${b?.name ?? '?'}`,
        `    Strength: ${conn.evidence_strength ?? 'N/A'}`,
      )
      if (conn.description) {
        lines.push(`    ${conn.description}`)
      }
      lines.push('')
    }

    // Events section
    lines.push(`EVENTS (${events.length})`, '-'.repeat(40))
    for (const link of events) {
      const ev = link.event as unknown as Record<string, unknown> | null
      if (!ev) continue
      lines.push(
        `  [${ev.date ?? 'N/D'}] ${ev.title ?? 'Untitled'} (${ev.event_type ?? 'N/A'})`,
        `    Role: ${link.role ?? 'N/A'}`,
      )
      if (ev.description) {
        lines.push(`    ${ev.description}`)
      }
      if (ev.significance) {
        lines.push(`    Significance: ${ev.significance}`)
      }
      lines.push('')
    }

    lines.push('', `Generated: ${new Date().toISOString()}`)

    // Assemble zip
    const zip = new JSZip()

    // Add summary
    zip.file('summary.txt', lines.join('\n'))

    // Add document files from R2
    const docFolder = zip.folder('documents')
    let fetchedCount = 0

    for (const link of docs) {
      const doc = link.document as unknown as Record<string, unknown> | null
      if (!doc?.file_url) continue

      const fileUrl = doc.file_url as string
      // Extract R2 key from the URL
      const publicUrl = (process.env.R2_PUBLIC_URL ?? '').trim()
      const r2Key = publicUrl && fileUrl.startsWith(publicUrl)
        ? fileUrl.slice(publicUrl.length + 1)
        : null

      if (!r2Key) continue

      try {
        const signedUrl = await getSignedDownloadUrl(r2Key, 300)
        const res = await fetch(signedUrl)
        if (!res.ok) continue

        const buffer = await res.arrayBuffer()
        const fileName = `${doc.bates_number ?? doc.id}.pdf`
        docFolder!.file(fileName, buffer)
        fetchedCount++

        // Limit to 20 documents to keep package size reasonable
        if (fetchedCount >= 20) break
      } catch {
        // Skip failed downloads
        continue
      }
    }

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

    const safeName = entity.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="evidence-${safeName}.zip"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
