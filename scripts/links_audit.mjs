import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('/mnt/user-data/uploads/efta-investigation/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; })
    .filter(Boolean)
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { count: total } = await sb.from('entity_documents').select('id', { count: 'exact', head: true });
const { count: withExcerpt } = await sb.from('entity_documents').select('id', { count: 'exact', head: true }).not('excerpt', 'is', null);
const { count: withPage } = await sb.from('entity_documents').select('id', { count: 'exact', head: true }).not('page_number', 'is', null);

console.log('entity_documents total: ' + total);
console.log('  with excerpt (a quote supporting the link): ' + withExcerpt);
console.log('  with page_number: ' + withPage);

const { data: roles } = await sb.from('entity_documents').select('role_in_document').limit(3000);
const rc = {};
roles.forEach(r => { const k = r.role_in_document ?? 'null'; rc[k] = (rc[k] || 0) + 1; });
console.log('  roles in 3000 sample: ' + JSON.stringify(rc));

const { data: sample } = await sb.from('entity_documents').select('*').limit(1);
console.log('\nSAMPLE LINK ROW:\n' + JSON.stringify(sample[0], null, 1));

const { data: ents } = await sb.from('entities').select('id,name');
const nameById = Object.fromEntries(ents.map(e => [e.id, e.name]));

const counts = {};
let from = 0;
for (;;) {
  const { data, error } = await sb.from('entity_documents').select('entity_id').range(from, from + 999);
  if (error || !data || data.length === 0) break;
  data.forEach(d => { counts[d.entity_id] = (counts[d.entity_id] || 0) + 1; });
  from += 1000;
  if (from > 95000) break;
}

const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log('\nTOP ENTITIES BY LINK COUNT:');
top.forEach(([id, c]) => console.log('  ' + String(c).padStart(6) + '  ' + (nameById[id] || '(orphan entity ' + id.slice(0, 8) + ')')));
console.log('\ndistinct entities holding links: ' + Object.keys(counts).length + ' of ' + ents.length + ' entities');
console.log('rows scanned: ' + from);
