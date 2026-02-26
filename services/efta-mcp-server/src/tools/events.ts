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
        date_precision: z.enum(['day', 'month', 'year', 'approximate']).default('day'),
        event_type: z.enum(['legal', 'evidence', 'communication', 'institutional', 'personal', 'financial', 'legislative', 'travel', 'sighting']).optional(),
        location: z.string().optional().describe('Location name (stored in metadata, not as FK — use location_id for linked locations)'),
        source_document_id: z.string().uuid().optional().describe('Document that evidences this event (stored in metadata, not as FK)'),
      },
    },
    async ({ source_document_id, location, ...rest }) => {
      const sb = getSupabase();
      // location and source_document_id have no backing columns — store in metadata
      const metadata: Record<string, unknown> = {};
      if (location) metadata.location = location;
      if (source_document_id) metadata.source_document_id = source_document_id;
      const { data, error } = await sb.from('events')
        .insert({ ...rest, ...(Object.keys(metadata).length > 0 ? { metadata } : {}) })
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

  // ── update_event ──────────────────────────────────────────────────────────
  server.registerTool(
    'update_event',
    {
      title: 'Update Event',
      description:
        'Update an investigation timeline event. Pass only the fields you want to change.',
      inputSchema: {
        event_id: z.string().uuid().describe('Event UUID to update'),
        title: z.string().optional().describe('Updated title'),
        description: z.string().optional().describe('Updated description'),
        date: z.string().optional().describe('Corrected date (ISO format)'),
        date_precision: z.enum(['day', 'month', 'year', 'approximate']).optional(),
        event_type: z.enum(['legal', 'evidence', 'communication', 'institutional', 'personal', 'financial', 'legislative', 'travel', 'sighting']).optional(),
        location: z.string().optional().describe('Updated location (stored in metadata)'),
        significance: z.string().optional().describe('Updated significance assessment'),
      },
    },
    async ({ event_id, location, ...fields }) => {
      const sb = getSupabase();
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) update[k] = v;
      }
      if (location !== undefined) {
        const { data: current } = await sb.from('events').select('metadata').eq('id', event_id).single();
        const existingMeta = (current?.metadata as Record<string, unknown>) ?? {};
        update.metadata = { ...existingMeta, location };
      }
      if (Object.keys(update).length === 0) {
        return errorResponse('No fields to update');
      }
      const { data, error } = await sb.from('events')
        .update(update)
        .eq('id', event_id)
        .select('id, title, date, event_type')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Event updated: "${data.title}" (${data.date})`,
      });
    },
  );

  // ── delete_event ──────────────────────────────────────────────────────────
  server.registerTool(
    'delete_event',
    {
      title: 'Delete Event',
      description:
        'Delete an investigation timeline event and its entity links.',
      inputSchema: {
        event_id: z.string().uuid().describe('Event UUID to delete'),
      },
    },
    async ({ event_id }) => {
      const sb = getSupabase();
      // Remove entity links first
      await sb.from('entity_events').delete().eq('event_id', event_id);
      const { data, error } = await sb.from('events')
        .delete()
        .eq('id', event_id)
        .select('id, title')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        message: `Deleted event: "${data.title}"`,
      });
    },
  );
}
