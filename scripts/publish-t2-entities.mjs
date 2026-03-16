import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const T2_ENTITIES = [
  {
    name: 'Sarah Kellen',
    bio: 'Epstein\'s primary logistics coordinator and one of four individuals granted blanket immunity under the 2007 Non-Prosecution Agreement. FBI interviews describe her as the person who scheduled victims for "massages," maintained the appointment calendar, and served as the first point of contact for recruited girls. Performed functions identical to Ghislaine Maxwell — who was convicted and sentenced to 20 years — but was never charged.',
  },
  {
    name: 'Nadia Marcinkova',
    bio: 'Slovakian national brought to the United States by Epstein as a teenager. Described in court filings as a "live-in sex slave" who was later transitioned into an active participant in abuse. Named in the 2007 Non-Prosecution Agreement with blanket immunity. Epstein purchased a Harley-Davidson motorcycle for her father Peter Marcinkova in Slovakia. Now operates as a helicopter pilot under the name "Global Girl" — her past effectively erased by the NPA\'s immunity provisions.',
  },
  {
    name: 'Adriana Ross',
    bio: 'Polish national and former model who served as Epstein\'s household coordinator at his Palm Beach estate. Named in the 2007 Non-Prosecution Agreement with blanket immunity. FBI briefing documents describe her involvement in evidence destruction — specifically the removal and concealment of materials from the Palm Beach property during the 2005-2006 investigation. Invoked Fifth Amendment rights when deposed in civil litigation.',
  },
];

async function main() {
  for (const t2 of T2_ENTITIES) {
    // Find entity
    const { data: entity } = await sb.from('entities')
      .select('id, name, slug, tier, profile_published, bio')
      .eq('name', t2.name)
      .single();

    if (!entity) {
      console.error(`✗ ${t2.name}: NOT FOUND`);
      continue;
    }

    console.log(`\n${entity.name} (T${entity.tier}):`);
    console.log(`  Current: slug=${entity.slug}, published=${entity.profile_published}, bio=${entity.bio ? 'yes' : 'no'}`);

    // Update: publish + bio
    const { error } = await sb.from('entities')
      .update({
        profile_published: true,
        bio: t2.bio,
      })
      .eq('id', entity.id);

    if (error) {
      console.error(`  ✗ Update failed: ${error.message}`);
    } else {
      console.log(`  ✓ Published with bio (${t2.bio.length} chars)`);
    }

    // Verify doc links
    const { count: docLinks } = await sb.from('entity_documents')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id);

    const { count: connections } = await sb.from('entity_connections')
      .select('*', { count: 'exact', head: true })
      .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);

    const { count: events } = await sb.from('entity_events')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id);

    const { count: stories } = await sb.from('story_entities')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id);

    console.log(`  Stats: ${docLinks} docs, ${connections} connections, ${events} events, ${stories} stories`);
  }

  // Final count
  const { count: totalPublished } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('profile_published', true);
  console.log(`\n=== Total published entities: ${totalPublished} ===`);
}

main().catch(console.error);
