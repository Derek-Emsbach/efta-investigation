import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('=').map(s => s.trim())).filter(a => a.length === 2));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check actual column names
const { data: sample } = await sb.from('entity_connections').select('*').limit(1);
console.log('Column names:', Object.keys(sample[0]));
console.log('Sample row:', JSON.stringify(sample[0], null, 2));

// Get all connections
const connRes = await sb.from('entity_connections').select('*');
console.log('\nConnections error:', connRes.error?.message || 'none');
console.log('Connections count:', connRes.data?.length || 0);

if (!connRes.data?.length) {
  console.log('No connections found!');
  process.exit(0);
}

// Get all entities for name lookup
const { data: ents } = await sb.from('entities').select('id, name, tier, profile_published');
const nameMap = {};
for (const e of ents) nameMap[e.id] = { name: e.name, tier: e.tier, pub: e.profile_published };

console.log('\nALL CONNECTIONS:');
for (const c of connRes.data) {
  const a = nameMap[c.entity_a_id] || { name: 'MISSING:' + String(c.entity_a_id).substring(0, 8), tier: '?', pub: false };
  const b = nameMap[c.entity_b_id] || { name: 'MISSING:' + String(c.entity_b_id).substring(0, 8), tier: '?', pub: false };
  console.log(`  ${a.name} (T${a.tier}${a.pub ? ',pub' : ''}) --[${c.relationship_type}]--> ${b.name} (T${b.tier}${b.pub ? ',pub' : ''})`);
}

// Count connections per published entity
console.log('\nCONNECTIONS PER PUBLISHED ENTITY:');
const pubEnts = ents.filter(e => e.profile_published);
for (const e of pubEnts.sort((a, b) => a.name.localeCompare(b.name))) {
  const count = connRes.data.filter(c => c.entity_a_id === e.id || c.entity_b_id === e.id).length;
  if (count > 0) console.log(`  ${e.name} (T${e.tier}): ${count} connections`);
}

// Test the audit query pattern
const epstein = ents.find(e => e.name === 'Jeffrey Epstein');
if (epstein) {
  console.log('\nDEBUG: Testing .or() count query for Epstein ID:', epstein.id);
  const r = await sb.from('entity_connections').select('id', { count: 'exact' })
    .or(`entity_a_id.eq.${epstein.id},entity_b_id.eq.${epstein.id}`);
  console.log('  .or() result — count:', r.count, 'data.length:', r.data?.length, 'error:', r.error?.message || 'none');

  // head:true variant
  const r2 = await sb.from('entity_connections').select('id', { count: 'exact', head: true })
    .or(`entity_a_id.eq.${epstein.id},entity_b_id.eq.${epstein.id}`);
  console.log('  head:true — count:', r2.count, 'error:', r2.error?.message || 'none');
}
