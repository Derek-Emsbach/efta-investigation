import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SIEGAL_ID = 'd52ef9ab-be09-4aa3-8b68-efb9219496e1';

async function main() {
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'peggy-siegal',
      tier_justification: 'T4 Associated — Social event coordinator who curated Epstein\'s post-conviction dinner guest lists. 50+ corpus documents. Received $90K Weinstein payment routed through Epstein (EFTA01899911). Arranged celebrity introductions and amfAR Cannes tickets. Financial dependence on Epstein documented. Bridge between Epstein and Weinstein social networks. No evidence of awareness of or participation in criminal activity.',
    })
    .eq('id', SIEGAL_ID);

  if (error) {
    console.error(`✗ Siegal publish failed: ${error.message}`);
  } else {
    console.log('✓ Peggy Siegal published with slug "peggy-siegal"');
  }

  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, profile_published, bio, tier_justification')
    .eq('id', SIEGAL_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${SIEGAL_ID},entity_b.eq.${SIEGAL_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', SIEGAL_ID);
  console.log(`Stats: ${connections} connections, ${events} events`);
}

main().catch(console.error);
