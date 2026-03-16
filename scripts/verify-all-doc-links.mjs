import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get published entities
const { data: published } = await sb.from('entities')
  .select('id,name,tier')
  .eq('profile_published', true)
  .order('tier').order('name');

console.log('Published entity doc link counts (via count query):');
for (const e of published) {
  const { count } = await sb.from('entity_documents')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', e.id);
  console.log(`  T${e.tier} ${e.name.padEnd(35)} ${count}`);
}
