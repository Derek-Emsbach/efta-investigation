import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

export function registerEntityTools(server: McpServer) {

  // ── search_entities ─────────────────────────────────────────────────────────
  server.registerTool(
    'search_entities',
    {
      title: 'Search Entities',
      description:
        'Search the EFTA entity database by name, tier, or category. Returns matching entities with tier classification, evidence summary, and linked datasets. Supports full-text search with ilike fallback.',
      inputSchema: {
        query: z.string().optional().describe('Name or keyword to search for'),
        tier: z.number().min(1).max(6).optional().describe('Filter by tier (1-6)'),
        category: z.string().optional().describe('Filter by category (e.g. inner_circle, staff, victim)'),
        summary: z.boolean().optional().describe('If true, return only id, name, tier, category for compact output'),
        limit: z.number().min(1).max(50).default(20).describe('Max results'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, tier, category, summary, limit }) => {
      const sb = getSupabase();
      const cols = summary ? 'id, name, tier, category' : '*';
      let q = sb.from('entities').select(cols, { count: 'exact' });

      if (query) {
        // Try FTS first via search_vector
        const ftsQ = sb.from('entities').select(cols, { count: 'exact' })
          .textSearch('search_vector', query, { type: 'plain' });
        if (tier) ftsQ.eq('tier', tier);
        if (category) ftsQ.eq('category', category);
        const ftsResult = await ftsQ.order('tier', { ascending: true }).limit(limit);

        if (!ftsResult.error && ftsResult.data && ftsResult.data.length > 0) {
          return toolResponse({
            success: true,
            count: ftsResult.data.length,
            total_count: ftsResult.count ?? undefined,
            data: ftsResult.data,
            message: `Found ${ftsResult.count ?? ftsResult.data.length} entities (FTS match)`,
          });
        }
        // Fall back to ilike
        q = q.or(`name.ilike.%${query}%,aliases.cs.{${query}}`);
      }

      if (tier) q = q.eq('tier', tier);
      if (category) q = q.eq('category', category);
      q = q.order('tier', { ascending: true }).limit(limit);
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

  // ── get_entity ──────────────────────────────────────────────────────────────
  server.registerTool(
    'get_entity',
    {
      title: 'Get Entity Details',
      description:
        'Get full details for a specific entity by ID, including linked documents, events, and connections.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ entity_id }) => {
      const sb = getSupabase();
      // FIX: Use entity_connections (not connections), with entity_a/entity_b columns
      const [entityRes, docsRes, eventsRes, connARes, connBRes] = await Promise.all([
        sb.from('entities').select('*').eq('id', entity_id).single(),
        sb.from('entity_documents')
          .select('*, document:documents(id, bates_number, title, document_type, original_date, processing_status)')
          .eq('entity_id', entity_id).limit(50),
        sb.from('entity_events')
          .select('*, event:events(*)')
          .eq('entity_id', entity_id).limit(50),
        sb.from('entity_connections')
          .select('*, connected:entities!entity_b(id, name, tier, category)')
          .eq('entity_a', entity_id).limit(50),
        sb.from('entity_connections')
          .select('*, connected:entities!entity_a(id, name, tier, category)')
          .eq('entity_b', entity_id).limit(50),
      ]);
      if (entityRes.error) return errorResponse(entityRes.error.message);

      // Merge connections from both directions
      const connections = [
        ...(connARes.data ?? []),
        ...(connBRes.data ?? []),
      ];

      return toolResponse({
        success: true,
        data: {
          entity: entityRes.data,
          documents: docsRes.data ?? [],
          events: eventsRes.data ?? [],
          connections,
        },
      });
    },
  );

  // ── create_entity ───────────────────────────────────────────────────────────
  server.registerTool(
    'create_entity',
    {
      title: 'Create Entity',
      description:
        'Add a new person to the EFTA entity database. Use during document review when a previously unknown individual is identified. ALWAYS confirm the tier assignment with the user before creating.',
      inputSchema: {
        name: z.string().describe('Full name'),
        tier: z.number().min(1).max(6).describe('Evidence tier (1=convicted/charged, 2=NPA immunity, 3=suspicious, 4=social contact, 5=victim/witness, 6=staff/legal)'),
        entity_type: z.enum(['person', 'organization']).default('person').describe('Entity type'),
        category: z.string().optional().describe('Category (e.g. inner_circle, associate, staff, victim, legal, law_enforcement)'),
        bio: z.string().optional().describe('Brief biographical note'),
        evidence_summary: z.string().optional().describe('Summary of evidence supporting tier assignment'),
        tier_justification: z.string().optional().describe('Bates-cited justification for tier assignment'),
        slug: z.string().optional().describe('URL slug for public profile (lowercase-hyphenated, e.g. "jeffrey-epstein")'),
        aliases: z.array(z.string()).optional().describe('Known aliases or alternate spellings'),
        external_urls: z.record(z.any()).optional().describe('External research links: { "jmail": "url", "rhowardstone": "url", ... }'),
      },
    },
    async ({ name, tier, entity_type, category, bio, evidence_summary, tier_justification, slug, aliases, external_urls }) => {
      const sb = getSupabase();

      // Check for duplicates first
      const { data: existing } = await sb.from('entities').select('id, name, tier').ilike('name', `%${name}%`).limit(5);
      if (existing && existing.length > 0) {
        return toolResponse({
          success: false,
          data: existing,
          message: `Possible duplicates found: ${existing.map((e: Record<string, unknown>) => `${e.name} (Tier ${e.tier}, ID: ${e.id})`).join(', ')}. If this is a new entity, call create_entity again with a more specific name.`,
        });
      }

      const metadata: Record<string, unknown> = {};
      if (evidence_summary) metadata.evidence_summary = evidence_summary;

      const { data, error } = await sb.from('entities')
        .insert({
          name,
          tier,
          entity_type,
          category,
          bio,
          tier_justification,
          slug,
          aliases: aliases ?? [],
          external_urls: external_urls ?? {},
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        })
        .select('id, name, tier')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Created entity: ${data.name} (Tier ${data.tier})`,
      });
    },
  );

  // ── update_entity ───────────────────────────────────────────────────────────
  server.registerTool(
    'update_entity',
    {
      title: 'Update Entity',
      description:
        'Update an existing entity record. Use to add evidence, update bio, or append aliases. Tier changes require explicit user confirmation.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID'),
        tier: z.number().min(1).max(6).optional().describe('New tier (confirm with user first!)'),
        category: z.string().optional(),
        bio: z.string().optional(),
        evidence_summary: z.string().optional().describe('Will REPLACE existing summary — include all evidence'),
        tier_justification: z.string().optional().describe('Bates-cited justification for tier assignment'),
        slug: z.string().optional().describe('URL slug for public profile (lowercase-hyphenated)'),
        profile_published: z.boolean().optional().describe('Set true to publish entity on public site'),
        is_public: z.boolean().optional().describe('Victim privacy flag — NEVER set true for T5 without explicit user instruction'),
        profile_image_url: z.string().optional().describe('URL for entity profile photo'),
        add_aliases: z.array(z.string()).optional().describe('Aliases to ADD to existing list'),
        external_urls: z.record(z.any()).optional().describe('External research links (replaces entire JSONB)'),
      },
    },
    async ({ entity_id, tier, category, bio, evidence_summary, tier_justification, slug, profile_published, is_public, profile_image_url, add_aliases, external_urls }) => {
      const sb = getSupabase();

      const update: Record<string, unknown> = {};
      if (tier !== undefined) update.tier = tier;
      if (category !== undefined) update.category = category;
      if (bio !== undefined) update.bio = bio;
      if (external_urls !== undefined) update.external_urls = external_urls;
      if (tier_justification !== undefined) update.tier_justification = tier_justification;
      if (slug !== undefined) update.slug = slug;
      if (profile_published !== undefined) update.profile_published = profile_published;
      if (is_public !== undefined) update.is_public = is_public;
      if (profile_image_url !== undefined) update.profile_image_url = profile_image_url;

      // evidence_summary stored in metadata JSONB (no dedicated column on entities table)
      if (evidence_summary !== undefined) {
        const { data: current } = await sb.from('entities').select('metadata').eq('id', entity_id).single();
        const existingMeta = (current?.metadata as Record<string, unknown>) ?? {};
        update.metadata = { ...existingMeta, evidence_summary };
      }

      // Handle alias append
      if (add_aliases && add_aliases.length > 0) {
        const { data: current } = await sb.from('entities').select('aliases').eq('id', entity_id).single();
        const existing = (current?.aliases as string[]) ?? [];
        update.aliases = [...new Set([...existing, ...add_aliases])];
      }

      if (Object.keys(update).length === 0) {
        return toolResponse({ success: false, message: 'No fields to update' });
      }

      update.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('entities').update(update).eq('id', entity_id).select('id, name, tier').single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Updated entity: ${data.name} (Tier ${data.tier})`,
      });
    },
  );

  // ── publish_entity ─────────────────────────────────────────────────────────
  server.registerTool(
    'publish_entity',
    {
      title: 'Publish Entity',
      description:
        'Validate and publish an entity to the public site. Runs the publication checklist: bio exists (2+ paragraphs), evidence_summary exists (4+ bullets), tier_justification set, 3+ documents linked, category assigned, slug set. For T1-T3 entities, requires explicit user_confirmed flag. For T5, refuses if is_public would be set without confirmation. Returns checklist results and sets profile_published = true only if all checks pass.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID to publish'),
        slug: z.string().optional().describe('URL slug — will be auto-generated from name if not provided'),
        profile_image_url: z.string().optional().describe('Profile photo URL'),
        user_confirmed: z.boolean().default(false).describe('Required for T1-T3 entities — confirms human reviewed tier assignment'),
      },
    },
    async ({ entity_id, slug: inputSlug, profile_image_url, user_confirmed }) => {
      const sb = getSupabase();

      // Fetch entity with linked doc count
      const [entityRes, docCountRes] = await Promise.all([
        sb.from('entities').select('*').eq('id', entity_id).single(),
        sb.from('entity_documents').select('id', { count: 'exact', head: true }).eq('entity_id', entity_id),
      ]);

      if (entityRes.error || !entityRes.data) {
        return errorResponse(`Entity not found: ${entity_id}`);
      }

      const entity = entityRes.data;
      const docCount = docCountRes.count ?? 0;
      const meta = (entity.metadata as Record<string, unknown>) ?? {};
      const evidenceSummary = (meta.evidence_summary as string) ?? '';

      // Run checklist
      const bioParas = (entity.bio ?? '').split(/\n\n+/).filter((p: string) => p.trim().length > 50);
      const evidenceBullets = evidenceSummary.split(/\n/).filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('•'));

      const checks = {
        bio_exists: bioParas.length >= 2,
        evidence_summary_exists: evidenceBullets.length >= 4,
        tier_justification_set: !!entity.tier_justification,
        documents_linked: docCount >= 3,
        category_assigned: !!entity.category,
        slug_available: !!(inputSlug || entity.slug),
        t1_t3_confirmed: entity.tier > 3 || user_confirmed,
        t5_safe: entity.tier !== 5 || !entity.is_public,
      };

      const failures = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

      if (failures.length > 0) {
        return toolResponse({
          success: false,
          data: {
            entity: { id: entity.id, name: entity.name, tier: entity.tier },
            checklist: checks,
            failures,
            doc_count: docCount,
          },
          message: `Publication blocked — ${failures.length} check(s) failed: ${failures.join(', ')}`,
        });
      }

      // All checks passed — publish
      const resolvedSlug = inputSlug ?? entity.slug ?? entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const update: Record<string, unknown> = {
        profile_published: true,
        slug: resolvedSlug,
        updated_at: new Date().toISOString(),
      };
      if (profile_image_url) update.profile_image_url = profile_image_url;

      const { data, error } = await sb.from('entities').update(update).eq('id', entity_id).select('id, name, tier, slug, profile_published').single();
      if (error) return errorResponse(error.message);

      return toolResponse({
        success: true,
        id: data.id,
        data: { ...data, checklist: checks, doc_count: docCount },
        message: `Published entity: ${data.name} (T${data.tier}) at /entities/${data.slug}`,
      });
    },
  );

  // ── delete_entity ──────────────────────────────────────────────────────────
  server.registerTool(
    'delete_entity',
    {
      title: 'Delete Entity',
      description:
        'Delete an entity from the database. Also removes linked records (entity_documents, entity_events, entity_connections). Use with caution — this is a hard delete. ALWAYS confirm with the user before deleting.',
      inputSchema: {
        entity_id: z.string().uuid().describe('Entity UUID to delete'),
        confirm_name: z.string().describe('Entity name — must match the record as a safety check'),
      },
    },
    async ({ entity_id, confirm_name }) => {
      const sb = getSupabase();

      const { data: entity, error: fetchError } = await sb
        .from('entities')
        .select('id, name, tier')
        .eq('id', entity_id)
        .single();

      if (fetchError || !entity) {
        return errorResponse(`Entity not found with ID ${entity_id}`);
      }

      if (entity.name.toLowerCase() !== confirm_name.toLowerCase()) {
        return toolResponse({
          success: false,
          message: `Name mismatch. Entity name is "${entity.name}" but you provided "${confirm_name}". Delete aborted.`,
        });
      }

      // FIX: Use entity_connections (not connections), with entity_a/entity_b columns
      // FIX: Removed entity_evidence_items — evidence_items has direct entity_id FK with CASCADE
      const cleanups = await Promise.all([
        sb.from('entity_documents').delete().eq('entity_id', entity_id),
        sb.from('entity_events').delete().eq('entity_id', entity_id),
        sb.from('entity_connections').delete().or(`entity_a.eq.${entity_id},entity_b.eq.${entity_id}`),
      ]);

      const cleanupErrors = cleanups.filter(r => r.error).map(r => r.error!.message);
      if (cleanupErrors.length > 0) {
        return errorResponse(`Errors cleaning up linked records: ${cleanupErrors.join('; ')}. Entity NOT deleted.`);
      }

      const { error: deleteError } = await sb.from('entities').delete().eq('id', entity_id);
      if (deleteError) return errorResponse(`Error deleting entity: ${deleteError.message}`);

      return toolResponse({
        success: true,
        id: entity_id,
        data: entity,
        message: `Deleted entity: "${entity.name}" (Tier ${entity.tier}) and all linked records.`,
      });
    },
  );
}
