import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Photos sourced from Wikimedia Commons and other freely-licensed sources ───
// All images verified as freely licensed (CC or public domain)

const PHOTOS = {
  // Mark Epstein — Cooper Union board photo, CC BY 3.0, Wikimedia Commons
  'Mark Epstein':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Cooper_Union_Board_of_Trustees_Chairman_Mark_Epstein_Addresses_the_Cooper_Community.jpg/400px-Cooper_Union_Board_of_Trustees_Chairman_Mark_Epstein_Addresses_the_Cooper_Community.jpg',
};

// ── Entities with NO freely-licensed photos available ─────────────────────────
// Verified via Wikipedia API, Wikimedia Commons search, and Flickr CC search:
//
// T1: Leon Black — Commons has wrong Leon Black (basketball coach). No CC photos found.
// T1: Jim Kimsey — No Wikipedia image, no Commons category, no CC Flickr results.
// T1: Jean-Luc Brunel — No Wikipedia image, no Commons category. Died 2022 in French prison.
// T2: Lesley Groff — No Wikipedia image, no Commons category. Very private individual.
// T2: Sarah Kellen — No Wikipedia image. Brian Vickers photos exist but not of Kellen.
// T2: Nadia Marcinkova — Has Flickr account (Global Girl) but license unclear/likely copyrighted.
// T2: Adriana Ross — No Wikipedia page, no public photos found.
// T4: Barnaby Mars — No Wikipedia page, no public photos found.
// T4: Celina Edith Dubin — No Wikipedia page, no public photos found.
// T4: Dr. Chen — Insufficient identifying info for photo search.
// T4: Eva Andersson-Dubin — Has Wikipedia page but no freely-licensed photo.
// T4: Karyna Shuliak — No Wikipedia page, no public photos found.

async function main() {
  let updated = 0;

  for (const [name, url] of Object.entries(PHOTOS)) {
    const { data, error } = await sb.from('entities')
      .update({ profile_image_url: url })
      .eq('name', name)
      .eq('profile_published', true)
      .select('id, name');

    if (error) {
      console.error(`✗ ${name}: ${error.message}`);
    } else if (!data?.length) {
      console.error(`✗ ${name}: not found`);
    } else {
      console.log(`✓ ${name}`);
      updated++;
    }
  }

  // Final photo status
  const { data: all } = await sb.from('entities')
    .select('name, tier, profile_image_url')
    .eq('profile_published', true)
    .order('tier').order('name');

  const withPhoto = all.filter(e => e.profile_image_url);
  const without = all.filter(e => !e.profile_image_url);

  console.log(`\n=== PHOTO STATUS: ${withPhoto.length}/${all.length} have photos ===`);
  console.log('\nMissing photos:');
  without.forEach(e => console.log(`  T${e.tier} ${e.name}`));
}

main().catch(console.error);
