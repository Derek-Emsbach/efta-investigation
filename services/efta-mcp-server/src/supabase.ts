import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// Helpers — truncate large payloads for tool responses
// ---------------------------------------------------------------------------

export function safeJson(data: unknown, maxLen = 8000): string {
  const raw = JSON.stringify(data, null, 2);
  if (raw.length <= maxLen) return raw;
  const truncated = raw.slice(0, maxLen);
  return truncated + `\n\n[TRUNCATION_INFO: ${JSON.stringify({ truncated: true, shown_chars: maxLen, total_chars: raw.length })}]`;
}

// ---------------------------------------------------------------------------
// Standardized MCP tool response helpers
// ---------------------------------------------------------------------------

export type ToolResult = {
  content: [{ type: 'text'; text: string }];
};

export function toolResponse(payload: {
  success: boolean;
  data?: unknown;
  count?: number;
  total_count?: number;
  message?: string;
  id?: string;
}, maxLen = 8000): ToolResult {
  return {
    content: [{
      type: 'text' as const,
      text: safeJson(payload, maxLen),
    }],
  };
}

export function errorResponse(message: string): ToolResult {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ success: false, error: message }),
    }],
  };
}
