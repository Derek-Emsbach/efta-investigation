import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

const SIGHTING_TYPES = [
  'flight_departure', 'flight_arrival', 'present_at', 'email_sent_from',
  'court_appearance', 'photo_at', 'financial_transaction', 'phone_call',
  'text_message', 'witness_testimony', 'document_reference', 'residence',
] as const;

const CONFIDENCE_LEVELS = ['confirmed', 'likely', 'possible', 'inferred'] as const;

export function registerSightingTools(server: McpServer) {

  // ── search_entity_locations ─────────────────────────────────────────────────
  server.registerTool(
    'search_entity_locations',
    {
      title: 'Search Entity Locations',
      description:
        'Search entity sightings — records of entities at locations on specific dates. Uses existing entity_sightings table joined with entities and locations.',
      inputSchema: {
        entity_id: z.string().uuid().optional().describe('Filter by entity'),
        location_id: z.string().uuid().optional().describe('Filter by location'),
        date_after: z.string().optional().describe('ISO date — sightings after this date'),
        date_before: z.string().optional().describe('ISO date — sightings before this date'),
        sighting_type: z.enum(SIGHTING_TYPES).optional().describe('Filter by sighting type'),
        confidence: z.enum(CONFIDENCE_LEVELS).optional().describe('Filter by confidence level'),
        limit: z.number().min(1).max(50).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id, location_id, date_after, date_before, sighting_type, confidence, limit }) => {
      const sb = getSupabase();
      let q = sb.from('entity_sightings')
        .select('*, entity:entities(id, name, tier), location:locations(id, name, city, country, location_type)', { count: 'exact' });

      if (entity_id) q = q.eq('entity_id', entity_id);
      if (location_id) q = q.eq('location_id', location_id);
      if (date_after) q = q.gte('date', date_after);
      if (date_before) q = q.lte('date', date_before);
      if (sighting_type) q = q.eq('sighting_type', sighting_type);
      if (confidence) q = q.eq('confidence', confidence);
      q = q.order('date', { ascending: false }).limit(limit);

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

  // ── add_entity_location ─────────────────────────────────────────────────────
  server.registerTool(
    'add_entity_location',
    {
      title: 'Add Entity Location Sighting',
      description:
        'Record an entity being at a specific location on a specific date. Inserts into entity_sightings table.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID'),
        location_id: z.string().uuid().describe('Location UUID'),
        date: z.string().describe('Sighting date (ISO format)'),
        sighting_type: z.enum(SIGHTING_TYPES).describe('Type of sighting'),
        confidence: z.enum(CONFIDENCE_LEVELS).default('confirmed'),
        time_start: z.string().optional().describe('Time start (HH:MM format)'),
        time_end: z.string().optional().describe('Time end (HH:MM format)'),
        time_precision: z.enum(['exact', 'approximate', 'day', 'am_pm']).default('day'),
        description: z.string().optional(),
        with_entities: z.array(z.string().uuid()).optional().describe('Other entities present at the same time'),
        document_id: z.string().uuid().optional().describe('Source document for this sighting'),
        metadata: z.record(z.unknown()).optional(),
      },
    },
    async ({ entity_id, location_id, date, sighting_type, confidence, time_start, time_end, time_precision, description, with_entities, document_id, metadata }) => {
      const sb = getSupabase();

      // Validate entity and location exist
      const [entityCheck, locationCheck] = await Promise.all([
        sb.from('entities').select('id, name').eq('id', entity_id).single(),
        sb.from('locations').select('id, name').eq('id', location_id).single(),
      ]);
      if (entityCheck.error) return errorResponse(`Entity not found: ${entity_id}`);
      if (locationCheck.error) return errorResponse(`Location not found: ${location_id}`);

      const { data, error } = await sb.from('entity_sightings')
        .insert({
          entity_id,
          location_id,
          date,
          sighting_type,
          confidence,
          time_start,
          time_end,
          time_precision,
          description,
          with_entities: with_entities ?? [],
          document_id,
          metadata: metadata ?? {},
        })
        .select('id')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        message: `Recorded: ${entityCheck.data.name} at ${locationCheck.data.name} on ${date} (${sighting_type})`,
      });
    },
  );

  // ── find_co_locations ───────────────────────────────────────────────────────
  server.registerTool(
    'find_co_locations',
    {
      title: 'Find Co-Locations',
      description:
        'Find other entities at the same location on the same date as a given entity. Critical for identifying meetings, overlapping travel, and co-presence patterns.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity to find co-locations for'),
        date: z.string().optional().describe('Specific date to check (ISO). If omitted, checks all dates.'),
        location_id: z.string().uuid().optional().describe('Specific location to check. If omitted, checks all locations.'),
        limit: z.number().min(1).max(50).default(50).describe('Max sightings to check'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id, date, location_id, limit }) => {
      const sb = getSupabase();

      // Step 1: Get target entity's sightings
      let myQuery = sb.from('entity_sightings')
        .select('id, date, location_id, with_entities, sighting_type, location:locations(id, name, city)')
        .eq('entity_id', entity_id)
        .not('location_id', 'is', null);
      if (date) myQuery = myQuery.eq('date', date);
      if (location_id) myQuery = myQuery.eq('location_id', location_id);
      myQuery = myQuery.order('date', { ascending: false }).limit(limit);

      const { data: mySightings, error: myErr } = await myQuery;
      if (myErr) return errorResponse(myErr.message);
      if (!mySightings || mySightings.length === 0) {
        return toolResponse({ success: true, count: 0, data: [], message: 'No sightings found for this entity' });
      }

      // Step 2: Build OR conditions for co-presence queries
      // Group by (location_id, date) to avoid duplicate queries
      const locationDates = new Map<string, { location_id: string; date: string }>();
      for (const s of mySightings) {
        if (s.location_id && s.date) {
          const key = `${s.location_id}:${s.date}`;
          if (!locationDates.has(key)) {
            locationDates.set(key, { location_id: s.location_id, date: s.date });
          }
        }
      }

      if (locationDates.size === 0) {
        return toolResponse({ success: true, count: 0, data: [], message: 'No location+date pairs to check' });
      }

      // Step 3: Query for other entities at same (location, date) pairs
      const conditions = [...locationDates.values()]
        .map(ld => `and(location_id.eq.${ld.location_id},date.eq.${ld.date})`)
        .join(',');

      const { data: coSightings, error: coErr } = await sb.from('entity_sightings')
        .select('*, entity:entities(id, name, tier, category), location:locations(id, name, city)')
        .or(conditions)
        .neq('entity_id', entity_id)
        .limit(100);

      if (coErr) return errorResponse(coErr.message);

      // Group by location+date for structured output
      const grouped: Record<string, { location: unknown; date: string; entities: unknown[] }> = {};
      for (const s of (coSightings ?? [])) {
        const key = `${s.location_id}:${s.date}`;
        if (!grouped[key]) {
          grouped[key] = { location: s.location, date: s.date, entities: [] };
        }
        grouped[key].entities.push({
          entity: s.entity,
          sighting_type: s.sighting_type,
          confidence: s.confidence,
          description: s.description,
        });
      }

      return toolResponse({
        success: true,
        count: Object.keys(grouped).length,
        data: Object.values(grouped),
        message: `Found ${coSightings?.length ?? 0} co-location sightings across ${Object.keys(grouped).length} location/date pairs`,
      });
    },
  );

  // ── get_location_timeline ───────────────────────────────────────────────────
  server.registerTool(
    'get_location_timeline',
    {
      title: 'Get Location Timeline',
      description:
        'Get a chronological timeline of all entity sightings at a specific location. Shows who was there and when.',
      inputSchema: {
        location_id: z.string().uuid().describe('Location UUID'),
        date_after: z.string().optional().describe('ISO date — sightings after this date'),
        date_before: z.string().optional().describe('ISO date — sightings before this date'),
        limit: z.number().min(1).max(100).default(50),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ location_id, date_after, date_before, limit }) => {
      const sb = getSupabase();

      // Get location info first
      const { data: location, error: locErr } = await sb.from('locations')
        .select('id, name, city, country, location_type')
        .eq('id', location_id).single();
      if (locErr) return errorResponse(`Location not found: ${location_id}`);

      let q = sb.from('entity_sightings')
        .select('*, entity:entities(id, name, tier, category), document:documents(id, bates_number, title)', { count: 'exact' })
        .eq('location_id', location_id);
      if (date_after) q = q.gte('date', date_after);
      if (date_before) q = q.lte('date', date_before);
      q = q.order('date', { ascending: true }).order('time_start', { ascending: true }).limit(limit);

      const { data, error, count: total } = await q;
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        count: data?.length ?? 0,
        total_count: total ?? undefined,
        data: { location, sightings: data ?? [] },
      });
    },
  );

  // ── find_entities_at_location ───────────────────────────────────────────────
  server.registerTool(
    'find_entities_at_location',
    {
      title: 'Find Entities at Location',
      description:
        'Find all distinct entities that have been sighted at a specific location, with visit counts and date ranges.',
      inputSchema: {
        location_id: z.string().uuid().describe('Location UUID'),
        date: z.string().optional().describe('Specific date to check (ISO). If omitted, returns all-time visitors.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ location_id, date }) => {
      const sb = getSupabase();

      let q = sb.from('entity_sightings')
        .select('entity_id, date, sighting_type, confidence, entity:entities(id, name, tier, category)')
        .eq('location_id', location_id);
      if (date) q = q.eq('date', date);
      q = q.order('date', { ascending: true });

      const { data, error } = await q;
      if (error) return errorResponse(error.message);

      // Group by entity and compute stats
      const entityMap = new Map<string, {
        entity: unknown;
        sighting_count: number;
        first_seen: string;
        last_seen: string;
        sighting_types: Set<string>;
      }>();

      for (const row of (data ?? [])) {
        const eid = row.entity_id;
        if (!entityMap.has(eid)) {
          entityMap.set(eid, {
            entity: row.entity,
            sighting_count: 0,
            first_seen: row.date,
            last_seen: row.date,
            sighting_types: new Set(),
          });
        }
        const entry = entityMap.get(eid)!;
        entry.sighting_count++;
        if (row.date < entry.first_seen) entry.first_seen = row.date;
        if (row.date > entry.last_seen) entry.last_seen = row.date;
        entry.sighting_types.add(row.sighting_type);
      }

      const entities = [...entityMap.values()].map(e => ({
        ...e,
        sighting_types: [...e.sighting_types],
      }));

      // Sort by visit count descending
      entities.sort((a, b) => b.sighting_count - a.sighting_count);

      return toolResponse({
        success: true,
        count: entities.length,
        data: entities,
        message: `Found ${entities.length} distinct entities at this location`,
      });
    },
  );
}
