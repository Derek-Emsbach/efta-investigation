import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const GATES_ID = '701de77d-c3c8-4611-995e-afdfa068b7a9';

async function main() {
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'bill-gates',
      tier_justification: 'T4 Associated — 25+ emails in EFTA corpus spanning 2011-2014, all post-conviction. Stayed at Epstein\'s Paris residence (March 2013). Attended dinner at NYC townhouse with Summers and Staley (May 2011). Epstein used Gates\'s name to recruit for financial gatherings. No evidence of awareness of or participation in criminal activity.',
    })
    .eq('id', GATES_ID);

  if (error) {
    console.error(`✗ Gates publish failed: ${error.message}`);
  } else {
    console.log('✓ Bill Gates published with slug "bill-gates"');
  }

  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, profile_published, bio, tier_justification')
    .eq('id', GATES_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${GATES_ID},entity_b.eq.${GATES_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', GATES_ID);
  console.log(`Stats: ${connections} connections, ${events} events`);
}

main().catch(console.error);
