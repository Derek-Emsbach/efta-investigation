import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase, toolResponse, errorResponse } from '../supabase.js';

const PUBLIC_EVENT_CATEGORIES = [
  'legislative', 'congressional_action', 'doj_release', 'doj_action',
  'criminal_action', 'resignation', 'court_action', 'media_break',
  'community_resource', 'international', 'victim_advocacy', 'other',
] as const;

const IMPACT_LEVELS = ['critical', 'high', 'medium', 'low'] as const;

const DOJ_ACTION_TYPES = [
  'file_deletion', 're_redaction', 'deadline_violation', 'viewer_surveillance',
  'false_compliance', 'victim_exposure', 'perpetrator_protection',
  'metadata_suppression', 'obstruction', 'other',
] as const;

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'] as const;

const DOJ_STATUSES = [
  'documented', 'reported', 'under_investigation', 'resolved', 'ongoing',
] as const;

export function registerPublicEventTools(server: McpServer) {

  // ── search_public_events ────────────────────────────────────────────────────
  server.registerTool(
    'search_public_events',
    {
      title: 'Search Public Events',
      description:
        'Search the public events timeline — congressional actions, DOJ releases, arrests, resignations, media breaks, and other real-world developments around the EFTA document releases. This is separate from the investigation timeline (search_events) which tracks findings from document review.',
      inputSchema: {
        query: z.string().optional().describe('Full-text search across title, description, and notes'),
        category: z.enum(PUBLIC_EVENT_CATEGORIES).optional().describe('Filter by event category'),
        impact_level: z.enum(IMPACT_LEVELS).optional().describe('Filter by impact level'),
        entity_name: z.string().optional().describe('Filter by person involved (matches entity_names array)'),
        tag: z.string().optional().describe('Filter by tag (matches tags array)'),
        date_from: z.string().optional().describe('ISO date — events on or after this date'),
        date_to: z.string().optional().describe('ISO date — events on or before this date'),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, category, impact_level, entity_name, tag, date_from, date_to, limit, offset }) => {
      const sb = getSupabase();
      let q = sb.from('public_events').select('*', { count: 'exact' });

      if (query) q = q.textSearch('search_vector', query, { type: 'websearch' });
      if (category) q = q.eq('category', category);
      if (impact_level) q = q.eq('impact_level', impact_level);
      if (entity_name) q = q.contains('entity_names', [entity_name]);
      if (tag) q = q.contains('tags', [tag]);
      if (date_from) q = q.gte('date', date_from);
      if (date_to) q = q.lte('date', date_to);

      q = q.order('date', { ascending: false }).range(offset, offset + limit - 1);

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

  // ── create_public_event ─────────────────────────────────────────────────────
  server.registerTool(
    'create_public_event',
    {
      title: 'Create Public Event',
      description:
        'Add a public event to the timeline — congressional actions, DOJ releases, arrests, resignations, media breaks, etc. For investigation timeline events discovered during document review, use create_event instead.',
      inputSchema: {
        date: z.string().describe('Event date (ISO format: YYYY-MM-DD)'),
        title: z.string().describe('Short headline'),
        category: z.enum(PUBLIC_EVENT_CATEGORIES).describe('Event category'),
        description: z.string().optional().describe('Longer description with context'),
        impact_level: z.enum(IMPACT_LEVELS).optional().describe('Impact level (default: medium)'),
        date_end: z.string().optional().describe('End date for multi-day events'),
        source_urls: z.array(z.string()).optional().describe('Source URLs (news articles, official statements)'),
        efta_numbers: z.array(z.string()).optional().describe('Related EFTA document numbers'),
        entity_names: z.array(z.string()).optional().describe('People involved (display names)'),
        tags: z.array(z.string()).optional().describe('Freeform tags for filtering'),
        notes: z.string().optional().describe('Internal analysis notes'),
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('public_events')
        .insert({
          date: params.date,
          title: params.title,
          category: params.category,
          description: params.description,
          impact_level: params.impact_level ?? 'medium',
          date_end: params.date_end,
          source_urls: params.source_urls ?? [],
          efta_numbers: params.efta_numbers ?? [],
          entity_names: params.entity_names ?? [],
          tags: params.tags ?? [],
          notes: params.notes,
        })
        .select('id, date, title, category, impact_level')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `Public event created: "${data.title}"`,
      });
    },
  );

  // ── search_doj_actions ──────────────────────────────────────────────────────
  server.registerTool(
    'search_doj_actions',
    {
      title: 'Search DOJ Actions',
      description:
        'Search DOJ accountability records — file deletions, re-redactions, deadline violations, surveillance of congressional members, false compliance claims, victim exposure, and other DOJ behavior around EFTA compliance.',
      inputSchema: {
        query: z.string().optional().describe('Full-text search across title, description, and notes'),
        action_type: z.enum(DOJ_ACTION_TYPES).optional().describe('Filter by action type'),
        severity: z.enum(SEVERITY_LEVELS).optional().describe('Filter by severity'),
        status: z.enum(DOJ_STATUSES).optional().describe('Filter by status'),
        date_from: z.string().optional().describe('ISO date — actions on or after this date'),
        date_to: z.string().optional().describe('ISO date — actions on or before this date'),
        limit: z.number().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, action_type, severity, status, date_from, date_to, limit }) => {
      const sb = getSupabase();
      let q = sb.from('doj_accountability').select('*', { count: 'exact' });

      if (query) q = q.textSearch('search_vector', query, { type: 'websearch' });
      if (action_type) q = q.eq('action_type', action_type);
      if (severity) q = q.eq('severity', severity);
      if (status) q = q.eq('status', status);
      if (date_from) q = q.gte('date', date_from);
      if (date_to) q = q.lte('date', date_to);

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

  // ── log_doj_action ──────────────────────────────────────────────────────────
  server.registerTool(
    'log_doj_action',
    {
      title: 'Log DOJ Action',
      description:
        'Record a DOJ accountability event — file deletions, deadline violations, surveillance, false compliance claims, victim exposure, or other DOJ behavior. For tracking and accountability purposes.',
      inputSchema: {
        date: z.string().describe('Date of the action (ISO format: YYYY-MM-DD)'),
        title: z.string().describe('Short headline'),
        description: z.string().describe('Detailed description with evidence'),
        action_type: z.enum(DOJ_ACTION_TYPES).describe('Type of DOJ action'),
        severity: z.enum(SEVERITY_LEVELS).describe('Severity level'),
        legal_basis: z.string().optional().describe('Which EFTA section is violated'),
        efta_numbers: z.array(z.string()).optional().describe('Specific EFTA documents involved'),
        source_urls: z.array(z.string()).optional().describe('Evidence source URLs'),
        status: z.enum(DOJ_STATUSES).optional().describe('Status (default: documented)'),
        notes: z.string().optional().describe('Internal notes'),
      },
    },
    async (params) => {
      const sb = getSupabase();
      const { data, error } = await sb.from('doj_accountability')
        .insert({
          date: params.date,
          title: params.title,
          description: params.description,
          action_type: params.action_type,
          severity: params.severity,
          legal_basis: params.legal_basis,
          efta_numbers: params.efta_numbers ?? [],
          source_urls: params.source_urls ?? [],
          status: params.status ?? 'documented',
          notes: params.notes,
        })
        .select('id, date, title, action_type, severity, status')
        .single();
      if (error) return errorResponse(error.message);
      return toolResponse({
        success: true,
        id: data.id,
        data,
        message: `DOJ action logged: "${data.title}"`,
      });
    },
  );
}
