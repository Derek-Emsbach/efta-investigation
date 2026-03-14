import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: story } = await sb.from('stories').select('id, title, slug, section, deck, reading_time_minutes, hero_image_url, published_at, is_published').eq('slug', 'the-governors-ranch').single();
console.log('=== Story ===');
console.log(story);

const { data: cites } = await sb.from('story_citations').select('citation_number, bates_number, description').eq('story_id', story.id).order('citation_number');
console.log('\n=== Citations (' + cites.length + ') ===');
for (const c of cites) console.log('  [' + c.citation_number + '] ' + c.bates_number + ' — ' + c.description.substring(0, 80));

const { data: ents } = await sb.from('story_entities').select('entities(name, tier), mention_count, is_primary').eq('story_id', story.id);
console.log('\n=== Entities (' + ents.length + ') ===');
for (const e of ents) console.log('  ' + (e.is_primary ? '★' : ' ') + ' ' + e.entities.name + ' (T' + e.entities.tier + ', ' + e.mention_count + ' mentions)');
