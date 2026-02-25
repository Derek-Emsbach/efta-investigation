import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

export function registerRedactionTools(server: McpServer) {

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
      let q = sb.from('redactions').select('*, document:documents(id, bates_number, title)', { count: 'exact' });
      if (category) q = q.eq('category', category);
      if (is_suspect !== undefined) q = q.eq('is_suspect', is_suspect);
      if (document_id) q = q.eq('document_id', document_id);
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
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('redactions')
        .insert(params)
        .select('id')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        message: `Redaction logged (Category ${params.category}${params.is_suspect ? ', SUSPECT' : ''})`,
      });
    },
  );

  // ── create_evidence_item ────────────────────────────────────────────────────
  server.registerTool(
    'create_evidence_item',
    {
      title: 'Create Evidence Item',
      description:
        'Log a specific piece of evidence extracted from a document. Links to a document and optionally to an entity via the entity_id column on evidence_items.',
      inputSchema: {
        document_id: z.string().uuid(),
        entity_id: z.string().uuid().optional().describe('Entity this evidence relates to (direct FK on evidence_items)'),
        evidence_type: z.enum(['primary', 'corroborating', 'contradictory', 'timeline']).describe('Evidence classification'),
        description: z.string().describe('What this evidence establishes'),
        significance: z.enum(['high', 'medium', 'low']).default('medium'),
      },
    },
    async ({ document_id, entity_id, evidence_type, description, significance }) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('evidence_items')
        .insert({
          document_id,
          entity_id,
          evidence_type,
          description,
          category: evidence_type,
          strength: significance === 'high' ? 'strong' : significance === 'medium' ? 'moderate' : 'weak',
        })
        .select('id')
        .single();
      if (error) return errorResponse(error.message);
      const preview = description.length > 60 ? description.slice(0, 57) + '...' : description;
      return toolResponse({
        success: true,
        id: data.id,
        message: `Evidence item created: "${preview}" (${evidence_type}, ${significance})`,
      });
    },
  );
}
