import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ENTITIES = [
  {
    id: '7d42f463-4b83-40b1-9e42-80c98868d939',
    name: 'Peter Thiel',
    slug: 'peter-thiel',
    tier_justification: 'T4 Associated — Co-founder of PayPal, Palantir Technologies. 25+ corpus documents. Direct email correspondence with Epstein April-September 2014. Dinners at Epstein\'s NYC townhouse with Woody Allen, Kathy Ruemmler (Sept 13, 2014), Ehud Barak (June 9, 2014). Brunch with Bob Kerrey, Ruemmler, Cass Sunstein (Sept 14, 2014). No evidence of awareness of or participation in criminal activity.',
  },
  {
    id: '46f77660-52c5-49fa-9333-ecce910f69fd',
    name: 'Woody Allen',
    slug: 'woody-allen',
    tier_justification: 'T4 Associated — Filmmaker. 25+ corpus documents spanning 2011-2014 (4 years, all post-conviction). Regular dinner guest with Soon-Yi Previn. 23andMe genome testing ordered by Epstein for Allen and Previn (EFTA01780903). Assistant-to-assistant scheduling coordination. Publicly accused of child sexual abuse by adopted daughter Dylan Farrow. No evidence of awareness of or participation in Epstein\'s criminal activity.',
  },
  {
    id: '3fdbbc66-fb5f-45bf-970c-833e167e49bf',
    name: 'Ehud Barak',
    slug: 'ehud-barak',
    tier_justification: 'T3 Circumstantial — Former Prime Minister of Israel (1999-2001) and Minister of Defense. 20+ corpus documents spanning 2013-2014. Direct email correspondence. 9 shared flights with Sarah Kellen per flight logs. Planned stays at Epstein NYC residence (2017). Israeli government installed security at Epstein-connected apartment building (2016-2018). Meetings with Peter Thiel, Kathy Ruemmler, Peter Mandelson, Jes Staley. Photographed with Ghislaine Maxwell.',
  },
  {
    id: 'c5fe31fc-0bce-4dac-85b1-7a90b586e855',
    name: 'Brad Karp',
    slug: 'brad-karp',
    tier_justification: 'T4 Associated — Chairman of Paul, Weiss, Rifkind, Wharton & Garrison LLP. 20+ corpus documents. Recurring meetings with Epstein Dec 2013-Aug 2016 at Paul Weiss offices. Explicitly tasked by Epstein with recruiting sitting White House Counsel Ruemmler: "Hope you can convince Kathy Ruemmler" (EFTA01752843). Post-arrest engagement documented (2019 Bannon/Augusta National). No evidence of awareness of or participation in criminal activity.',
  },
  {
    id: 'dce2c027-e2d2-489b-a601-fb5f6e5babf6',
    name: 'Bob Kerrey',
    slug: 'bob-kerrey',
    tier_justification: 'T4 Associated — Former Governor (1983-1987) and U.S. Senator (1989-2001) from Nebraska. Medal of Honor recipient. President of The New School (2001-2010). 20 corpus documents. 2+ formal events at Epstein\'s townhouse: April 2013 dinner with Woody Allen, Sept 2014 brunch with Peter Thiel, Kathy Ruemmler, Cass Sunstein. No evidence of awareness of or participation in criminal activity.',
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
      console.error(`✗ ${entity.name} publish failed: ${error.message}`);
    } else {
      console.log(`✓ ${entity.name} published with slug "${entity.slug}"`);
    }
  }

  console.log('\n── Verification ──');
  for (const entity of ENTITIES) {
    const { data } = await sb.from('entities')
      .select('id, name, slug, tier, profile_published')
      .eq('id', entity.id)
      .single();

    const { count: connections } = await sb.from('entity_connections')
      .select('*', { count: 'exact', head: true })
      .or(`entity_a.eq.${entity.id},entity_b.eq.${entity.id}`);

    const { count: events } = await sb.from('entity_events')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', entity.id);

    console.log(`${data.name}: T${data.tier}, ${data.slug}, published=${data.profile_published}, ${connections} connections, ${events} events`);
  }
}

main().catch(console.error);
