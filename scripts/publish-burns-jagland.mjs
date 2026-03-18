import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ENTITIES = [
  {
    id: 'c1b2ed72-b471-451c-90a4-11d935282a17',
    name: 'William J. Burns',
    slug: 'william-j-burns',
    tier_justification: 'T4 Associated — Career diplomat. Deputy Secretary of State (2011-2014), later CIA Director (2021-2025). 10+ corpus documents. At Epstein\'s Manhattan townhouse at least twice in September 2014 while sitting Deputy Secretary of State (Sept 13 with Peter Thiel, Sept 24 scheduled appointment). Epstein used Burns\'s title as social currency. Epstein brokered Burns\'s access to Rød-Larsen and Bannon. No flight log appearances or victim testimony. No evidence of awareness of or participation in criminal activity.',
  },
  {
    id: 'd73e6a80-3fd1-43d8-aa9b-02caa39ad272',
    name: 'Thorbjørn Jagland',
    slug: 'thorbjorn-jagland',
    tier_justification: 'T4 Associated — Secretary General of the Council of Europe (2009-2019), former Prime Minister of Norway (1996-1997), Chairman of the Norwegian Nobel Committee (2009-2015). 15+ corpus documents spanning 2013-2014. Direct first-name email correspondence with Epstein. Epstein paid for hotel rooms (3 rooms at the Ritz). Jagland hosted Epstein at his official Secretary General residence in Strasbourg. Invited to Epstein\'s private island. On September 2014 \'People To See\' master list. No evidence of awareness of or participation in criminal activity.',
  },
];

async function main() {
  for (const entity of ENTITIES) {
    const { error } = await sb.from('entities')
      .update({
        profile_published: true,
        slug: entity.slug,
        tier_justification: entity.tier_justification,
      })
      .eq('id', entity.id);

    if (error) {
      console.error(`FAILED ${entity.name}:`, error.message);
    } else {
      console.log(`Published: ${entity.name} → /entities/${entity.slug}`);
    }
  }

  // Verify
  console.log('\n--- Verification ---');
  for (const entity of ENTITIES) {
    const { data } = await sb.from('entities')
      .select('id, name, slug, profile_published, tier, tier_justification')
      .eq('id', entity.id)
      .single();
    console.log(`${data?.name}: published=${data?.profile_published}, slug=${data?.slug}, tier=${data?.tier}`);

    const { data: conns } = await sb.from('entity_connections')
      .select('id')
      .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);
    console.log(`  Connections: ${conns?.length || 0}`);

    const { data: events } = await sb.from('event_entities')
      .select('id')
      .eq('entity_id', entity.id);
    console.log(`  Events: ${events?.length || 0}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
