import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const KUYRKENDALL_ID = '0e6753f7-1f13-4ff8-aaa1-bac45120af90';

async function main() {
  // Set tier_justification and publish
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'nesbitt-kuyrkendall',
      tier_justification: 'T6 Peripheral (Law Enforcement) — Lead FBI Special Agent on Operation Leap Year (case 31E-MM-108062), the federal investigation of Jeffrey Epstein. Filed sworn declaration (EFTA01657747) that the case remained open as of September 2013. Authored FD-302 victim interview reports (EFTA01689279, EFTA01696101). Ran NCIC/FCIC background checks for victim identification (EFTA01695773, EFTA01692323). Coordinated with AUSA Villafana and USA Acosta. Not alleged to have participated in any wrongdoing — documented role is as the lead investigator whose case was undermined by the NPA.',
    })
    .eq('id', KUYRKENDALL_ID);

  if (error) {
    console.error(`Failed: ${error.message}`);
  } else {
    console.log('Published E. Nesbitt Kuyrkendall at /entities/nesbitt-kuyrkendall');
  }

  // Verify
  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, category, profile_published, tier_justification')
    .eq('id', KUYRKENDALL_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  // Stats
  const { count: docs } = await sb.from('entity_documents')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', KUYRKENDALL_ID);
  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${KUYRKENDALL_ID},entity_b.eq.${KUYRKENDALL_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', KUYRKENDALL_ID);
  console.log(`\nStats: ${docs} documents, ${connections} connections, ${events} events`);
}

main().catch(console.error);
