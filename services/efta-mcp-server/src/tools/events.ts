import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

export function registerEventTools(server: McpServer) {

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
        const q = sb.from('entity_events')
          .select('*, event:events(*)', { count: 'exact' })
          .eq('entity_id', entity_id);
        const { data, error, count: total } = await q.limit(limit);
        if (error) return errorResponse(error.message);
        const events = (data ?? []).map((r: Record<string, unknown>) => r.event).filter(Boolean);
        return toolResponse({
          success: true,
          count: events.length,
          total_count: total ?? undefined,
          data: events,
        });
      }

      let q = sb.from('events').select('*', { count: 'exact' });
      if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      if (after) q = q.gte('date', after);
      if (before) q = q.lte('date', before);
      q = q.order('date', { ascending: true }).limit(limit);
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
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Event created: "${data.title}" (${data.date})`,
      });
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
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        count: entity_ids.length,
        message: `Linked ${entity_ids.length} entities to event`,
      });
    },
  );
}
