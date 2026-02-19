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
  return raw.slice(0, maxLen) + '\n... [truncated]';
}
