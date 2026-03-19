import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VILLAFANA_ID = '2163ed8e-cadb-4d89-bab7-519f789a27d2';

async function main() {
  // Set slug, tier_justification, and publish
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: 'marie-villafana',
      tier_justification: 'T6 Peripheral (Legal) — Lead AUSA on Operation Leap Year (FBI case 31E-MM-108062), the federal investigation of Jeffrey Epstein. Authored the 82-page prosecution memo and 54-page draft 60-count indictment (May 2007). Filed Second Addendum adding new victims (EFTA00234505), immunity application targeting Lesley Groff (EFTA00234715), and OPR self-report documenting defense obstruction (EFTA00208244). Served as amicus counsel in CVRA litigation (EFTA00191148). Not alleged to have participated in any wrongdoing — documented role is as the prosecutor whose case was systematically undermined by defense appeals "to the powers above me."',
      status: 'active',
    })
    .eq('id', VILLAFANA_ID);

  if (error) {
    console.error(`Failed: ${error.message}`);
  } else {
    console.log('Published A. Marie Villafana at /entities/marie-villafana');
  }

  // Verify
  const { data } = await sb.from('entities')
    .select('id, name, slug, tier, category, profile_published, tier_justification, status')
    .eq('id', VILLAFANA_ID)
    .single();
  console.log('\nVerification:', JSON.stringify(data, null, 2));

  // Stats
  const { count: docs } = await sb.from('entity_documents')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', VILLAFANA_ID);
  const { count: connections } = await sb.from('entity_connections')
    .select('*', { count: 'exact', head: true })
    .or(`entity_a.eq.${VILLAFANA_ID},entity_b.eq.${VILLAFANA_ID}`);
  const { count: events } = await sb.from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', VILLAFANA_ID);

  console.log(`\nStats: ${docs} docs, ${connections} connections, ${events} events`);
}

main().catch(console.error);
