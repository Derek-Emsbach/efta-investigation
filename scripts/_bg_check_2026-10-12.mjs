import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log('--- 10 most recent public_events ---');
const { data: recent, error } = await sb.from('public_events').select('id,date,title,category').order('date', { ascending: false }).limit(10);
if (error) { console.error('ERR', error.message); process.exit(1); }
for (const e of recent) console.log(`${e.date}  [${e.category}]  ${e.title}  (${e.id})`);

const terms = ['Botstein', 'Bard College', 'Raskin', 'Blanche fine', 'sanctions'];
for (const t of terms) {
  const { data, error: e2 } = await sb.from('public_events').select('id,date,title').textSearch('search_vector', t, { type: 'websearch' }).limit(10);
  console.log(`\n--- search: "${t}" ---`);
  if (e2) { console.log('ERR', e2.message); continue; }
  for (const d of data) console.log(`${d.date}  ${d.title}  (id:${d.id})`);
}
