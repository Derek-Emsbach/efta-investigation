import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CHASIN_ID = 'dc1ed9b6-4115-4a59-9708-c8fe1230ca78';

async function main() {
  // Update name from "Mr. Dana" to "Dana Chasin" and publish
  const { error } = await sb.from('entities')
    .update({
      name: 'Dana Chasin',
      profile_published: true,
      slug: 'dana-chasin',
      tier_justification: 'T3 Circumstantial — Named in forensically authenticated victim journal (EFTA02731420 p.5) and positively identified in Wigdor Law attorney letter (EFTA02731721, March 2024) as the person who flew a minor victim to Epstein\'s NYC townhouse. Victim\'s family "knew Dana Chasin." Named alongside Larry Summers as co-participant. No sworn testimony or criminal charges — journal + attorney letter constitute circumstantial documentary evidence.',
    })
    .eq('id', CHASIN_ID);

  if (error) {
    console.error(`✗ Failed: ${error.message}`);
  } else {
    console.log('✓ Dana Chasin published (renamed from "Mr. Dana")');
  }

  // Verify
  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, profile_published, category')
    .eq('id', CHASIN_ID)
    .single();
  console.log('Verification:', JSON.stringify(data, null, 2));

  // Stats
  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${CHASIN_ID},entity_b.eq.${CHASIN_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', CHASIN_ID);
  console.log(`Stats: ${connections} connections, ${events} events`);
}

main().catch(console.error);
