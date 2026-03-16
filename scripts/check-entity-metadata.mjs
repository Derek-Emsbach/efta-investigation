import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check a couple entities to see metadata structure
const { data } = await sb.from('entities')
  .select('name,tier,category,status,metadata,profile_image_url')
  .eq('profile_published', true)
  .in('name', ['Bill Richardson', 'Ghislaine Maxwell', 'Leon Black', 'Apollo Global Management LLC'])
  .order('name');

for (const e of data) {
  console.log(`\n=== ${e.name} (T${e.tier}) ===`);
  console.log(`Category: ${e.category}, Status: ${e.status}`);
  console.log(`Photo: ${e.profile_image_url ? 'yes' : 'no'}`);
  console.log(`Metadata keys: ${Object.keys(e.metadata || {}).join(', ')}`);
  if (e.metadata?.bio) console.log(`Bio: "${e.metadata.bio.substring(0, 100)}..."`);
  if (e.metadata?.evidence_summary) console.log(`Evidence summary: "${e.metadata.evidence_summary.substring(0, 100)}..."`);
}
