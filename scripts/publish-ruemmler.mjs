import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const RUEMMLER_ID = '3120ba47-cdea-4acc-b72c-909ba38068b8';

async function main() {
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'kathryn-ruemmler',
      tier_justification: 'T4 Associated — Former White House Counsel (2011-2014). Named successor trustee in Epstein\'s 2017 Trust (Section 7.1, EFTA01266434) and successor executor in his Last Will (EFTA01266268). 20+ corpus documents spanning 2010-2017. Documented dinners with Woody Allen/Peter Thiel, meeting with Bill Gates at Four Seasons, AG nomination coaching by Epstein, gifts (ring, TV, flowers), spa payments, apartment viewing. Introduced Cass Sunstein to Epstein. No evidence of awareness of or participation in criminal activity.',
    })
    .eq('id', RUEMMLER_ID);

  if (error) {
    console.error(`✗ Ruemmler publish failed: ${error.message}`);
  } else {
    console.log('✓ Kathryn Ruemmler published with slug "kathryn-ruemmler"');
  }

  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, profile_published, bio, tier_justification')
    .eq('id', RUEMMLER_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${RUEMMLER_ID},entity_b.eq.${RUEMMLER_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', RUEMMLER_ID);
  console.log(`Stats: ${connections} connections, ${events} events`);
}

main().catch(console.error);
