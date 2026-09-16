/**
 * Link all real (non-corpus) document_images to entities via entity_documents.
 * Run this after extract-priority-images.mjs to populate image_entities.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('apps/web/.env.local','utf8').split('\n')
    .filter(l=>l&&!l.startsWith('#'))
    .map(l=>{const i=l.indexOf('=');return i>0?[l.substring(0,i).trim(),l.substring(i+1).trim()]:null})
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get all real images
const {data: images} = await sb.from('document_images')
  .select('id,document_id')
  .like('r2_key','images/%_i0.jpg');
console.log('Real extracted images:', images?.length);

// Group by document_id
const byDoc = new Map();
for (const img of images ?? []) {
  if (!byDoc.has(img.document_id)) byDoc.set(img.document_id, []);
  byDoc.get(img.document_id).push(img.id);
}
console.log('Unique docs:', byDoc.size);

// For each doc, get entity links and create image_entities
let linked = 0;
let docsDone = 0;
for (const [docId, imgIds] of byDoc) {
  const {data: entityLinks} = await sb.from('entity_documents')
    .select('entity_id').eq('document_id', docId);
  if (!entityLinks?.length) continue;

  const rows = [];
  for (const {entity_id} of entityLinks) {
    for (const image_id of imgIds) {
      rows.push({image_id, entity_id, role:'background', confidence:'possible'});
    }
  }
  if (rows.length > 0) {
    const {error} = await sb.from('image_entities').upsert(rows, {
      onConflict:'image_id,entity_id', ignoreDuplicates:true
    });
    if (!error) linked += rows.length;
  }
  docsDone++;
  if (docsDone % 20 === 0) console.log(`  ${docsDone}/${byDoc.size} docs linked...`);
}
console.log(`Done. Created ${linked} image_entity links across ${docsDone} docs.`);
