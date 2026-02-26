import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';
import { getDocumentText } from '../r2.js';

export function registerDocumentTools(server: McpServer) {

  // ── search_documents ────────────────────────────────────────────────────────
  server.registerTool(
    'search_documents',
    {
      title: 'Search Documents',
      description:
        'Search EFTA documents by Bates number, title, full-text content, type, dataset, or processing status. 1.37M+ documents in the database.',
      inputSchema: {
        query: z.string().optional().describe('Search term (searches bates_number, title, and full-text)'),
        document_type: z.string().optional().describe('Filter by type (e.g. fbi_302, email, court_filing, prosecution_memo)'),
        dataset_id: z.string().optional().describe('Filter by dataset UUID'),
        processing_status: z.string().optional().describe('Filter by status (reviewed, needs_review, extracted, etc.)'),
        classification: z.enum(['high', 'medium', 'low']).optional().describe('Filter by classification level'),
        summary: z.boolean().optional().describe('If true, return only id, bates_number, title, document_type, processing_status, classification'),
        limit: z.number().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, document_type, dataset_id, processing_status, classification, summary, limit }) => {
      const sb = getSupabase();
      const cols = summary
        ? 'id, bates_number, title, document_type, processing_status, classification'
        : 'id, bates_number, title, document_type, original_date, page_count, processing_status, classification, severity, dataset_id, extracted_text';

      // Use estimated count for 1.37M row table
      let q = sb.from('documents').select(cols, { count: 'estimated' });

      if (query) {
        // Check if query looks like a Bates number pattern
        const isBatesQuery = /^EFTA\d/i.test(query);
        if (isBatesQuery) {
          q = q.ilike('bates_number', `%${query}%`);
        } else {
          // Try FTS via search_vector first
          const ftsQ = sb.from('documents').select(cols, { count: 'estimated' })
            .textSearch('search_vector', query, { type: 'plain' });
          if (document_type) ftsQ.eq('document_type', document_type);
          if (dataset_id) ftsQ.eq('dataset_id', dataset_id);
          if (processing_status) ftsQ.eq('processing_status', processing_status);
          if (classification) ftsQ.eq('classification', classification);
          const ftsResult = await ftsQ.order('bates_number', { ascending: true }).limit(limit);

          if (!ftsResult.error && ftsResult.data && ftsResult.data.length > 0) {
            return toolResponse({
              success: true,
              count: ftsResult.data.length,
              total_count: ftsResult.count ?? undefined,
              data: ftsResult.data,
              message: `Found ${ftsResult.data.length} documents (FTS match, ~${ftsResult.count ?? '?'} total)`,
            });
          }
          // Fall back to ilike
          q = q.or(`bates_number.ilike.%${query}%,title.ilike.%${query}%,extracted_text.ilike.%${query}%`);
        }
      }

      if (document_type) q = q.eq('document_type', document_type);
      if (dataset_id) q = q.eq('dataset_id', dataset_id);
      if (processing_status) q = q.eq('processing_status', processing_status);
      if (classification) q = q.eq('classification', classification);
      q = q.order('bates_number', { ascending: true }).limit(limit);

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

  // ── get_document ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_document',
    {
      title: 'Get Document Details',
      description:
        'Get full metadata for a document by ID or Bates number, including linked entities and redactions.',
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
      else return errorResponse('Provide either id or bates_number');

      const { data: doc, error } = await docQuery.single();
      if (error) return errorResponse(error.message);

      // FIX: Removed document_cross_references query (table does not exist)
      const [entitiesRes, redactionsRes] = await Promise.all([
        sb.from('entity_documents').select('*, entity:entities(id, name, tier, category)').eq('document_id', doc.id),
        sb.from('redactions').select('*').eq('document_id', doc.id),
      ]);

      return toolResponse({
        success: true,
        id: doc.id,
        data: {
          document: doc,
          entities: entitiesRes.data ?? [],
          redactions: redactionsRes.data ?? [],
        },
      });
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
        return errorResponse(`No full text found for ${bates_number}`);
      }
      const maxLen = 30000;
      const truncated = text.length > maxLen;
      const output = truncated ? text.slice(0, maxLen) : text;
      // Return raw text with truncation metadata — bypasses safeJson for large text
      return {
        content: [{
          type: 'text' as const,
          text: output + (truncated
            ? `\n\n[TRUNCATION_INFO: ${JSON.stringify({ truncated: true, shown_chars: maxLen, total_chars: text.length })}]`
            : `\n\n[TEXT_INFO: ${JSON.stringify({ truncated: false, total_chars: text.length })}]`),
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
        severity: z.string().optional(),
        summary: z.string().optional().describe('Brief document summary'),
        review_notes: z.string().optional().describe('Analysis notes from review session'),
      },
    },
    async ({ date, ...rest }) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('documents')
        .insert({
          ...rest,
          ...(date ? { original_date: date } : {}),
          processing_status: 'reviewed',
          reviewed_at: new Date().toISOString(),
        })
        .select('id, bates_number, title')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Document logged: ${data.bates_number}`,
      });
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
        severity: z.string().optional(),
        summary: z.string().optional().describe('Brief document summary'),
        processing_status: z.string().optional(),
        review_notes: z.string().optional(),
      },
    },
    async ({ document_id, date, ...updates }) => {
      const sb = getSupabase();
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) clean[k] = v;
      }
      if (date !== undefined) clean.original_date = date;
      if (Object.keys(clean).length === 0) {
        return toolResponse({ success: false, message: 'No fields to update' });
      }
      clean.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('documents').update(clean).eq('id', document_id).select('id, bates_number, title').single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Updated: ${data.bates_number} — ${data.title ?? '(no title)'}`,
      });
    },
  );
}
