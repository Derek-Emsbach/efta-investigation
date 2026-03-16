import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Photos sourced from Wikimedia Commons (freely licensed)
const PHOTOS = {
  'Dan Snyder':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Dan_Snyder_%28cropped%29.jpg/400px-Dan_Snyder_%28cropped%29.jpg',

  'Glenn Dubin':
    'https://upload.wikimedia.org/wikipedia/commons/e/ef/GlennDubin.jpg',

  'Larry Summers':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Lawrence_Summers_Treasury_portrait.jpg/400px-Lawrence_Summers_Treasury_portrait.jpg',
};

// No freely-licensed Wikimedia Commons photos available for:
// - Jean-Luc Brunel (no Wikipedia page image, no Commons category)
// - Jim Kimsey (no Wikipedia page image, no Commons category)
// - Leon Black (Commons category exists but contains 0 files)
// - Lesley Groff (no Wikipedia page image, no Commons category)
// - Sarah Kellen, Nadia Marcinkova, Adriana Ross (no Wikipedia images)

async function main() {
  let updated = 0;

  for (const [name, url] of Object.entries(PHOTOS)) {
    const { data, error } = await sb.from('entities')
      .update({ profile_image_url: url })
      .eq('name', name)
      .eq('profile_published', true)
      .select('id, name, profile_image_url');

    if (error) {
      console.error(`✗ ${name}: ${error.message}`);
    } else if (!data?.length) {
      console.error(`✗ ${name}: not found`);
    } else {
      console.log(`✓ ${name} → ${url.substring(0, 80)}...`);
      updated++;
    }
  }

  // Verify: list all published entities and their photo status
  const { data: all } = await sb.from('entities')
    .select('name, tier, profile_image_url')
    .eq('profile_published', true)
    .order('tier').order('name');

  console.log(`\n=== Photo status (${updated} updated) ===`);
  for (const e of all) {
    const status = e.profile_image_url ? '✓' : '✗';
    console.log(`  ${status} T${e.tier} ${e.name}`);
  }
}

main().catch(console.error);
