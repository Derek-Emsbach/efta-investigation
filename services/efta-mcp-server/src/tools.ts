import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, safeJson } from './supabase.js';
import { getDocumentText } from './r2.js';

// =============================================================================
// Tool registration — attach all tools to the MCP server instance
// =============================================================================

export function registerTools(server: McpServer) {
  // ===========================================================================
  // READ TOOLS
  // ===========================================================================

  // ── search_entities ─────────────────────────────────────────────────────────
  server.registerTool(
    'search_entities',
    {
      title: 'Search Entities',
      description:
        'Search the EFTA entity database by name, tier, or category. Returns matching entities with their tier classification, evidence summary, and linked datasets.',
      inputSchema: {
        query: z.string().optional().describe('Name or keyword to search for'),
        tier: z.number().min(1).max(6).optional().describe('Filter by tier (1-6)'),
        category: z.string().optional().describe('Filter by category (e.g. inner_circle, staff, victim)'),
        limit: z.number().min(1).max(50).default(20).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, tier, category, limit }) => {
      const sb = getSupabase();
      let q = sb.from('entities').select('*');
      if (query) q = q.or(`name.ilike.%${query}%,aliases.cs.{${query}}`);
      if (tier) q = q.eq('tier', tier);
      if (category) q = q.eq('category', category);
      q = q.order('tier', { ascending: true }).limit(limit);
      const { data, error } = await q;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return {
        content: [{ type: 'text' as const, text: safeJson({ count: data?.length ?? 0, entities: data }) }],
      };
    },
  );

  // ── get_entity ──────────────────────────────────────────────────────────────
  server.registerTool(
    'get_entity',
    {
      title: 'Get Entity Details',
      description:
        'Get full details for a specific entity by ID, including linked documents, events, and connections.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id }) => {
      const sb = getSupabase();
      const [entityRes, docsRes, eventsRes, connectionsRes] = await Promise.all([
        sb.from('entities').select('*').eq('id', entity_id).single(),
        sb.from('entity_documents').select('*, document:documents(id, bates_number, title, document_type, date, processing_status)').eq('entity_id', entity_id).limit(50),
        sb.from('entity_events').select('*, event:events(*)').eq('entity_id', entity_id).limit(50),
        sb.from('connections').select('*, source_entity:entities!connections_source_entity_id_fkey(id, name, tier), target_entity:entities!connections_target_entity_id_fkey(id, name, tier)').or(`source_entity_id.eq.${entity_id},target_entity_id.eq.${entity_id}`).limit(50),
      ]);
      if (entityRes.error) return { content: [{ type: 'text' as const, text: `Error: ${entityRes.error.message}` }] };
      return {
        content: [{
          type: 'text' as const,
          text: safeJson({
            entity: entityRes.data,
            documents: docsRes.data ?? [],
            events: eventsRes.data ?? [],
            connections: connectionsRes.data ?? [],
          }),
        }],
      };
    },
  );

  // ── search_documents ────────────────────────────────────────────────────────
  server.registerTool(
    'search_documents',
    {
      title: 'Search Documents',
      description:
        'Search EFTA documents by Bates number, title, full-text content, type, dataset, or processing status.',
      inputSchema: {
        query: z.string().optional().describe('Search term (searches bates_number, title, and full-text)'),
        document_type: z.string().optional().describe('Filter by type (e.g. fbi_302, email, court_filing, prosecution_memo)'),
        dataset_id: z.string().optional().describe('Filter by dataset UUID'),
        processing_status: z.string().optional().describe('Filter by status (reviewed, needs_review, extracted, etc.)'),
        min_classification_score: z.number().optional().describe('Minimum classification score (0-100)'),
        limit: z.number().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, document_type, dataset_id, processing_status, min_classification_score, limit }) => {
      const sb = getSupabase();
      let q = sb.from('documents').select('id, bates_number, title, document_type, date, page_count, processing_status, classification, classification_score, severity, dataset_id, extracted_text');
      if (query) {
        q = q.or(`bates_number.ilike.%${query}%,title.ilike.%${query}%,extracted_text.ilike.%${query}%`);
      }
      if (document_type) q = q.eq('document_type', document_type);
      if (dataset_id) q = q.eq('dataset_id', dataset_id);
      if (processing_status) q = q.eq('processing_status', processing_status);
      if (min_classification_score) q = q.gte('classification_score', min_classification_score);
      q = q.order('classification_score', { ascending: false }).limit(limit);
      const { data, error } = await q;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return {
        content: [{ type: 'text' as const, text: safeJson({ count: data?.length ?? 0, documents: data }) }],
      };
    },
  );

  // ── get_document ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_document',
    {
      title: 'Get Document Details',
      description:
        'Get full metadata for a document by ID or Bates number, including linked entities, redactions, and cross-references.',
      inputSchema: {
        id: z.string().optional().describe('Document UUID'),
        bates_number: z.string().optional().describe('EFTA Bates number (e.g. EFTA02731623)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, bates_number }) => {
      const sb = getSupabase();
      let docQuery = sb.from('documents').select('*');
      if (id) docQuery = docQuery.eq('id', id);
      else if (bates_number) docQuery = docQuery.eq('bates_number', bates_number);
      else return { content: [{ type: 'text' as const, text: 'Provide either id or bates_number' }] };

      const { data: doc, error } = await docQuery.single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const [entitiesRes, redactionsRes, crossRefsRes] = await Promise.all([
        sb.from('entity_documents').select('*, entity:entities(id, name, tier, category)').eq('document_id', doc.id),
        sb.from('redactions').select('*').eq('document_id', doc.id),
        sb.from('document_cross_references').select('*').or(`source_document_id.eq.${doc.id},target_document_id.eq.${doc.id}`).limit(20),
      ]);

      return {
        content: [{
          type: 'text' as const,
          text: safeJson({
            document: doc,
            entities: entitiesRes.data ?? [],
            redactions: redactionsRes.data ?? [],
            cross_references: crossRefsRes.data ?? [],
          }),
        }],
      };
    },
  );

  // ── get_document_full_text ──────────────────────────────────────────────────
  server.registerTool(
    'get_document_full_text',
    {
      title: 'Get Document Full Text',
      description:
        'Fetch the complete extracted text of a document from R2 storage. Use this when the 2K preview in the database is insufficient for analysis.',
      inputSchema: {
        bates_number: z.string().describe('EFTA Bates number'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ bates_number }) => {
      const text = await getDocumentText(bates_number);
      if (!text) {
        return { content: [{ type: 'text' as const, text: `No full text found for ${bates_number}` }] };
      }
      // Truncate to ~30K chars to stay within reasonable token limits
      const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n\n... [truncated at 30K chars]' : text;
      return { content: [{ type: 'text' as const, text: truncated }] };
    },
  );

  // ── search_events ───────────────────────────────────────────────────────────
  server.registerTool(
    'search_events',
    {
      title: 'Search Events',
      description: 'Search the investigation timeline events by keyword, date range, or linked entity.',
      inputSchema: {
        query: z.string().optional().describe('Keyword to search in event title/description'),
        after: z.string().optional().describe('ISO date — events after this date'),
        before: z.string().optional().describe('ISO date — events before this date'),
        entity_id: z.string().uuid().optional().describe('Filter events linked to this entity'),
        limit: z.number().min(1).max(50).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, after, before, entity_id, limit }) => {
      const sb = getSupabase();
      if (entity_id) {
        // Join through entity_events
        let q = sb.from('entity_events').select('*, event:events(*)').eq('entity_id', entity_id);
        const { data, error } = await q.limit(limit);
        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
        const events = (data ?? []).map((r: any) => r.event).filter(Boolean);
        return { content: [{ type: 'text' as const, text: safeJson({ count: events.length, events }) }] };
      }

      let q = sb.from('events').select('*');
      if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      if (after) q = q.gte('date', after);
      if (before) q = q.lte('date', before);
      q = q.order('date', { ascending: true }).limit(limit);
      const { data, error } = await q;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: safeJson({ count: data?.length ?? 0, events: data }) }] };
    },
  );

  // ── find_connections ────────────────────────────────────────────────────────
  server.registerTool(
    'find_connections',
    {
      title: 'Find Connections',
      description:
        'Find connections (relationships) between entities. Can search by source or target entity, connection type, or strength.',
      inputSchema: {
        entity_id: z.string().uuid().optional().describe('Find connections involving this entity'),
        connection_type: z.string().optional().describe('Filter by type (e.g. associate, employer, co_conspirator, family)'),
        min_strength: z.number().min(0).max(100).optional().describe('Minimum connection strength'),
        limit: z.number().min(1).max(50).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id, connection_type, min_strength, limit }) => {
      const sb = getSupabase();
      let q = sb.from('connections').select('*, source_entity:entities!connections_source_entity_id_fkey(id, name, tier), target_entity:entities!connections_target_entity_id_fkey(id, name, tier)');
      if (entity_id) q = q.or(`source_entity_id.eq.${entity_id},target_entity_id.eq.${entity_id}`);
      if (connection_type) q = q.eq('connection_type', connection_type);
      if (min_strength) q = q.gte('strength', min_strength);
      q = q.limit(limit);
      const { data, error } = await q;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: safeJson({ count: data?.length ?? 0, connections: data }) }] };
    },
  );

  // ── search_redactions ───────────────────────────────────────────────────────
  server.registerTool(
    'search_redactions',
    {
      title: 'Search Redactions',
      description:
        'Search redaction records. Filter by category (A-D), suspected status, or linked document.',
      inputSchema: {
        category: z.enum(['A', 'B', 'C', 'D']).optional().describe('Redaction category (A=victim, B=legal, C=institutional, D=perpetrator)'),
        is_suspect: z.boolean().optional().describe('Filter for suspect redactions only'),
        document_id: z.string().uuid().optional().describe('Filter by document'),
        limit: z.number().min(1).max(50).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ category, is_suspect, document_id, limit }) => {
      const sb = getSupabase();
      let q = sb.from('redactions').select('*, document:documents(id, bates_number, title)');
      if (category) q = q.eq('category', category);
      if (is_suspect !== undefined) q = q.eq('is_suspect', is_suspect);
      if (document_id) q = q.eq('document_id', document_id);
      q = q.limit(limit);
      const { data, error } = await q;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: safeJson({ count: data?.length ?? 0, redactions: data }) }] };
    },
  );

  // ── get_investigation_stats ─────────────────────────────────────────────────
  server.registerTool(
    'get_investigation_stats',
    {
      title: 'Get Investigation Stats',
      description:
        'Get current investigation statistics: document counts by status, entity counts by tier, dataset progress, etc.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sb = getSupabase();
      const [docsRes, entitiesRes, eventsRes, datasetsRes] = await Promise.all([
        sb.rpc('processing_queue_stats'),
        sb.from('entities').select('tier, id'),
        sb.from('events').select('id', { count: 'exact', head: true }),
        sb.from('datasets').select('id, name, document_count'),
      ]);

      // Count entities by tier
      const entityTiers: Record<number, number> = {};
      if (entitiesRes.data) {
        for (const e of entitiesRes.data) {
          entityTiers[e.tier] = (entityTiers[e.tier] || 0) + 1;
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: safeJson({
            processing_stats: docsRes.data,
            entity_count: entitiesRes.data?.length ?? 0,
            entities_by_tier: entityTiers,
            event_count: eventsRes.count ?? 0,
            datasets: datasetsRes.data ?? [],
          }),
        }],
      };
    },
  );

  // ── get_schema ───────────────────────────────────────────────────────────────
  server.registerTool(
    'get_schema',
    {
      title: 'Get Database Schema',
      description:
        'Return all tables and columns in the EFTA investigation database. Use this to understand the data model before constructing queries or debugging insert errors.',
      inputSchema: {
        table_name: z.string().optional().describe('Filter to a specific table. If omitted, returns all tables.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ table_name }) => {
      const sb = getSupabase();

      let query = sb
        .from('information_schema.columns' as any)
        .select('table_name, column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .order('table_name', { ascending: true })
        .order('ordinal_position', { ascending: true });

      if (table_name) {
        query = query.eq('table_name', table_name);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback: use raw SQL via rpc if information_schema isn't exposed via PostgREST
        const { data: rpcData, error: rpcError } = await sb.rpc('get_table_schema', {
          target_table: table_name ?? null,
        });

        if (rpcError) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: Could not query schema. information_schema error: ${error.message}. RPC fallback error: ${rpcError.message}\n\nYou may need to create an RPC function. See instructions in this file.`,
            }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: safeJson({ tables: rpcData }) }],
        };
      }

      // Group by table for readability
      const grouped: Record<string, any[]> = {};
      for (const col of (data ?? [])) {
        const t = (col as any).table_name;
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push({
          column: (col as any).column_name,
          type: (col as any).data_type,
          nullable: (col as any).is_nullable === 'YES',
          default: (col as any).column_default,
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: safeJson({
            table_count: Object.keys(grouped).length,
            tables: grouped,
          }),
        }],
      };
    },
  );

  // ── list_datasets ───────────────────────────────────────────────────────────
  server.registerTool(
    'list_datasets',
    {
      title: 'List Datasets',
      description: 'List all EFTA datasets with their document counts and metadata.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sb = getSupabase();
      const { data, error } = await sb.from('datasets').select('*').order('name');
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: safeJson({ datasets: data }) }] };
    },
  );

  // ===========================================================================
  // WRITE TOOLS — all require confirmation context in the description
  // ===========================================================================

  // ── create_entity ───────────────────────────────────────────────────────────
  server.registerTool(
    'create_entity',
    {
      title: 'Create Entity',
      description:
        'Add a new person to the EFTA entity database. Use during document review when a previously unknown individual is identified. ALWAYS confirm the tier assignment with the user before creating.',
      inputSchema: {
        name: z.string().describe('Full name'),
        tier: z.number().min(1).max(6).describe('Evidence tier (1=convicted/charged, 2=NPA immunity, 3=suspicious, 4=social contact, 5=victim/witness, 6=staff/legal)'),
        entity_type: z.enum(['person', 'organization']).default('person').describe('Entity type (person or organization)'),
        category: z.string().optional().describe('Category (e.g. inner_circle, associate, staff, victim, legal, law_enforcement)'),
        bio: z.string().optional().describe('Brief biographical note'),
        evidence_summary: z.string().optional().describe('Summary of evidence supporting tier assignment'),
        aliases: z.array(z.string()).optional().describe('Known aliases or alternate spellings'),
      },
    },
    async ({ name, tier, entity_type, category, bio, evidence_summary, aliases }) => {
      const sb = getSupabase();

      // Check for duplicates first
      const { data: existing } = await sb.from('entities').select('id, name, tier').ilike('name', `%${name}%`).limit(5);
      if (existing && existing.length > 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `⚠️ Possible duplicates found:\n${existing.map((e: any) => `  - ${e.name} (Tier ${e.tier}, ID: ${e.id})`).join('\n')}\n\nIf this is a new entity, call create_entity again with a more specific name. If it's an existing entity, use update_entity instead.`,
          }],
        };
      }

      const { data, error } = await sb.from('entities')
        .insert({
          name,
          tier,
          entity_type,
          category,
          bio,
          evidence_summary,
          aliases: aliases ?? [],
        })
        .select('id, name, tier')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Created entity: ${data.name} (Tier ${data.tier}) — ID: ${data.id}` }] };
    },
  );

  // ── update_entity ───────────────────────────────────────────────────────────
  server.registerTool(
    'update_entity',
    {
      title: 'Update Entity',
      description:
        'Update an existing entity record. Use to add evidence, update bio, or append aliases. Tier changes require explicit user confirmation.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID'),
        tier: z.number().min(1).max(6).optional().describe('New tier (confirm with user first!)'),
        category: z.string().optional(),
        bio: z.string().optional(),
        evidence_summary: z.string().optional().describe('Will REPLACE existing summary — include all evidence'),
        add_aliases: z.array(z.string()).optional().describe('Aliases to ADD to existing list'),
      },
    },
    async ({ entity_id, tier, category, bio, evidence_summary, add_aliases }) => {
      const sb = getSupabase();

      // Build update object, only including provided fields
      const update: Record<string, any> = {};
      if (tier !== undefined) update.tier = tier;
      if (category !== undefined) update.category = category;
      if (bio !== undefined) update.bio = bio;
      if (evidence_summary !== undefined) update.evidence_summary = evidence_summary;

      // Handle alias append
      if (add_aliases && add_aliases.length > 0) {
        const { data: current } = await sb.from('entities').select('aliases').eq('id', entity_id).single();
        const existing = (current?.aliases as string[]) ?? [];
        update.aliases = [...new Set([...existing, ...add_aliases])];
      }

      if (Object.keys(update).length === 0) {
        return { content: [{ type: 'text' as const, text: 'No fields to update' }] };
      }

      update.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('entities').update(update).eq('id', entity_id).select('id, name, tier').single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Updated entity: ${data.name} (Tier ${data.tier})` }] };
    },
  );

  // ── delete_entity ────────────────────────────────────────────────────────────
  server.registerTool(
    'delete_entity',
    {
      title: 'Delete Entity',
      description:
        'Delete an entity from the database. Also removes linked records (entity_documents, entity_events, connections, entity_evidence_items). Use with caution — this is a hard delete. ALWAYS confirm with the user before deleting.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID to delete'),
        confirm_name: z.string().describe('Entity name — must match the record as a safety check'),
      },
    },
    async ({ entity_id, confirm_name }) => {
      const sb = getSupabase();

      // Fetch the entity first to verify it exists and name matches
      const { data: entity, error: fetchError } = await sb
        .from('entities')
        .select('id, name, tier')
        .eq('id', entity_id)
        .single();

      if (fetchError || !entity) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Entity not found with ID ${entity_id}`,
          }],
        };
      }

      // Safety check: confirm_name must match
      if (entity.name.toLowerCase() !== confirm_name.toLowerCase()) {
        return {
          content: [{
            type: 'text' as const,
            text: `⚠️ Name mismatch. Entity name is "${entity.name}" but you provided "${confirm_name}". Delete aborted.`,
          }],
        };
      }

      // Remove linked records first (foreign key dependencies)
      const cleanups = await Promise.all([
        sb.from('entity_documents').delete().eq('entity_id', entity_id),
        sb.from('entity_events').delete().eq('entity_id', entity_id),
        sb.from('entity_evidence_items').delete().eq('entity_id', entity_id),
        sb.from('connections').delete().or(`source_entity_id.eq.${entity_id},target_entity_id.eq.${entity_id}`),
      ]);

      const cleanupErrors = cleanups.filter(r => r.error).map(r => r.error!.message);
      if (cleanupErrors.length > 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `⚠️ Errors cleaning up linked records: ${cleanupErrors.join('; ')}. Entity NOT deleted.`,
          }],
        };
      }

      // Delete the entity
      const { error: deleteError } = await sb
        .from('entities')
        .delete()
        .eq('id', entity_id);

      if (deleteError) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error deleting entity: ${deleteError.message}`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `🗑️ Deleted entity: "${entity.name}" (Tier ${entity.tier}, ID: ${entity_id}) and all linked records.`,
        }],
      };
    },
  );

  // ── create_document_record ──────────────────────────────────────────────────
  server.registerTool(
    'create_document_record',
    {
      title: 'Create Document Record',
      description:
        'Manually log a document to the database (for documents reviewed in chat that bypassed the upload pipeline). Sets processing_status to "reviewed".',
      inputSchema: {
        bates_number: z.string().describe('EFTA Bates number'),
        title: z.string().optional(),
        document_type: z.string().optional().describe('e.g. fbi_302, email, court_filing, prosecution_memo, photo'),
        date: z.string().optional().describe('Document date (ISO format)'),
        page_count: z.number().optional(),
        dataset_id: z.string().uuid().optional(),
        classification: z.enum(['high', 'medium', 'low']).optional(),
        classification_score: z.number().min(0).max(100).optional(),
        severity: z.string().optional(),
        review_notes: z.string().optional().describe('Analysis notes from review session'),
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('documents')
        .insert({
          ...params,
          processing_status: 'reviewed',
          reviewed_at: new Date().toISOString(),
        })
        .select('id, bates_number, title')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Document logged: ${data.bates_number} — ID: ${data.id}` }] };
    },
  );

  // ── update_document ─────────────────────────────────────────────────────────
  server.registerTool(
    'update_document',
    {
      title: 'Update Document',
      description: 'Update metadata or review notes on an existing document record.',
      inputSchema: {
        document_id: z.string().uuid().describe('Document UUID'),
        title: z.string().optional(),
        document_type: z.string().optional(),
        date: z.string().optional(),
        classification: z.enum(['high', 'medium', 'low']).optional(),
        classification_score: z.number().min(0).max(100).optional(),
        severity: z.string().optional(),
        processing_status: z.string().optional(),
        review_notes: z.string().optional(),
      },
    },
    async ({ document_id, ...updates }) => {
      const sb = getSupabase();
      const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(clean).length === 0) {
        return { content: [{ type: 'text' as const, text: 'No fields to update' }] };
      }
      (clean as any).updated_at = new Date().toISOString();
      const { data, error } = await sb.from('documents').update(clean).eq('id', document_id).select('id, bates_number, title').single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Updated: ${data.bates_number} — ${data.title ?? '(no title)'}` }] };
    },
  );

  // ── link_entity_to_document ─────────────────────────────────────────────────
  server.registerTool(
    'link_entity_to_document',
    {
      title: 'Link Entity to Document',
      description: 'Create an entity-document link with a role (author, recipient, subject, mentioned, etc.).',
      inputSchema: {
        entity_id: z.string().uuid(),
        document_id: z.string().uuid(),
        role: z.string().describe('Role in document: author, recipient, subject, mentioned, witness, victim, suspect'),
        notes: z.string().optional(),
      },
    },
    async ({ entity_id, document_id, role, notes }) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('entity_documents')
        .insert({ entity_id, document_id, role, notes })
        .select('id')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Linked entity to document (role: ${role})` }] };
    },
  );

  // ── create_event ────────────────────────────────────────────────────────────
  server.registerTool(
    'create_event',
    {
      title: 'Create Event',
      description:
        'Add a timeline event to the investigation. Link entities to the event after creation using link_entity_to_event.',
      inputSchema: {
        title: z.string().describe('Brief event title'),
        description: z.string().optional().describe('Detailed description with evidence references'),
        date: z.string().describe('Event date (ISO format, can be approximate: 2003-01-01)'),
        date_precision: z.enum(['exact', 'month', 'year', 'approximate']).default('exact'),
        event_type: z.string().optional().describe('e.g. meeting, flight, payment, legal, communication, abuse'),
        location: z.string().optional(),
        source_document_id: z.string().uuid().optional().describe('Document that evidences this event'),
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('events')
        .insert(params)
        .select('id, title, date')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Event created: "${data.title}" (${data.date}) — ID: ${data.id}` }] };
    },
  );

  // ── link_entity_to_event ────────────────────────────────────────────────────
  server.registerTool(
    'link_entity_to_event',
    {
      title: 'Link Entity to Event',
      description: 'Link one or more entities to a timeline event.',
      inputSchema: {
        event_id: z.string().uuid(),
        entity_ids: z.array(z.string().uuid()).describe('One or more entity UUIDs to link'),
      },
    },
    async ({ event_id, entity_ids }) => {
      const sb = getSupabase();
      const rows = entity_ids.map(eid => ({ entity_id: eid, event_id }));
      const { error } = await sb.from('entity_events').insert(rows);
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Linked ${entity_ids.length} entities to event` }] };
    },
  );

  // ── create_connection ───────────────────────────────────────────────────────
  server.registerTool(
    'create_connection',
    {
      title: 'Create Connection',
      description:
        'Create a relationship between two entities (e.g. associate, employer, co_conspirator, family, legal_representation).',
      inputSchema: {
        source_entity_id: z.string().uuid(),
        target_entity_id: z.string().uuid(),
        connection_type: z.string().describe('e.g. associate, employer, co_conspirator, family, legal_representation, financial'),
        description: z.string().optional(),
        strength: z.number().min(0).max(100).optional().describe('Connection strength (0-100)'),
        evidence: z.string().optional().describe('Evidence supporting this connection'),
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('connections')
        .insert(params)
        .select('id')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Connection created — ID: ${data.id}` }] };
    },
  );

  // ── create_redaction_record ─────────────────────────────────────────────────
  server.registerTool(
    'create_redaction_record',
    {
      title: 'Create Redaction Record',
      description:
        'Log a redaction finding from document review. Use the A-D framework: A=victim protection, B=legal privilege, C=institutional protection (suspect), D=perpetrator protection (suspect).',
      inputSchema: {
        document_id: z.string().uuid(),
        page_number: z.number().optional(),
        category: z.enum(['A', 'B', 'C', 'D']).describe('Redaction category'),
        is_suspect: z.boolean().default(false),
        description: z.string().optional().describe('What appears to be redacted and why the category was assigned'),
        red_flags: z.array(z.string()).optional().describe('Red flag codes (e.g. RF-1 through RF-10)'),
        nearby_entities: z.array(z.string()).optional().describe('Entity names near the redaction'),
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('redactions')
        .insert(params)
        .select('id')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `✅ Redaction logged (Category ${params.category}${params.is_suspect ? ', SUSPECT' : ''}) — ID: ${data.id}` }] };
    },
  );

  // ── create_evidence_item ────────────────────────────────────────────────────
  server.registerTool(
    'create_evidence_item',
    {
      title: 'Create Evidence Item',
      description:
        'Log a specific piece of evidence extracted from a document. Links to a document and optionally to entities.',
      inputSchema: {
        document_id: z.string().uuid(),
        evidence_type: z.enum(['primary', 'corroborating', 'contradictory', 'timeline']).describe('Evidence classification'),
        title: z.string().describe('Brief evidence title'),
        description: z.string().describe('What this evidence establishes'),
        significance: z.enum(['high', 'medium', 'low']).default('medium'),
        entity_ids: z.array(z.string().uuid()).optional().describe('Entities this evidence relates to'),
      },
    },
    async ({ entity_ids, ...params }) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('evidence_items')
        .insert(params)
        .select('id')
        .single();
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      // Link entities if provided
      if (entity_ids && entity_ids.length > 0) {
        const rows = entity_ids.map(eid => ({ entity_id: eid, evidence_item_id: data.id }));
        await sb.from('entity_evidence_items').insert(rows);
      }

      return { content: [{ type: 'text' as const, text: `✅ Evidence item created (${params.evidence_type}, ${params.significance}) — ID: ${data.id}` }] };
    },
  );
}
