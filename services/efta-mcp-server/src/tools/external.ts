import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

const SOURCE_TYPES = [
  'search_platform', 'research_repo', 'tracker', 'government',
  'archive', 'media', 'court_records', 'data_corpus', 'community', 'other',
] as const;

const MATCH_STATUSES = ['unmatched', 'matched', 'new_lead', 'not_relevant'] as const;

export function registerExternalTools(server: McpServer) {

  // ── search_research_platforms ───────────────────────────────────────────────
  server.registerTool(
    'search_research_platforms',
    {
      title: 'Search Research Platforms',
      description:
        'Search the registry of external research tools and data sources (Jmail, rhowardstone, tommycarstensen, PACER, etc.). These are platforms we reference during investigation, not entity-specific sources.',
      inputSchema: {
        query: z.string().optional().describe('Search platform name via ilike'),
        source_type: z.enum(SOURCE_TYPES).optional().describe('Filter by source type'),
        capability: z.string().optional().describe('Filter by capability (e.g. "full_text_search", "person_pages")'),
        limit: z.number().min(1).max(50).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, source_type, capability, limit }) => {
      const sb = getSupabase();
      let q = sb.from('research_platforms').select('*', { count: 'exact' });
      if (query) q = q.ilike('name', `%${query}%`);
      if (source_type) q = q.eq('source_type', source_type);
      if (capability) q = q.contains('capabilities', [capability]);
      q = q.order('name').limit(limit);
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

  // ── get_entity_external_links ───────────────────────────────────────────────
  server.registerTool(
    'get_entity_external_links',
    {
      title: 'Get Entity External Links',
      description:
        'Get all known external URLs for an entity — stored links, auto-generated platform URLs, and cross-reference matches from external registries. Provide entity_id or name (searches entities then suspects).',
      inputSchema: {
        entity_id: z.string().uuid().optional().describe('Entity UUID'),
        name: z.string().optional().describe('Entity name (searches entities then suspect_watchlist)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id, name }) => {
      const sb = getSupabase();

      if (!entity_id && !name) {
        return errorResponse('Must provide entity_id or name');
      }

      // Resolve entity
      let entity: Record<string, unknown> | null = null;
      let source: 'entity' | 'suspect' = 'entity';

      if (entity_id) {
        const { data } = await sb.from('entities')
          .select('id, name, tier, category, external_urls')
          .eq('id', entity_id)
          .single();
        entity = data;
      }

      if (!entity && name) {
        const { data } = await sb.from('entities')
          .select('id, name, tier, category, external_urls')
          .ilike('name', name)
          .limit(1)
          .single();
        entity = data;
      }

      if (!entity && name) {
        const { data } = await sb.from('suspect_watchlist')
          .select('id, name, status, priority, external_urls')
          .ilike('name', name)
          .limit(1)
          .single();
        if (data) {
          entity = data;
          source = 'suspect';
        }
      }

      if (!entity) {
        return errorResponse(`No entity or suspect found for ${entity_id ?? name}`);
      }

      const entityName = entity.name as string;
      const resolvedId = entity.id as string;

      // Get stored external_urls
      const storedUrls = (entity.external_urls as Record<string, unknown>) ?? {};

      // Auto-generate URLs from research_platforms with person_page_template
      const { data: platforms } = await sb.from('research_platforms')
        .select('name, person_page_template, url')
        .not('person_page_template', 'is', null);

      const generatedUrls: Record<string, string> = {};
      const slug = entityName.toLowerCase().replace(/\s+/g, '-');
      const slugUpper = entityName.toUpperCase().replace(/\s+/g, '');

      for (const p of (platforms ?? [])) {
        const template = p.person_page_template as string;
        const generated = template
          .replace('{slug}', slug)
          .replace('{SLUG}', slugUpper);
        generatedUrls[p.name as string] = generated;
      }

      // Find matching external_entities records
      const extQuery = source === 'entity'
        ? sb.from('external_entities')
            .select('id, source, name, aliases, entity_type, occupation, legal_status, mention_count, match_status')
            .eq('matched_entity_id', resolvedId)
        : sb.from('external_entities')
            .select('id, source, name, aliases, entity_type, occupation, legal_status, mention_count, match_status')
            .eq('matched_suspect_id', resolvedId);

      const { data: extMatches } = await extQuery;

      // Also search by name for unmatched records
      const { data: extNameMatches } = await sb.from('external_entities')
        .select('id, source, name, aliases, entity_type, occupation, legal_status, mention_count, match_status')
        .ilike('name', `%${entityName}%`)
        .eq('match_status', 'unmatched')
        .limit(10);

      // Merge and deduplicate
      const seenIds = new Set((extMatches ?? []).map(r => r.id));
      const allExtMatches = [...(extMatches ?? [])];
      for (const r of (extNameMatches ?? [])) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          allExtMatches.push(r);
        }
      }

      return toolResponse({
        success: true,
        data: {
          entity: {
            id: resolvedId,
            name: entityName,
            source,
            tier_or_status: entity.tier ?? entity.status,
          },
          stored_urls: storedUrls,
          generated_urls: generatedUrls,
          external_entity_matches: allExtMatches,
        },
      });
    },
  );

  // ── search_external_entities ────────────────────────────────────────────────
  server.registerTool(
    'search_external_entities',
    {
      title: 'Search External Entities',
      description:
        'Search the external entities cross-reference table (rhowardstone person registry). Use this to find persons from external research data and check if they match our tracked entities/suspects.',
      inputSchema: {
        query: z.string().optional().describe('Name search via ilike'),
        source: z.string().optional().describe('Filter by source (e.g. "rhowardstone")'),
        match_status: z.enum(MATCH_STATUSES).optional().describe('Filter by match status'),
        entity_type: z.string().optional().describe('Filter by entity type (person, organization, property, aircraft)'),
        limit: z.number().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, source, match_status, entity_type, limit }) => {
      const sb = getSupabase();
      let q = sb.from('external_entities')
        .select('*, matched_entity:entities!matched_entity_id(id, name, tier)', { count: 'exact' });
      if (query) q = q.ilike('name', `%${query}%`);
      if (source) q = q.eq('source', source);
      if (match_status) q = q.eq('match_status', match_status);
      if (entity_type) q = q.eq('entity_type', entity_type);
      q = q.order('name').limit(limit);
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

  // ── link_external_entity ────────────────────────────────────────────────────
  server.registerTool(
    'link_external_entity',
    {
      title: 'Link External Entity',
      description:
        'Link an external entity record to one of our tracked entities or suspects. Set match_status to "matched" (with entity_id or suspect_id), "new_lead", or "not_relevant".',
      inputSchema: {
        external_entity_id: z.string().uuid().describe('External entity UUID to update'),
        entity_id: z.string().uuid().optional().describe('Our entity UUID to link to'),
        suspect_id: z.string().uuid().optional().describe('Our suspect UUID to link to'),
        match_status: z.enum(['matched', 'new_lead', 'not_relevant']).describe('New match status'),
        notes: z.string().optional().describe('Notes about the match decision'),
      },
    },
    async ({ external_entity_id, entity_id, suspect_id, match_status, notes }) => {
      if (match_status === 'matched' && !entity_id && !suspect_id) {
        return errorResponse('Must provide entity_id or suspect_id when match_status is "matched"');
      }

      const sb = getSupabase();
      const update: Record<string, unknown> = {
        match_status,
        updated_at: new Date().toISOString(),
      };
      if (entity_id) update.matched_entity_id = entity_id;
      if (suspect_id) update.matched_suspect_id = suspect_id;
      if (notes !== undefined) update.notes = notes;

      const { data, error } = await sb.from('external_entities')
        .update(update)
        .eq('id', external_entity_id)
        .select('id, name, match_status, matched_entity_id, matched_suspect_id')
        .single();
      if (error) return errorResponse(error.message);

      // Get the linked entity/suspect name for the message
      let linkedName = '';
      if (data.matched_entity_id) {
        const { data: ent } = await sb.from('entities')
          .select('name').eq('id', data.matched_entity_id).single();
        linkedName = ent?.name ?? '';
      } else if (data.matched_suspect_id) {
        const { data: sus } = await sb.from('suspect_watchlist')
          .select('name').eq('id', data.matched_suspect_id).single();
        linkedName = sus?.name ?? '';
      }

      const msg = match_status === 'matched'
        ? `Linked "${data.name}" → "${linkedName}"`
        : `Marked "${data.name}" as ${match_status}`;

      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: msg,
      });
    },
  );
}
