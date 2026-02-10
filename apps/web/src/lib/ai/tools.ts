import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

// -------------------------------------------------------------------
// Tool Definitions (Claude API format)
// -------------------------------------------------------------------

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_entities',
    description:
      'Search entities (persons, organizations, properties) by name, tier, category, entity type, or status. Returns up to 20 results with basic profile info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Free-text search query (searches name, bio, aliases)',
        },
        tier: { type: 'number', description: 'Filter by tier (1-6)' },
        category: {
          type: 'string',
          description:
            'Filter by category: abuser, attorney, judge, prosecutor, victim, staff, witness, recruiter, shell_company, law_firm, financial, government, nonprofit, media',
        },
        entity_type: {
          type: 'string',
          description: 'Filter by type: person, organization, property, vehicle, trust, agency',
        },
        status: {
          type: 'string',
          description:
            'Filter by status: convicted, not_investigated, settled, identified, deceased, active, unknown',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_documents',
    description:
      'Search documents by Bates number, title, type, severity, or keyword. Searches via full-text search and substring matching. Returns summaries, not full text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Free-text search (title, summary, extracted text)',
        },
        bates_number: {
          type: 'string',
          description: 'Exact or partial Bates number (e.g., EFTA02731623)',
        },
        document_type: {
          type: 'string',
          description:
            'Filter by type: email, fbi_302, financial, photo, memo, prosecution_memo, court_filing, victim_journal, senate_letter, legal_report, call_notes',
        },
        severity: {
          type: 'string',
          description: 'Filter by severity: extreme_critical, critical, high, routine',
        },
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'search_events',
    description:
      'Search timeline events by date range, event type, or keyword. Returns events with linked entity names.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search in event title and description',
        },
        event_type: {
          type: 'string',
          description:
            'Filter by type: legal, evidence, communication, institutional, personal, financial, legislative, travel, sighting',
        },
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'get_entity_profile',
    description:
      'Get a complete entity profile including bio, connections, evidence items, linked documents, and timeline events. Accepts entity ID or exact name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: { type: 'string', description: 'UUID of the entity' },
        entity_name: {
          type: 'string',
          description: 'Exact name (used if entity_id not provided)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_document_detail',
    description:
      'Get full document details including linked entities, redaction analysis, evidence items, and events. Accepts document ID or Bates number.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'UUID of the document' },
        bates_number: {
          type: 'string',
          description: 'Bates number (e.g., EFTA02731623)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_connections',
    description:
      'Get all connections for an entity, optionally filtered by relationship type or evidence strength. Can also check if two specific entities are connected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: {
          type: 'string',
          description: 'UUID of the entity to get connections for',
        },
        entity_name: {
          type: 'string',
          description: 'Name of entity (used if entity_id not provided)',
        },
        target_entity_name: {
          type: 'string',
          description:
            'If provided, checks for direct connection between the two entities',
        },
        relationship_type: {
          type: 'string',
          description:
            'Filter: employed_by, trafficked_by, represented_by, investigated_by, paid_by, connected_to, family_of, victim_of, attorney_for, hired_by, referred_by, subsidiary_of, owned_by',
        },
        evidence_strength: {
          type: 'string',
          description: 'Filter: documented, alleged, circumstantial',
        },
      },
      required: [],
    },
  },
  {
    name: 'cross_reference',
    description:
      'Find entities that co-occur in documents matching a keyword or filter. Useful for discovering hidden connections — entities appearing in the same documents without an explicit connection record.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to search in documents (e.g., "NPA", "wire transfer", "flight log")',
        },
        document_type: { type: 'string', description: 'Filter documents by type' },
        severity: { type: 'string', description: 'Filter documents by severity' },
        entity_name: {
          type: 'string',
          description:
            'If provided, only find entities co-occurring with this specific entity',
        },
      },
      required: [],
    },
  },
]

// -------------------------------------------------------------------
// Tool Execution
// -------------------------------------------------------------------

const MAX_RESULT_LENGTH = 8000

function truncate(str: string): string {
  if (str.length <= MAX_RESULT_LENGTH) return str
  return str.slice(0, MAX_RESULT_LENGTH) + '\n... [truncated]'
}

function safeJson(data: unknown): string {
  return truncate(JSON.stringify(data, null, 2))
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_entities':
        return await searchEntities(toolInput, supabase)
      case 'search_documents':
        return await searchDocuments(toolInput, supabase)
      case 'search_events':
        return await searchEvents(toolInput, supabase)
      case 'get_entity_profile':
        return await getEntityProfile(toolInput, supabase)
      case 'get_document_detail':
        return await getDocumentDetail(toolInput, supabase)
      case 'query_connections':
        return await queryConnections(toolInput, supabase)
      case 'cross_reference':
        return await crossReference(toolInput, supabase)
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : 'Tool execution failed',
    })
  }
}

// -------------------------------------------------------------------
// Individual Tool Implementations
// -------------------------------------------------------------------

async function searchEntities(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  const { query, tier, category, entity_type, status } = input as {
    query?: string
    tier?: number
    category?: string
    entity_type?: string
    status?: string
  }

  const select = 'id, name, entity_type, tier, category, bio, status, aliases'

  // FTS query
  let ftsResults: Record<string, unknown>[] = []
  if (query) {
    const { data } = await supabase
      .from('entities')
      .select(select)
      .textSearch('search_vector', query)
      .limit(20)
    ftsResults = data ?? []
  }

  // ilike fallback
  let ilikeResults: Record<string, unknown>[] = []
  if (query) {
    const { data } = await supabase
      .from('entities')
      .select(select)
      .or(`name.ilike.%${query}%,bio.ilike.%${query}%`)
      .limit(20)
    ilikeResults = data ?? []
  }

  // Filter-only query (no text search)
  let filterResults: Record<string, unknown>[] = []
  if (!query) {
    let q = supabase.from('entities').select(select)
    if (tier) q = q.eq('tier', tier)
    if (category) q = q.eq('category', category)
    if (entity_type) q = q.eq('entity_type', entity_type)
    if (status) q = q.eq('status', status)
    const { data } = await q.order('name').limit(20)
    filterResults = data ?? []
  }

  // Merge and deduplicate
  const seen = new Set<string>()
  const results: Record<string, unknown>[] = []
  for (const row of [...ftsResults, ...ilikeResults, ...filterResults]) {
    const id = row.id as string
    if (seen.has(id)) continue
    seen.add(id)

    // Apply additional filters to FTS/ilike results
    if (tier && row.tier !== tier) continue
    if (category && row.category !== category) continue
    if (entity_type && row.entity_type !== entity_type) continue
    if (status && row.status !== status) continue

    // Redact non-public victim bios
    if (row.category === 'victim') {
      row.bio = '[REDACTED — victim privacy]'
    }

    results.push(row)
    if (results.length >= 20) break
  }

  return safeJson({ count: results.length, results })
}

async function searchDocuments(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  const { query, bates_number, document_type, severity, date_from, date_to } =
    input as {
      query?: string
      bates_number?: string
      document_type?: string
      severity?: string
      date_from?: string
      date_to?: string
    }

  const select =
    'id, bates_number, title, document_type, severity, original_date, summary, page_count, flags'

  const allResults: Record<string, unknown>[] = []

  if (bates_number) {
    const { data } = await supabase
      .from('documents')
      .select(select)
      .ilike('bates_number', `%${bates_number}%`)
      .limit(20)
    allResults.push(...(data ?? []))
  }

  if (query) {
    const [fts, ilike] = await Promise.all([
      supabase
        .from('documents')
        .select(select)
        .textSearch('search_vector', query)
        .limit(20),
      supabase
        .from('documents')
        .select(select)
        .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
        .limit(20),
    ])
    allResults.push(...(fts.data ?? []), ...(ilike.data ?? []))
  }

  if (!query && !bates_number) {
    let q = supabase.from('documents').select(select)
    if (document_type) q = q.eq('document_type', document_type)
    if (severity) q = q.eq('severity', severity)
    if (date_from) q = q.gte('original_date', date_from)
    if (date_to) q = q.lte('original_date', date_to)
    const { data } = await q
      .order('original_date', { ascending: false, nullsFirst: false })
      .limit(20)
    allResults.push(...(data ?? []))
  }

  // Deduplicate and apply filters
  const seen = new Set<string>()
  const results: Record<string, unknown>[] = []
  for (const row of allResults) {
    const id = row.id as string
    if (seen.has(id)) continue
    seen.add(id)
    if (document_type && row.document_type !== document_type) continue
    if (severity && row.severity !== severity) continue
    if (date_from && row.original_date && (row.original_date as string) < date_from) continue
    if (date_to && row.original_date && (row.original_date as string) > date_to) continue
    results.push(row)
    if (results.length >= 20) break
  }

  return safeJson({ count: results.length, results })
}

async function searchEvents(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  const { query, event_type, date_from, date_to } = input as {
    query?: string
    event_type?: string
    date_from?: string
    date_to?: string
  }

  let q = supabase
    .from('events')
    .select('id, date, title, description, event_type, significance')

  if (query) {
    q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
  }
  if (event_type) q = q.eq('event_type', event_type)
  if (date_from) q = q.gte('date', date_from)
  if (date_to) q = q.lte('date', date_to)

  const { data: events } = await q
    .order('date', { ascending: true, nullsFirst: false })
    .limit(30)

  if (!events || events.length === 0) {
    return safeJson({ count: 0, results: [] })
  }

  // Fetch linked entities for these events
  const eventIds = events.map((e) => e.id)
  const { data: entityEvents } = await supabase
    .from('entity_events')
    .select('event_id, role, entity:entities(id, name, tier)')
    .in('event_id', eventIds)

  // Merge entities into events
  const entityMap = new Map<string, { name: string; tier: number | null; role: string | null }[]>()
  for (const ee of entityEvents ?? []) {
    const entity = ee.entity as unknown as { id: string; name: string; tier: number | null }
    if (!entity) continue
    const list = entityMap.get(ee.event_id) ?? []
    list.push({ name: entity.name, tier: entity.tier, role: ee.role })
    entityMap.set(ee.event_id, list)
  }

  const results = events.map((event) => ({
    ...event,
    linked_entities: entityMap.get(event.id) ?? [],
  }))

  return safeJson({ count: results.length, results })
}

async function getEntityProfile(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  let { entity_id } = input as { entity_id?: string; entity_name?: string }
  const { entity_name } = input as { entity_name?: string }

  // Resolve name to ID
  if (!entity_id && entity_name) {
    const { data } = await supabase
      .from('entities')
      .select('id')
      .ilike('name', entity_name)
      .limit(1)
      .single()
    if (!data) return JSON.stringify({ error: `Entity not found: ${entity_name}` })
    entity_id = data.id
  }

  if (!entity_id) return JSON.stringify({ error: 'Provide entity_id or entity_name' })

  const [entityResult, docsResult, eventsResult, connAsAResult, connAsBResult, evidenceResult] =
    await Promise.all([
      supabase.from('entities').select('*').eq('id', entity_id).single(),
      supabase
        .from('entity_documents')
        .select('role_in_document, excerpt, document:documents(id, bates_number, title, document_type, severity)')
        .eq('entity_id', entity_id),
      supabase
        .from('entity_events')
        .select('role, event:events(id, date, title, event_type, significance)')
        .eq('entity_id', entity_id),
      supabase
        .from('entity_connections')
        .select('relationship_type, evidence_strength, description, connected:entities!entity_b(id, name, tier, category)')
        .eq('entity_a', entity_id),
      supabase
        .from('entity_connections')
        .select('relationship_type, evidence_strength, description, connected:entities!entity_a(id, name, tier, category)')
        .eq('entity_b', entity_id),
      supabase
        .from('evidence_items')
        .select('id, evidence_type, description, category, strength, date')
        .eq('entity_id', entity_id),
    ])

  if (entityResult.error || !entityResult.data) {
    return JSON.stringify({ error: `Entity not found: ${entity_id}` })
  }

  const entity = entityResult.data

  // Redact victim bio
  if (entity.category === 'victim' && !entity.is_public) {
    entity.bio = '[REDACTED — victim privacy]'
    entity.aliases = []
  }

  const connections = [
    ...(connAsAResult.data ?? []),
    ...(connAsBResult.data ?? []),
  ]

  return safeJson({
    entity: {
      id: entity.id,
      name: entity.name,
      entity_type: entity.entity_type,
      tier: entity.tier,
      tier_justification: entity.tier_justification,
      category: entity.category,
      bio: entity.bio,
      status: entity.status,
      aliases: entity.aliases,
      datasets_appeared: entity.datasets_appeared,
    },
    documents: docsResult.data ?? [],
    events: eventsResult.data ?? [],
    connections,
    evidence: evidenceResult.data ?? [],
    summary: {
      document_count: (docsResult.data ?? []).length,
      event_count: (eventsResult.data ?? []).length,
      connection_count: connections.length,
      evidence_count: (evidenceResult.data ?? []).length,
    },
  })
}

async function getDocumentDetail(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  let { document_id } = input as { document_id?: string; bates_number?: string }
  const { bates_number } = input as { bates_number?: string }

  // Resolve bates to ID
  if (!document_id && bates_number) {
    const { data } = await supabase
      .from('documents')
      .select('id')
      .eq('bates_number', bates_number)
      .single()
    if (!data) return JSON.stringify({ error: `Document not found: ${bates_number}` })
    document_id = data.id
  }

  if (!document_id) return JSON.stringify({ error: 'Provide document_id or bates_number' })

  const [docResult, entitiesResult, redactionsResult, evidenceResult, eventsResult] =
    await Promise.all([
      supabase
        .from('documents')
        .select('*, dataset:datasets(number, name)')
        .eq('id', document_id)
        .single(),
      supabase
        .from('entity_documents')
        .select('role_in_document, excerpt, entity:entities(id, name, tier, category)')
        .eq('document_id', document_id),
      supabase
        .from('redactions')
        .select('page_number, category, description, is_suspect, red_flags, assessment')
        .eq('document_id', document_id),
      supabase
        .from('evidence_items')
        .select('id, evidence_type, description, category, strength')
        .eq('document_id', document_id),
      supabase
        .from('event_documents')
        .select('event:events(id, date, title, event_type)')
        .eq('document_id', document_id),
    ])

  if (docResult.error || !docResult.data) {
    return JSON.stringify({ error: `Document not found: ${document_id}` })
  }

  const doc = docResult.data

  // Include truncated extracted text
  const extractedTextPreview = doc.extracted_text
    ? doc.extracted_text.slice(0, 2000) +
      (doc.extracted_text.length > 2000 ? '\n... [truncated — full text available in document viewer]' : '')
    : null

  return safeJson({
    document: {
      id: doc.id,
      bates_number: doc.bates_number,
      title: doc.title,
      document_type: doc.document_type,
      severity: doc.severity,
      original_date: doc.original_date,
      page_count: doc.page_count,
      classification: doc.classification,
      processing_status: doc.processing_status,
      summary: doc.summary,
      flags: doc.flags,
      forensic_metadata: doc.forensic_metadata,
      dataset: doc.dataset,
      extracted_text_preview: extractedTextPreview,
    },
    entities: entitiesResult.data ?? [],
    redactions: redactionsResult.data ?? [],
    evidence: evidenceResult.data ?? [],
    events: eventsResult.data ?? [],
  })
}

async function queryConnections(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  let { entity_id } = input as {
    entity_id?: string
    entity_name?: string
    target_entity_name?: string
    relationship_type?: string
    evidence_strength?: string
  }
  const { entity_name, target_entity_name, relationship_type, evidence_strength } =
    input as {
      entity_name?: string
      target_entity_name?: string
      relationship_type?: string
      evidence_strength?: string
    }

  // Resolve name
  if (!entity_id && entity_name) {
    const { data } = await supabase
      .from('entities')
      .select('id')
      .ilike('name', entity_name)
      .limit(1)
      .single()
    if (!data) return JSON.stringify({ error: `Entity not found: ${entity_name}` })
    entity_id = data.id
  }

  if (!entity_id) return JSON.stringify({ error: 'Provide entity_id or entity_name' })

  // Resolve target if provided
  let targetId: string | undefined
  if (target_entity_name) {
    const { data } = await supabase
      .from('entities')
      .select('id')
      .ilike('name', target_entity_name)
      .limit(1)
      .single()
    if (!data) return JSON.stringify({ error: `Target entity not found: ${target_entity_name}` })
    targetId = data.id
  }

  // Fetch connections in both directions
  let qA = supabase
    .from('entity_connections')
    .select('*, connected:entities!entity_b(id, name, tier, category)')
    .eq('entity_a', entity_id)
  let qB = supabase
    .from('entity_connections')
    .select('*, connected:entities!entity_a(id, name, tier, category)')
    .eq('entity_b', entity_id)

  if (relationship_type) {
    qA = qA.eq('relationship_type', relationship_type)
    qB = qB.eq('relationship_type', relationship_type)
  }
  if (evidence_strength) {
    qA = qA.eq('evidence_strength', evidence_strength)
    qB = qB.eq('evidence_strength', evidence_strength)
  }

  const [resultA, resultB] = await Promise.all([qA, qB])

  let connections = [...(resultA.data ?? []), ...(resultB.data ?? [])]

  // Filter to target if specified
  if (targetId) {
    connections = connections.filter((c) => {
      const connected = c.connected as unknown as { id: string }
      return connected?.id === targetId
    })
  }

  return safeJson({
    entity_id,
    total_connections: connections.length,
    connections: connections.map((c) => ({
      connected_entity: c.connected,
      relationship_type: c.relationship_type,
      evidence_strength: c.evidence_strength,
      description: c.description,
      start_date: c.start_date,
      end_date: c.end_date,
    })),
  })
}

async function crossReference(
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  const { keyword, document_type, severity, entity_name } = input as {
    keyword?: string
    document_type?: string
    severity?: string
    entity_name?: string
  }

  // Step 1: Find matching documents
  let docQuery = supabase.from('documents').select('id')

  if (keyword) {
    docQuery = docQuery.or(
      `title.ilike.%${keyword}%,summary.ilike.%${keyword}%`,
    )
  }
  if (document_type) docQuery = docQuery.eq('document_type', document_type)
  if (severity) docQuery = docQuery.eq('severity', severity)

  const { data: docs } = await docQuery.limit(50)
  if (!docs || docs.length === 0) {
    return JSON.stringify({
      error: 'No documents found matching the criteria',
      suggestion: 'Try broader search terms or remove filters',
    })
  }

  const docIds = docs.map((d) => d.id)

  // Step 2: Find all entities in those documents
  const { data: entityDocs } = await supabase
    .from('entity_documents')
    .select('entity_id, document_id, entity:entities(id, name, tier, category)')
    .in('document_id', docIds)

  if (!entityDocs || entityDocs.length === 0) {
    return JSON.stringify({
      message: 'No entities found in matching documents',
      documents_checked: docIds.length,
    })
  }

  // Step 3: Group by entity, count co-occurrences
  const entityDocMap = new Map<
    string,
    { name: string; tier: number | null; category: string | null; docIds: Set<string> }
  >()

  for (const ed of entityDocs) {
    const entity = ed.entity as unknown as {
      id: string
      name: string
      tier: number | null
      category: string | null
    }
    if (!entity) continue

    const existing = entityDocMap.get(entity.id)
    if (existing) {
      existing.docIds.add(ed.document_id)
    } else {
      entityDocMap.set(entity.id, {
        name: entity.name,
        tier: entity.tier,
        category: entity.category,
        docIds: new Set([ed.document_id]),
      })
    }
  }

  // Step 4: If entity_name specified, filter to co-occurring entities
  let focusEntityId: string | undefined
  if (entity_name) {
    const { data } = await supabase
      .from('entities')
      .select('id')
      .ilike('name', entity_name)
      .limit(1)
      .single()
    focusEntityId = data?.id
  }

  // Build co-occurrence results
  let entities = Array.from(entityDocMap.entries())
    .map(([id, info]) => ({
      entity_id: id,
      name: info.name,
      tier: info.tier,
      category: info.category,
      document_count: info.docIds.size,
      document_ids: Array.from(info.docIds),
    }))
    .sort((a, b) => b.document_count - a.document_count)

  if (focusEntityId) {
    const focusDocs = entityDocMap.get(focusEntityId)?.docIds
    if (focusDocs) {
      entities = entities
        .filter((e) => e.entity_id !== focusEntityId)
        .map((e) => {
          const sharedDocs = e.document_ids.filter((d) => focusDocs.has(d))
          return { ...e, shared_document_count: sharedDocs.length, shared_document_ids: sharedDocs }
        })
        .filter((e) => e.shared_document_count > 0)
        .sort((a, b) => b.shared_document_count - a.shared_document_count)
    }
  }

  // Step 5: Check which co-occurring pairs have connection records
  const topEntities = entities.slice(0, 15)
  if (focusEntityId && topEntities.length > 0) {
    const entityIds = topEntities.map((e) => e.entity_id)
    const { data: existingConnections } = await supabase
      .from('entity_connections')
      .select('entity_a, entity_b')
      .or(
        `and(entity_a.eq.${focusEntityId},entity_b.in.(${entityIds.join(',')})),and(entity_b.eq.${focusEntityId},entity_a.in.(${entityIds.join(',')}))`,
      )

    const connectedIds = new Set<string>()
    for (const c of existingConnections ?? []) {
      connectedIds.add(c.entity_a === focusEntityId ? c.entity_b : c.entity_a)
    }

    for (const e of topEntities) {
      (e as Record<string, unknown>).has_connection_record = connectedIds.has(e.entity_id)
    }
  }

  return safeJson({
    documents_searched: docIds.length,
    entities_found: entities.length,
    top_entities: topEntities,
    focus_entity: entity_name ?? null,
  })
}
