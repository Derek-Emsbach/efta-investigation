import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const searches = ['victim journal', 'black book', 'contact directory', 'non-prosecution agreement', 'Giuffre deposition'];
for (const q of searches) {
  const { data } = await sb.from('documents').select('id, bates_number, title, document_type, severity').textSearch('search_vector', q, { type: 'plain' }).order('severity', { ascending: false, nullsFirst: false }).limit(5);
  console.log('\n--- ' + q + ' ---');
  for (const d of data || []) console.log('  ' + d.bates_number + ' — ' + (d.title || 'untitled').substring(0, 80) + ' [' + (d.severity || '-') + ']');
  if (!data?.length) console.log('  (no results)');
}

// Also check what bates numbers are used in existing story citations
const { data: cites } = await sb.from('story_citations').select('bates_number').limit(200);
const batesSet = new Set((cites || []).map(c => c.bates_number));
console.log('\n--- Bates numbers used in existing citations ---');
console.log([...batesSet].sort().join(', '));
