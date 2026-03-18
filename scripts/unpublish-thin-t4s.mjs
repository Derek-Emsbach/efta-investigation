/**
 * T4 Entity Triage (Round 2)
 * Unpublish Dr. Chen and Gerd — insufficient evidence to justify published profiles.
 * - Dr. Chen: oral surgeon / service provider, identity may conflate two people
 * - Gerd: single name, identity unclear, 0 connections/events/docs
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

const UNPUBLISH = [
  { id: 'f32632bd-e741-457e-b4e3-fe3ff14e7a52', name: 'Dr. Chen' },
  { id: '3fe9ffc8-3441-44b1-9f0a-eee77307f4a0', name: 'Gerd' },
];

console.log('═══ UNPUBLISHING THIN T4 ENTITIES ═══\n');

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

console.log('\n═══ DONE ═══');
