import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from('stories').select('id,title,slug,is_published,section,created_at').eq('slug', 'normal-for-this-client');
if (error) console.log('Error:', error.message);
else if (!data.length) console.log('NOT FOUND in database');
else {
  console.log('Story:', JSON.stringify(data[0], null, 2));
  const { count: citCount } = await sb.from('story_citations').select('*', { count: 'exact', head: true }).eq('story_id', data[0].id);
  const { count: entCount } = await sb.from('story_entities').select('*', { count: 'exact', head: true }).eq('story_id', data[0].id);
  console.log(`Citations: ${citCount}, Entity links: ${entCount}`);
}
