import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const targets = [
  { name: 'Sarah Kellen', slug: 'sarah-kellen' },
  { name: 'Nadia Marcinkova', slug: 'nadia-marcinkova' },
  { name: 'Adriana Ross', slug: 'adriana-ross' },
];

for (const t of targets) {
  // Check for slug collision
  const { data: existing } = await sb.from('entities')
    .select('id, name')
    .eq('slug', t.slug);

  if (existing?.length) {
    console.error(`✗ Slug "${t.slug}" already taken by ${existing[0].name}`);
    continue;
  }

  const { data, error } = await sb.from('entities')
    .update({ slug: t.slug })
    .eq('name', t.name)
    .select('id, name, slug, profile_published');

  if (error) {
    console.error(`✗ ${t.name}: ${error.message}`);
  } else {
    console.log(`✓ ${data[0].name} → /entities/${data[0].slug} (published: ${data[0].profile_published})`);
  }
}
