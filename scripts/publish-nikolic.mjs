import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const entity = {
  id: 'ddb2b0e7-ccc1-471d-b7e9-293d6a250359',
  name: 'Boris Nikolic',
  slug: 'boris-nikolic',
  tier_justification: 'T4 Associated — Croatian-born venture capitalist, former Bill Gates science advisor (BGC3). Named successor executor in Epstein\'s will signed Aug 8, 2019 (two days before death). Extensive personal email correspondence 2011-2014. Three-way email chains with Kimbal Musk. Gates authorized Epstein to negotiate Nikolic\'s severance (EFTA01965179). On Sept 2014 "People To See" list. FBI FD-1023 (EFTA00128843) documents Nikolic pursuing DARPA-funded AI investments — FBI counterintelligence interest. Publicly declined executor role. No criminal charges or allegations.',
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

  const { data: events } = await sb.from('entity_events')
    .select('id')
    .eq('entity_id', entity.id);
  console.log(`Events: ${events?.length || 0}`);
}

main().catch(e => { console.error(e); process.exit(1); });
