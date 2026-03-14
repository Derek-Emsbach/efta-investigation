import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get Richardson's full row to see what columns exist
const {data: r} = await sb.from('entities').select('*').ilike('name', 'Bill Richardson').single();
console.log('=== Richardson Full Row ===');
console.log('Keys:', Object.keys(r).join(', '));
console.log('\nValues:');
for (const [k,v] of Object.entries(r)) {
  if (v === null) console.log(`  ${k}: null`);
  else if (typeof v === 'object') console.log(`  ${k}: ${JSON.stringify(v).substring(0,100)}`);
  else console.log(`  ${k}: ${String(v).substring(0,100)}`);
}

// Also check a known-enriched entity (e.g. alan-dershowitz) to see what fields were used
const {data: ad} = await sb.from('entities').select('*').eq('slug','alan-dershowitz').single();
console.log('\n=== Dershowitz Metadata Keys ===');
console.log('metadata:', JSON.stringify(ad.metadata).substring(0, 500));
console.log('bio length:', ad.bio?.length);
console.log('profile_image_url:', ad.profile_image_url);
