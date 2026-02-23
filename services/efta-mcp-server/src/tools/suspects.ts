import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

const SUSPECT_STATUS = [
  'confirmed_co_conspirator',
  'suspect',
  'watchlist',
  'possible_suspect',
  'watch',
  'deprioritized',
] as const;

const SUSPECT_PRIORITY = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;

export function registerSuspectTools(server: McpServer) {

  // ── search_suspects ─────────────────────────────────────────────────────────
  server.registerTool(
    'search_suspects',
    {
      title: 'Search Suspect Watchlist',
      description:
        'Search the suspect watchlist by name, status, priority, or category. Returns persons of interest being tracked before promotion to full entities.',
      inputSchema: {
        query: z.string().optional().describe('Name or keyword to search for'),
        status: z.enum(SUSPECT_STATUS).optional().describe('Filter by status'),
        priority: z.enum(SUSPECT_PRIORITY).optional().describe('Filter by priority (P1=urgent, P5=low)'),
        category: z.string().optional().describe('Filter by category (accused_abuser, inner_circle, political, financial, operational, media)'),
        db_status: z.enum(['not_in_db', 'pending_promotion', 'in_db']).optional().describe('Filter by database promotion status'),
        summary: z.boolean().optional().describe('If true, return only id, name, status, priority, category, db_status'),
        limit: z.number().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, status, priority, category, db_status, summary, limit }) => {
      const sb = getSupabase();
      const cols = summary
        ? 'id, name, status, priority, category, db_status'
        : '*';
      let q = sb.from('suspect_watchlist').select(cols, { count: 'exact' });

      if (query) {
        // Try FTS first
        const ftsQ = sb.from('suspect_watchlist').select(cols, { count: 'exact' })
          .textSearch('search_vector', query, { type: 'plain' });
        if (status) ftsQ.eq('status', status);
        if (priority) ftsQ.eq('priority', priority);
        if (category) ftsQ.eq('category', category);
        if (db_status) ftsQ.eq('db_status', db_status);
        const ftsResult = await ftsQ.order('created_at', { ascending: false }).limit(limit);

        if (!ftsResult.error && ftsResult.data && ftsResult.data.length > 0) {
          return toolResponse({
            success: true,
            count: ftsResult.data.length,
            total_count: ftsResult.count ?? undefined,
            data: ftsResult.data,
            message: `Found ${ftsResult.count ?? ftsResult.data.length} suspects (FTS match)`,
          });
        }
        // Fall back to ilike on name + aliases
        q = q.or(`name.ilike.%${query}%,aliases.cs.{${query}}`);
      }

      if (status) q = q.eq('status', status);
      if (priority) q = q.eq('priority', priority);
      if (category) q = q.eq('category', category);
      if (db_status) q = q.eq('db_status', db_status);
      q = q.order('created_at', { ascending: false }).limit(limit);

      const { data, error, count: total } = await q;
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        count: data?.length ?? 0,
        total_count: total ?? undefined,
        data: data ?? [],
      });
    },
  );

  // ── create_suspect ──────────────────────────────────────────────────────────
  server.registerTool(
    'create_suspect',
    {
      title: 'Create Suspect',
      description:
        'Add a new person to the suspect watchlist. Always check for duplicates against both suspects and entities first using lookup_person.',
      inputSchema: {
        name: z.string().describe('Full name'),
        status: z.enum(SUSPECT_STATUS).default('watchlist').describe('Investigation status'),
        priority: z.enum(SUSPECT_PRIORITY).optional().describe('Investigation priority (P1=drop everything, P5=note if encountered)'),
        category: z.string().optional().describe('Category: accused_abuser, inner_circle, political, financial, operational, media'),
        public_sources: z.string().optional().describe('WHERE the suspicion comes from (external evidence basis)'),
        known_connections: z.string().optional().describe('Known relationships for context'),
        cross_references: z.string().optional().describe('Where to look in EFTA docs'),
        aliases: z.array(z.string()).optional().describe('Known aliases or alternate spellings'),
        known_associates: z.array(z.string()).optional().describe('Names of known associates'),
        first_seen_document_id: z.string().uuid().optional().describe('Document where this person was first identified'),
        notes: z.string().optional().describe('Internal analysis notes'),
        metadata: z.record(z.unknown()).optional(),
      },
    },
    async ({ name, status, priority, category, public_sources, known_connections, cross_references, aliases, known_associates, first_seen_document_id, notes, metadata }) => {
      const sb = getSupabase();

      // Check for duplicates in both suspects and entities
      const [suspectDups, entityDups] = await Promise.all([
        sb.from('suspect_watchlist').select('id, name, status, priority').ilike('name', `%${name}%`).limit(5),
        sb.from('entities').select('id, name, tier').ilike('name', `%${name}%`).limit(5),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dupes: any[] = [
        ...(suspectDups.data ?? []).map((s: any) => ({ source: 'suspect', ...s })),
        ...(entityDups.data ?? []).map((e: any) => ({ source: 'entity', ...e })),
      ];

      if (dupes.length > 0) {
        return toolResponse({
          success: false,
          data: dupes,
          message: `Possible duplicates found: ${dupes.map((d: any) => `[${d.source}] ${d.name}`).join(', ')}. Use update_suspect or update_entity instead, or call create_suspect again with a more specific name.`,
        });
      }

      const { data, error } = await sb.from('suspect_watchlist')
        .insert({
          name,
          status,
          priority,
          category,
          public_sources,
          known_connections,
          cross_references,
          aliases: aliases ?? [],
          known_associates: known_associates ?? [],
          first_seen_document_id,
          notes,
          metadata: metadata ?? {},
        })
        .select('id, name, status, priority')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Created suspect: ${data.name} (${data.status}, ${data.priority ?? 'no priority'})`,
      });
    },
  );

  // ── update_suspect ──────────────────────────────────────────────────────────
  server.registerTool(
    'update_suspect',
    {
      title: 'Update Suspect',
      description:
        'Update an existing suspect watchlist entry. Can update any field including status, priority, and db_status.',
      inputSchema: {
        suspect_id: z.string().uuid().describe('Suspect UUID'),
        status: z.enum(SUSPECT_STATUS).optional(),
        priority: z.enum(SUSPECT_PRIORITY).optional(),
        category: z.string().optional(),
        public_sources: z.string().optional(),
        known_connections: z.string().optional(),
        cross_references: z.string().optional(),
        db_status: z.enum(['not_in_db', 'pending_promotion', 'in_db']).optional(),
        notes: z.string().optional(),
        add_aliases: z.array(z.string()).optional().describe('Aliases to ADD to existing list'),
        add_associates: z.array(z.string()).optional().describe('Associates to ADD to existing list'),
      },
    },
    async ({ suspect_id, add_aliases, add_associates, ...fields }) => {
      const sb = getSupabase();

      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) update[k] = v;
      }

      // Handle array appends
      if ((add_aliases && add_aliases.length > 0) || (add_associates && add_associates.length > 0)) {
        const { data: current } = await sb.from('suspect_watchlist')
          .select('aliases, known_associates')
          .eq('id', suspect_id).single();
        if (current) {
          if (add_aliases && add_aliases.length > 0) {
            const existing = (current.aliases as string[]) ?? [];
            update.aliases = [...new Set([...existing, ...add_aliases])];
          }
          if (add_associates && add_associates.length > 0) {
            const existing = (current.known_associates as string[]) ?? [];
            update.known_associates = [...new Set([...existing, ...add_associates])];
          }
        }
      }

      if (Object.keys(update).length === 0) {
        return toolResponse({ success: false, message: 'No fields to update' });
      }

      const { data, error } = await sb.from('suspect_watchlist')
        .update(update)
        .eq('id', suspect_id)
        .select('id, name, status, priority, db_status')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Updated suspect: ${data.name}`,
      });
    },
  );

  // ── promote_suspect ─────────────────────────────────────────────────────────
  server.registerTool(
    'promote_suspect',
    {
      title: 'Promote Suspect to Entity',
      description:
        'Convert a suspect watchlist entry into a full entity in the entities table. Carries over name, aliases, and compiles public_sources + known_connections + notes into evidence_summary. Status stays unchanged (reflects public evidence, not promotion).',
      inputSchema: {
        suspect_id: z.string().uuid().describe('Suspect UUID to promote'),
        tier: z.number().min(1).max(6).describe('Entity tier to assign (1-6)'),
        entity_type: z.enum(['person', 'organization']).default('person'),
        category: z.string().optional().describe('Override category (defaults to suspect category)'),
        bio: z.string().optional().describe('Entity bio'),
      },
    },
    async ({ suspect_id, tier, entity_type, category: categoryOverride, bio }) => {
      const sb = getSupabase();

      // Fetch suspect
      const { data: suspect, error: fetchErr } = await sb.from('suspect_watchlist')
        .select('*')
        .eq('id', suspect_id)
        .single();
      if (fetchErr || !suspect) return errorResponse(`Suspect not found: ${suspect_id}`);
      if (suspect.db_status === 'in_db') {
        return toolResponse({
          success: false,
          message: `Suspect "${suspect.name}" is already promoted (entity_id: ${suspect.entity_id})`,
        });
      }

      // Check for duplicate entity
      const { data: existingEntity } = await sb.from('entities').select('id, name').ilike('name', suspect.name).limit(1);
      if (existingEntity && existingEntity.length > 0) {
        return toolResponse({
          success: false,
          data: existingEntity,
          message: `Entity "${existingEntity[0].name}" already exists (ID: ${existingEntity[0].id}). Link the suspect instead of creating a duplicate.`,
        });
      }

      // Build evidence summary from suspect fields
      const summaryParts: string[] = [];
      if (suspect.public_sources) summaryParts.push(`Public Sources: ${suspect.public_sources}`);
      if (suspect.known_connections) summaryParts.push(`Known Connections: ${suspect.known_connections}`);
      if (suspect.notes) summaryParts.push(`Investigation Notes: ${suspect.notes}`);
      if (suspect.cross_references) summaryParts.push(`Cross References: ${suspect.cross_references}`);
      const evidence_summary = summaryParts.length > 0 ? summaryParts.join('\n\n') : null;

      // Create entity
      const { data: entity, error: createErr } = await sb.from('entities')
        .insert({
          name: suspect.name,
          entity_type,
          tier,
          category: categoryOverride ?? suspect.category,
          bio,
          evidence_summary,
          aliases: suspect.aliases ?? [],
        })
        .select('id, name, tier')
        .single();
      if (createErr) return errorResponse(`Failed to create entity: ${createErr.message}`);

      // Update suspect: set db_status and entity_id (status stays unchanged)
      const { error: updateErr } = await sb.from('suspect_watchlist')
        .update({
          db_status: 'in_db',
          entity_id: entity.id,
        })
        .eq('id', suspect_id);
      if (updateErr) {
        // Entity was created but suspect update failed — log for manual reconciliation
        return toolResponse({
          success: true,
          id: entity.id,
          data: entity,
          message: `Entity created (ID: ${entity.id}) but suspect update failed: ${updateErr.message}. Manually set suspect db_status='in_db' and entity_id='${entity.id}'.`,
        });
      }

      return toolResponse({
        success: true,
        id: entity.id,
        data: { entity, suspect_id },
        message: `Promoted "${suspect.name}" to entity (Tier ${tier}, ID: ${entity.id}). Suspect db_status set to 'in_db'.`,
      });
    },
  );

  // ── delete_suspect ──────────────────────────────────────────────────────────
  server.registerTool(
    'delete_suspect',
    {
      title: 'Delete Suspect',
      description:
        'Soft-delete (set status to deprioritized) or hard-delete a suspect from the watchlist. Refuses to delete suspects that are already promoted to entities.',
      inputSchema: {
        suspect_id: z.string().uuid().describe('Suspect UUID'),
        hard_delete: z.boolean().default(false).describe('If true, permanently removes the record. Default: soft-delete (status=deprioritized)'),
      },
    },
    async ({ suspect_id, hard_delete }) => {
      const sb = getSupabase();

      // Verify suspect exists and check promotion status
      const { data: suspect, error: fetchErr } = await sb.from('suspect_watchlist')
        .select('id, name, status, db_status, entity_id')
        .eq('id', suspect_id)
        .single();
      if (fetchErr || !suspect) return errorResponse(`Suspect not found: ${suspect_id}`);

      if (suspect.db_status === 'in_db') {
        return toolResponse({
          success: false,
          message: `Cannot delete "${suspect.name}" — already promoted to entity (ID: ${suspect.entity_id}). Delete the entity first if needed.`,
        });
      }

      if (hard_delete) {
        const { error } = await sb.from('suspect_watchlist').delete().eq('id', suspect_id);
        if (error) return errorResponse(error.message);
        return toolResponse({
          success: true,
          id: suspect_id,
          message: `Permanently deleted suspect: "${suspect.name}"`,
        });
      } else {
        const { data, error } = await sb.from('suspect_watchlist')
          .update({ status: 'deprioritized' })
          .eq('id', suspect_id)
          .select('id, name, status')
          .single();
        if (error) return errorResponse(error.message);
        return toolResponse({
          success: true,
          id: data.id,
          data,
          message: `Soft-deleted suspect: "${data.name}" (status set to deprioritized)`,
        });
      }
    },
  );
}
