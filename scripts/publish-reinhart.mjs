import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const REINHART_ID = 'abec8a80-5e10-493f-aca5-ca3bce3d27db';

async function main() {
  // Publish Reinhart
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'bruce-reinhart',
      tier_justification: 'T6 Peripheral (Legal) — Former AUSA who left the U.S. Attorney\'s Office during the Epstein investigation and immediately represented Epstein\'s co-conspirators. Filed a false affidavit (admitted false by DOJ). $84K+ in documented payments from Epstein. Now a U.S. Magistrate Judge. Not alleged to have participated in abuse — documented role is in the prosecutorial failure and cover-up.',
    })
    .eq('id', REINHART_ID);

  if (error) {
    console.error(`✗ Reinhart publish failed: ${error.message}`);
  } else {
    console.log('✓ Bruce Reinhart published with slug "bruce-reinhart"');
  }

  // Verify
  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, profile_published, bio, tier_justification')
    .eq('id', REINHART_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  // Stats
  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${REINHART_ID},entity_b.eq.${REINHART_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', REINHART_ID);
  console.log(`Stats: ${connections} connections, ${events} events`);
}

main().catch(console.error);
