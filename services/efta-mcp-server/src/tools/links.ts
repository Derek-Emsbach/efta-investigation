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
}
