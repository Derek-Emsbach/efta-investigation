import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

export function registerConnectionTools(server: McpServer) {

  // ── find_connections ────────────────────────────────────────────────────────
  server.registerTool(
    'find_connections',
    {
      title: 'Find Connections',
      description:
        'Find connections (relationships) between entities. Can search by entity, relationship type, or minimum strength. Table: entity_connections with entity_a/entity_b columns.',
      inputSchema: {
        entity_id: z.string().uuid().optional().describe('Find connections involving this entity'),
        relationship_type: z.string().optional().describe('Filter by type (e.g. employed_by, trafficked_by, connected_to, family_of, attorney_for)'),
        min_strength: z.number().min(0).max(100).optional().describe('Minimum connection strength (0-100)'),
        limit: z.number().min(1).max(50).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id, relationship_type, min_strength, limit }) => {
      const sb = getSupabase();

      if (entity_id) {
        // FIX: Query both directions of entity_connections
        let qA = sb.from('entity_connections')
          .select('*, connected:entities!entity_b(id, name, tier, category)', { count: 'exact' })
          .eq('entity_a', entity_id);
        let qB = sb.from('entity_connections')
          .select('*, connected:entities!entity_a(id, name, tier, category)', { count: 'exact' })
          .eq('entity_b', entity_id);

        if (relationship_type) {
          qA = qA.eq('relationship_type', relationship_type);
          qB = qB.eq('relationship_type', relationship_type);
        }
        if (min_strength) {
          qA = qA.gte('strength', min_strength);
          qB = qB.gte('strength', min_strength);
        }

        const [aRes, bRes] = await Promise.all([
          qA.limit(limit),
          qB.limit(limit),
        ]);

        const connections = [
          ...(aRes.data ?? []),
          ...(bRes.data ?? []),
        ];
        const totalCount = (aRes.count ?? 0) + (bRes.count ?? 0);

        return toolResponse({
          success: true,
          count: connections.length,
          total_count: totalCount,
          data: connections,
        });
      }

      // No entity filter — query all connections
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = sb.from('entity_connections')
        .select('*, entity_a_detail:entities!entity_a(id, name, tier), entity_b_detail:entities!entity_b(id, name, tier)', { count: 'exact' });
      if (relationship_type) q = q.eq('relationship_type', relationship_type);
      if (min_strength) q = q.gte('strength', min_strength);
      q = q.limit(limit);

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

  // ── create_connection ───────────────────────────────────────────────────────
  server.registerTool(
    'create_connection',
    {
      title: 'Create Connection',
      description:
        'Create a relationship between two entities. Uses entity_connections table with entity_a/entity_b columns.',
      inputSchema: {
        source_entity_id: z.string().uuid().describe('Source entity UUID (entity_a)'),
        target_entity_id: z.string().uuid().describe('Target entity UUID (entity_b)'),
        relationship_type: z.string().describe('e.g. employed_by, trafficked_by, connected_to, family_of, attorney_for, hired_by, paid_by'),
        description: z.string().optional(),
        strength: z.number().min(0).max(100).optional().describe('Connection strength (0-100)'),
        evidence_strength: z.enum(['documented', 'alleged', 'circumstantial']).optional().describe('Evidence quality classification'),
        source_document_ids: z.array(z.string().uuid()).optional().describe('Supporting document UUIDs'),
        start_date: z.string().optional().describe('Relationship start date (ISO)'),
        end_date: z.string().optional().describe('Relationship end date (ISO)'),
      },
    },
    async ({ source_entity_id, target_entity_id, relationship_type, description, strength, evidence_strength, source_document_ids, start_date, end_date }) => {
      const sb = getSupabase();
      // FIX: Map to correct column names (entity_a/entity_b, not source_entity_id/target_entity_id)
      const { data, error } = await sb.from('entity_connections')
        .insert({
          entity_a: source_entity_id,
          entity_b: target_entity_id,
          relationship_type,
          description,
          strength,
          evidence_strength,
          source_document_ids: source_document_ids ?? [],
          start_date,
          end_date,
        })
        .select('id')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        message: `Connection created: ${relationship_type}`,
      });
    },
  );
}
