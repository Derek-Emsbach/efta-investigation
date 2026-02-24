import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse, safeJson } from '../supabase.js';
import { getCorpusDb, getRedactionDb } from '../db/sqlite.js';

// ---------------------------------------------------------------------------
// Hardcoded schema metadata — table purposes and FK relationships
// information_schema.columns provides columns, this adds context
// ---------------------------------------------------------------------------
const TABLE_INFO: Record<string, { purpose: string; key_relationships: string[] }> = {
  entities: {
    purpose: 'People, organizations, properties tracked in the investigation. Tier 1-6 evidence classification. ~150 records.',
    key_relationships: ['entity_documents (entity_id)', 'entity_connections (entity_a, entity_b)', 'entity_sightings (entity_id)', 'evidence_items (entity_id)', 'entity_events (entity_id)'],
  },
  documents: {
    purpose: '1.37M+ EFTA document records. Bates-numbered. Full text stored in R2 at text/{bates}.txt, DB extracted_text is 2K preview.',
    key_relationships: ['entity_documents (document_id)', 'redactions (document_id)', 'evidence_items (document_id)', 'processing_queue (document_id)', 'datasets (dataset_id)'],
  },
  events: {
    purpose: 'Timeline events — legal, financial, travel, communication, etc. Linked to entities and documents.',
    key_relationships: ['entity_events (event_id)', 'event_documents (event_id)', 'locations (location_id)'],
  },
  entity_documents: {
    purpose: 'Junction: entity ↔ document. role_in_document = subject/mentioned/author/recipient/witness/photographer/attorney. UNIQUE(entity_id, document_id, role_in_document).',
    key_relationships: ['entities (entity_id)', 'documents (document_id)'],
  },
  entity_connections: {
    purpose: 'Relationships between entities. Uses entity_a/entity_b columns (NOT source_entity_id/target_entity_id). relationship_type + evidence_strength + numeric strength.',
    key_relationships: ['entities (entity_a → id)', 'entities (entity_b → id)'],
  },
  entity_events: {
    purpose: 'Junction: entity ↔ event.',
    key_relationships: ['entities (entity_id)', 'events (event_id)'],
  },
  entity_sightings: {
    purpose: 'Entity-location-date records. 12 sighting types. Confidence levels. Co-location tracking via with_entities[] array.',
    key_relationships: ['entities (entity_id)', 'locations (location_id)', 'documents (document_id)'],
  },
  locations: {
    purpose: 'Physical locations — properties, airports, offices, courts, etc. Lat/lng, owner entity, aliases.',
    key_relationships: ['entity_sightings (location_id)', 'entities (owner_entity_id)'],
  },
  evidence_items: {
    purpose: 'Specific evidence extracted from documents. Has direct entity_id FK (no junction table). Types: financial, testimony, physical, digital, forensic, documentary, photographic.',
    key_relationships: ['entities (entity_id)', 'documents (document_id)'],
  },
  redactions: {
    purpose: 'Redaction findings from document review. Categories A-D: A=victim protection, B=legal privilege, C=institutional protection, D=perpetrator protection.',
    key_relationships: ['documents (document_id)'],
  },
  datasets: {
    purpose: 'The 12 EFTA document release datasets from DOJ. Tracks document counts, Bates ranges, status.',
    key_relationships: ['documents (dataset_id)'],
  },
  suspect_watchlist: {
    purpose: 'Persons of interest being tracked before promotion to entities. Status: confirmed_co_conspirator → suspect → watchlist → possible_suspect → watch → deprioritized. Priority P1-P5.',
    key_relationships: ['entities (entity_id — set when promoted)', 'documents (first_seen_document_id)'],
  },
  investigations: {
    purpose: 'Named investigation threads (e.g. "Leon Black Prosecution Failure"). Links to entities, documents, events.',
    key_relationships: ['entity_investigations', 'investigation_documents', 'investigation_events', 'investigation_notes'],
  },
  public_events: {
    purpose: 'Public events timeline — congressional actions, DOJ releases, arrests, resignations, media breaks. Separate from investigation events table.',
    key_relationships: [],
  },
  doj_accountability: {
    purpose: 'DOJ behavior tracker — file deletions, re-redactions, surveillance, compliance failures, misleading statements.',
    key_relationships: [],
  },
  processing_queue: {
    purpose: 'Document processing pipeline queue. Tracks stage progress, errors, results.',
    key_relationships: ['documents (document_id)'],
  },
  document_images: {
    purpose: 'Extracted images from documents — photos, graphics, signatures. Stored in R2.',
    key_relationships: ['documents (document_id)', 'image_entities', 'image_locations'],
  },
  image_entities: {
    purpose: 'Junction: image ↔ entity. Tags extracted images with entity links.',
    key_relationships: ['document_images (image_id)', 'entities (entity_id)'],
  },
  image_locations: {
    purpose: 'Junction: image ↔ location. Tags extracted images with location links.',
    key_relationships: ['document_images (image_id)', 'locations (location_id)'],
  },
};

export function registerUtilityTools(server: McpServer) {

  // ── lookup_person ───────────────────────────────────────────────────────────
  server.registerTool(
    'lookup_person',
    {
      title: 'Lookup Person',
      description:
        'Unified name search across entities AND suspect_watchlist. Supports exact, ilike, alias, and fuzzy (trigram) matching. Call this every time you encounter a name in a document to check if the person is already tracked.',
      inputSchema: {
        name: z.string().describe('Name to search for'),
        threshold: z.number().min(0).max(1).default(0.3).describe('Trigram similarity threshold (0-1, default 0.3)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, threshold }) => {
      const sb = getSupabase();

      // Helper: safely call RPC with graceful fallback if function doesn't exist
      const safeRpc = async (fn: string, params: Record<string, unknown>) => {
        try {
          const result = await sb.rpc(fn, params).limit(10);
          return result;
        } catch {
          return { data: null, error: { message: `RPC ${fn} not available` } };
        }
      };

      // Parallel search across both tables with multiple match strategies
      const [
        entityExact,
        entityIlike,
        entityFuzzy,
        suspectExact,
        suspectIlike,
        suspectFuzzy,
      ] = await Promise.all([
        // Entity: exact name
        sb.from('entities').select('id, name, tier, category, aliases').eq('name', name).limit(5),
        // Entity: ilike + alias contains
        sb.from('entities').select('id, name, tier, category, aliases')
          .or(`name.ilike.%${name}%,aliases.cs.{${name}}`)
          .limit(10),
        // Entity: trigram fuzzy (uses pg_trgm index)
        safeRpc('search_entities_fuzzy', { query_name: name, sim_threshold: threshold }),
        // Suspect: exact name
        sb.from('suspect_watchlist').select('id, name, status, priority, category, db_status, entity_id, aliases').eq('name', name).limit(5),
        // Suspect: ilike + alias contains
        sb.from('suspect_watchlist').select('id, name, status, priority, category, db_status, entity_id, aliases')
          .or(`name.ilike.%${name}%,aliases.cs.{${name}}`)
          .limit(10),
        // Suspect: trigram fuzzy
        safeRpc('search_suspects_fuzzy', { query_name: name, sim_threshold: threshold }),
      ]);

      // Deduplicate entity results
      const entityIdSet = new Set<string>();
      const entityMatches: Array<Record<string, unknown>> = [];

      const addEntity = (row: Record<string, unknown>, matchType: string, similarity?: number) => {
        const id = row.id as string;
        if (entityIdSet.has(id)) return;
        entityIdSet.add(id);
        entityMatches.push({ ...row, match_type: matchType, similarity });
      };

      for (const row of (entityExact.data ?? [])) addEntity(row, 'exact', 1.0);
      for (const row of (entityIlike.data ?? [])) addEntity(row, 'ilike');
      if (entityFuzzy && 'data' in entityFuzzy && entityFuzzy.data) {
        for (const row of entityFuzzy.data) addEntity(row, 'fuzzy', (row as Record<string, unknown>).similarity as number);
      }

      // Deduplicate suspect results
      const suspectIdSet = new Set<string>();
      const suspectMatches: Array<Record<string, unknown>> = [];

      const addSuspect = (row: Record<string, unknown>, matchType: string, similarity?: number) => {
        const id = row.id as string;
        if (suspectIdSet.has(id)) return;
        suspectIdSet.add(id);
        suspectMatches.push({ ...row, match_type: matchType, similarity });
      };

      for (const row of (suspectExact.data ?? [])) addSuspect(row, 'exact', 1.0);
      for (const row of (suspectIlike.data ?? [])) addSuspect(row, 'ilike');
      if (suspectFuzzy && 'data' in suspectFuzzy && suspectFuzzy.data) {
        for (const row of suspectFuzzy.data) addSuspect(row, 'fuzzy', (row as Record<string, unknown>).similarity as number);
      }

      // Flag promoted suspects that also appear as entities
      for (const s of suspectMatches) {
        if (s.db_status === 'in_db' && s.entity_id && entityIdSet.has(s.entity_id as string)) {
          s.note = 'Also exists as entity (promoted)';
        }
      }

      return toolResponse({
        success: true,
        data: {
          query: name,
          entity_matches: entityMatches,
          suspect_matches: suspectMatches,
        },
        count: entityMatches.length + suspectMatches.length,
        message: `Found ${entityMatches.length} entity matches and ${suspectMatches.length} suspect matches for "${name}"`,
      });
    },
  );

  // ── get_investigation_stats ─────────────────────────────────────────────────
  server.registerTool(
    'get_investigation_stats',
    {
      title: 'Get Investigation Stats',
      description:
        'Get current investigation statistics: document counts by status, entity counts by tier, dataset progress, suspect watchlist summary.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sb = getSupabase();
      const [docsRes, entitiesRes, eventsRes, datasetsRes, suspectsRes, pubEventsRes, dojAcctRes] = await Promise.all([
        sb.rpc('processing_queue_stats'),
        sb.from('entities').select('tier, id'),
        sb.from('events').select('id', { count: 'exact', head: true }),
        sb.from('datasets').select('id, name, document_count'),
        sb.from('suspect_watchlist').select('status, priority'),
        sb.from('public_events').select('category, impact_level'),
        sb.from('doj_accountability').select('action_type, severity, status'),
      ]);

      // Count entities by tier
      const entityTiers: Record<number, number> = {};
      if (entitiesRes.data) {
        for (const e of entitiesRes.data) {
          entityTiers[e.tier] = (entityTiers[e.tier] || 0) + 1;
        }
      }

      // Count suspects by status
      const suspectsByStatus: Record<string, number> = {};
      if (suspectsRes.data) {
        for (const s of suspectsRes.data) {
          suspectsByStatus[s.status] = (suspectsByStatus[s.status] || 0) + 1;
        }
      }

      // Public events stats
      const pubEventsByCategory: Record<string, number> = {};
      const pubEventsByImpact: Record<string, number> = {};
      if (pubEventsRes.data) {
        for (const e of pubEventsRes.data) {
          pubEventsByCategory[e.category] = (pubEventsByCategory[e.category] || 0) + 1;
          pubEventsByImpact[e.impact_level] = (pubEventsByImpact[e.impact_level] || 0) + 1;
        }
      }

      // DOJ accountability stats
      const dojByType: Record<string, number> = {};
      const dojBySeverity: Record<string, number> = {};
      const dojByStatus: Record<string, number> = {};
      if (dojAcctRes.data) {
        for (const d of dojAcctRes.data) {
          dojByType[d.action_type] = (dojByType[d.action_type] || 0) + 1;
          dojBySeverity[d.severity] = (dojBySeverity[d.severity] || 0) + 1;
          dojByStatus[d.status] = (dojByStatus[d.status] || 0) + 1;
        }
      }

      // Corpus stats (SQLite — fast, cached by OS page cache)
      let corpusStats: Record<string, unknown> = { available: false };
      const corpusDb = getCorpusDb();
      const redactionDb = getRedactionDb();
      if (corpusDb) {
        const pages = (corpusDb.prepare('SELECT COUNT(*) as c FROM pages').get() as { c: number }).c;
        const docs = (corpusDb.prepare('SELECT COUNT(*) as c FROM documents').get() as { c: number }).c;
        corpusStats = { available: true, total_documents: docs, total_pages: pages };
      }
      if (redactionDb) {
        const redactions = (redactionDb.prepare('SELECT COUNT(*) as c FROM redactions').get() as { c: number }).c;
        corpusStats.redaction_records = redactions;
      }

      return toolResponse({
        success: true,
        data: {
          processing_stats: docsRes.data,
          entity_count: entitiesRes.data?.length ?? 0,
          entities_by_tier: entityTiers,
          event_count: eventsRes.count ?? 0,
          datasets: datasetsRes.data ?? [],
          suspect_count: suspectsRes.data?.length ?? 0,
          suspects_by_status: suspectsByStatus,
          public_events: {
            total: pubEventsRes.data?.length ?? 0,
            by_category: pubEventsByCategory,
            by_impact: pubEventsByImpact,
          },
          doj_accountability: {
            total: dojAcctRes.data?.length ?? 0,
            by_type: dojByType,
            by_severity: dojBySeverity,
            by_status: dojByStatus,
          },
          corpus: corpusStats,
        },
      });
    },
  );

  // ── list_datasets ──────────────────────────────────────────────────────────
  server.registerTool(
    'list_datasets',
    {
      title: 'List Datasets',
      description: 'List all EFTA datasets with their document counts and metadata.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sb = getSupabase();
      const { data, error } = await sb.from('datasets').select('*').order('name');
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        count: data?.length ?? 0,
        data: data ?? [],
      });
    },
  );

  // ── get_schema ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_schema',
    {
      title: 'Get Database Schema',
      description:
        'Return structured schema information for the EFTA investigation database. Includes column definitions, table purposes, and FK relationships. Much more useful than raw information_schema dumps.',
      inputSchema: {
        table_name: z.string().optional().describe('Filter to a specific table. If omitted, returns all tables with purposes.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ table_name }) => {
      const sb = getSupabase();

      // Try to get column definitions from information_schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = sb
        .from('information_schema.columns' as any)
        .select('table_name, column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .order('table_name', { ascending: true })
        .order('ordinal_position', { ascending: true });

      if (table_name) {
        query = query.eq('table_name', table_name);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback: return hardcoded schema metadata only (no column details)
        if (table_name && TABLE_INFO[table_name]) {
          return toolResponse({
            success: true,
            data: { [table_name]: TABLE_INFO[table_name] },
            message: 'Column details unavailable (information_schema not accessible via PostgREST). Showing table metadata only.',
          });
        }
        return toolResponse({
          success: true,
          data: TABLE_INFO,
          message: `Schema overview for ${Object.keys(TABLE_INFO).length} tables. Column details unavailable (information_schema not accessible via PostgREST).`,
        });
      }

      // Group columns by table and enrich with TABLE_INFO metadata
      const grouped: Record<string, {
        purpose?: string;
        key_relationships?: string[];
        columns: Array<{ column: string; type: string; nullable: boolean; default: string | null }>;
      }> = {};

      for (const col of (data ?? [])) {
        const t = (col as Record<string, unknown>).table_name as string;
        if (!grouped[t]) {
          const info = TABLE_INFO[t];
          grouped[t] = {
            purpose: info?.purpose,
            key_relationships: info?.key_relationships,
            columns: [],
          };
        }
        grouped[t].columns.push({
          column: (col as Record<string, unknown>).column_name as string,
          type: (col as Record<string, unknown>).data_type as string,
          nullable: (col as Record<string, unknown>).is_nullable === 'YES',
          default: (col as Record<string, unknown>).column_default as string | null,
        });
      }

      return toolResponse({
        success: true,
        count: Object.keys(grouped).length,
        data: grouped,
        message: `Schema for ${Object.keys(grouped).length} tables with purposes and FK relationships`,
      });
    },
  );
}
