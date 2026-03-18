import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ASSISTANT_TOOLS, executeTool } from './tools'

/**
 * Read-only subset of assistant tools for community investigators.
 * Excludes all suggest_* tools and get_platform_context (admin-only).
 */
const INVESTIGATOR_TOOL_NAMES = new Set([
  'search_entities',
  'search_documents',
  'search_events',
  'get_entity_profile',
  'get_document_detail',
  'get_document_text',
  'query_connections',
  'cross_reference',
])

export const INVESTIGATOR_TOOLS: Anthropic.Tool[] = ASSISTANT_TOOLS.filter(
  (t) => INVESTIGATOR_TOOL_NAMES.has(t.name),
)

/**
 * Execute an investigator tool. Rejects any tool not in the allowed set.
 */
export async function executeInvestigatorTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<string> {
  if (!INVESTIGATOR_TOOL_NAMES.has(toolName)) {
    return JSON.stringify({ error: `Tool not available: ${toolName}` })
  }
  return executeTool(toolName, toolInput, supabase)
}
