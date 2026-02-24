import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

export function registerLinkTools(server: McpServer) {

  // ── link_entity_to_document ─────────────────────────────────────────────────
  server.registerTool(
    'link_entity_to_document',
    {
      title: 'Link Entity to Document',
      description:
        'Create an entity-document link with a role. Uses upsert — safe to call multiple times for the same entity+document+role combination.',
      inputSchema: {
        entity_id: z.string().uuid(),
        document_id: z.string().uuid(),
        role: z.string().describe('Role in document: subject, mentioned, author, recipient, witness, photographer, attorney'),
        notes: z.string().optional().describe('Relevant excerpt or notes'),
      },
    },
    async ({ entity_id, document_id, role, notes }) => {
      const sb = getSupabase();
      // ENHANCED: Upsert on (entity_id, document_id, role_in_document) UNIQUE constraint
      const { data, error } = await sb.from('entity_documents')
        .upsert(
          { entity_id, document_id, role_in_document: role, excerpt: notes },
          { onConflict: 'entity_id,document_id,role_in_document' }
        )
        .select('id')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        message: `Linked entity to document (role: ${role})`,
      });
    },
  );

  // ── batch_link_entities_to_document ─────────────────────────────────────────
  server.registerTool(
    'batch_link_entities_to_document',
    {
      title: 'Batch Link Entities to Document',
      description:
        'Link multiple entities to a single document in one call. Uses upsert — safe to call multiple times.',
      inputSchema: {
        document_id: z.string().uuid().describe('Document UUID'),
        links: z.array(z.object({
          entity_id: z.string().uuid(),
          role: z.string().describe('Role: subject, mentioned, author, recipient, witness, photographer, attorney'),
          notes: z.string().optional(),
        })).min(1).describe('Array of entity links to create'),
      },
    },
    async ({ document_id, links }) => {
      const sb = getSupabase();
      const rows = links.map(l => ({
        entity_id: l.entity_id,
        document_id,
        role_in_document: l.role,
        excerpt: l.notes,
      }));

      const { data, error } = await sb.from('entity_documents')
        .upsert(rows, { onConflict: 'entity_id,document_id,role_in_document' })
        .select('id');
      if (error) return errorResponse(error.message);

      return toolResponse({
        success: true,
        count: data?.length ?? 0,
        data: data ?? [],
        message: `Linked ${data?.length ?? 0} entities to document`,
      });
    },
  );

  // ── unlink_entity_from_document ───────────────────────────────────────────
  server.registerTool(
    'unlink_entity_from_document',
    {
      title: 'Unlink Entity from Document',
      description:
        'Remove an entity-document link. Specify entity_id + document_id, optionally with role to remove only a specific role.',
      inputSchema: {
        entity_id: z.string().uuid(),
        document_id: z.string().uuid(),
        role: z.string().optional().describe('If provided, only remove this specific role link. Otherwise removes all roles for this entity-document pair.'),
      },
    },
    async ({ entity_id, document_id, role }) => {
      const sb = getSupabase();
      let q = sb.from('entity_documents')
        .delete()
        .eq('entity_id', entity_id)
        .eq('document_id', document_id);
      if (role) q = q.eq('role_in_document', role);
      const { data, error } = await q.select('id');
      if (error) return errorResponse(error.message);
      const count = data?.length ?? 0;
      if (count === 0) return errorResponse('No matching link found');
      return toolResponse({
        success: true,
        count,
        message: `Removed ${count} entity-document link(s)`,
      });
    },
  );

  // ── unlink_entity_from_event ──────────────────────────────────────────────
  server.registerTool(
    'unlink_entity_from_event',
    {
      title: 'Unlink Entity from Event',
      description: 'Remove an entity-event link.',
      inputSchema: {
        entity_id: z.string().uuid(),
        event_id: z.string().uuid(),
      },
    },
    async ({ entity_id, event_id }) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('entity_events')
        .delete()
        .eq('entity_id', entity_id)
        .eq('event_id', event_id)
        .select('entity_id');
      if (error) return errorResponse(error.message);
      if (!data || data.length === 0) return errorResponse('No matching link found');
      return toolResponse({
        success: true,
        message: 'Entity-event link removed',
      });
    },
  );
}
