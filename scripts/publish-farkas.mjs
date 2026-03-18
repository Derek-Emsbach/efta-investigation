import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const entity = {
  id: 'e667fe14-33eb-4a0a-9f75-85d13338fc0c',
  name: 'Andrew Farkas',
  slug: 'andrew-farkas',
  tier_justification: 'T4 Associated — Real estate investor, founder/CEO of Island Capital Group. 20+ corpus documents spanning March 2013-November 2014. Recurring breakfast meetings at Epstein\'s NYC townhouse and Farkas\'s home. Epstein offered Farkas\'s private plane to Larry Summers (EFTA01940899). Farkas in St. Thomas contemporaneous with Epstein (EFTA01899767). Same-day schedule as Bill Gates Sept 8, 2014 (EFTA02098640). On September 2014 "People To See" master list. Christmas gift exchange. Deutsche Bank contact list. No flight log appearances or victim testimony. No criminal charges or allegations.',
};

async function main() {
  const { error } = await sb.from('entities')
    .update({
      profile_published: true,
      slug: entity.slug,
      tier_justification: entity.tier_justification,
    })
    .eq('id', entity.id);

  if (error) {
    console.error(`FAILED:`, error.message);
  } else {
    console.log(`Published: ${entity.name} → /entities/${entity.slug}`);
  }

  // Verify
  const { data } = await sb.from('entities')
    .select('id, name, slug, profile_published, tier')
    .eq('id', entity.id)
    .single();
  console.log(`Verified: published=${data?.profile_published}, slug=${data?.slug}, tier=${data?.tier}`);

  const { data: conns } = await sb.from('entity_connections')
    .select('id')
    .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
  console.log(`Connections: ${conns?.length || 0}`);

  const { data: events } = await sb.from('event_entities')
    .select('id')
    .eq('entity_id', entity.id);
  console.log(`Events: ${events?.length || 0}`);
}

main().catch(e => { console.error(e); process.exit(1); });
