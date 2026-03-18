/**
 * T4 Corporate Entity Triage
 * - Unpublish 4 empty corporate shells (KKR, Oaktree, Blackstone, Carlyle)
 * - Add Apollo story_entities links (Stories 8 & 17)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; })
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('*** DRY RUN ***\n');

// ── Step 1: Unpublish 4 corporate shells ──────────────────────────────

const UNPUBLISH = [
  { id: 'dbe27c07-adb6-4554-b60c-11112ff77156', name: 'KKR & Co. L.P.' },
  { id: '2284773c-7892-4ea7-a608-44759cced527', name: 'Oaktree Capital Group, LLC' },
  { id: '98625a38-2bbd-43ec-a67a-5adf3e63d037', name: 'The Blackstone Group LP' },
  { id: '01fb8cb3-f280-4423-ad26-0cd9d2656876', name: 'The Carlyle Group LP' },
];

console.log('═══ UNPUBLISHING CORPORATE SHELLS ═══\n');

for (const entity of UNPUBLISH) {
  if (!dryRun) {
    const { error } = await sb.from('entities')
      .update({ profile_published: false })
      .eq('id', entity.id);
    if (error) {
      console.log(`  ✗ ${entity.name}: ${error.message}`);
    } else {
      console.log(`  ✓ ${entity.name} — unpublished`);
    }
  } else {
    console.log(`  Would unpublish: ${entity.name}`);
  }
}

// ── Step 2: Add Apollo to story_entities ───────────────────────────────

const APOLLO_ID = 'df58a468-c939-444a-b631-1400bec949f6';

const STORY_LINKS = [
  { slug: 'the-billion-dollar-blind-eye', mention_count: 3, is_primary: false },
  { slug: 'the-architecture-of-opacity', mention_count: 2, is_primary: false },
];

console.log('\n═══ LINKING APOLLO TO STORIES ═══\n');

for (const link of STORY_LINKS) {
  const { data: story, error: storyErr } = await sb.from('stories')
    .select('id, title')
    .eq('slug', link.slug)
    .single();

  if (storyErr || !story) {
    console.log(`  ✗ Story "${link.slug}" not found: ${storyErr?.message}`);
    continue;
  }

  // Check for existing link
  const { data: existing } = await sb.from('story_entities')
    .select('id')
    .eq('story_id', story.id)
    .eq('entity_id', APOLLO_ID)
    .maybeSingle();

  if (existing) {
    console.log(`  – ${story.title} — already linked`);
    continue;
  }

  if (!dryRun) {
    const { error: insertErr } = await sb.from('story_entities').insert({
      story_id: story.id,
      entity_id: APOLLO_ID,
      mention_count: link.mention_count,
      is_primary: link.is_primary,
    });
    if (insertErr) {
      console.log(`  ✗ ${story.title}: ${insertErr.message}`);
    } else {
      console.log(`  ✓ ${story.title} — linked (${link.mention_count} mentions)`);
    }
  } else {
    console.log(`  Would link: ${story.title} (${link.mention_count} mentions)`);
  }
}

console.log('\n═══ DONE ═══');
