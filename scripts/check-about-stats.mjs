import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Count published entities
const {count: publishedEntities} = await sb.from('entities').select('*', {count: 'exact', head: true}).eq('profile_published', true);
const {count: totalEntities} = await sb.from('entities').select('*', {count: 'exact', head: true});

// Count published stories
const {count: stories} = await sb.from('stories').select('*', {count: 'exact', head: true}).eq('is_published', true);

// Count citations
const {count: citations} = await sb.from('story_citations').select('*', {count: 'exact', head: true});

// Count case files
const {count: caseFiles} = await sb.from('case_files').select('*', {count: 'exact', head: true}).eq('is_published', true);

// Count open questions
const {count: openQuestions} = await sb.from('open_questions').select('*', {count: 'exact', head: true});

// Count entity-document links
const {count: docLinks} = await sb.from('entity_documents').select('*', {count: 'exact', head: true});

// Count story entity links
const {count: storyEntities} = await sb.from('story_entities').select('*', {count: 'exact', head: true});

console.log('=== Current Stats ===');
console.log(`Published entities: ${publishedEntities}`);
console.log(`Total entities: ${totalEntities}`);
console.log(`Published stories: ${stories}`);
console.log(`Total citations: ${citations}`);
console.log(`Published case files: ${caseFiles}`);
console.log(`Open questions: ${openQuestions}`);
console.log(`Story-entity links: ${storyEntities}`);
console.log(`Entity-document links: ${docLinks}`);
