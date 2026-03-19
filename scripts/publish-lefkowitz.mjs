import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const LEFKOWITZ_ID = 'cc3d2961-0c7b-40e8-a3a3-73fd03ade71f';

async function main() {
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'jay-lefkowitz',
      tier_justification: 'T6 Peripheral (Legal) — Kirkland & Ellis partner who served as primary NPA negotiator for Jeffrey Epstein. Former colleague of U.S. Attorney Alexander Acosta at Kirkland & Ellis. After NPA signing, wrote to prosecutors: "Please do whatever you can to keep this from becoming public" (EFTA00215004). Documented in 25+ corpus documents across Datasets 1, 5, 9, and 10. Role was legal representation — no evidence of participation in criminal conduct. Key documents: EFTA01659888, EFTA00208244, EFTA00215004, EFTA01626136.',
    })
    .eq('id', LEFKOWITZ_ID);

  if (error) {
    console.error(`Failed: ${error.message}`);
  } else {
    console.log('Published Jay Lefkowitz with slug "jay-lefkowitz"');
  }

  // Verify
  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, profile_published, tier_justification')
    .eq('id', LEFKOWITZ_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  // Stats
  const { count: docs } = await sb.from('document_entities')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', LEFKOWITZ_ID);
  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${LEFKOWITZ_ID},entity_b.eq.${LEFKOWITZ_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', LEFKOWITZ_ID);
  console.log(`Stats: ${docs} documents, ${connections} connections, ${events} events`);
}

main().catch(console.error);
