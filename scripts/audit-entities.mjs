import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('=').map(s => s.trim())).filter(a => a.length === 2));

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: ents } = await sb.from('entities')
  .select('id,name,tier,category,bio,profile_image_url,financial_summary,metadata')
  .eq('profile_published', true)
  .order('tier').order('name');

const out = [];
for (const e of ents) {
  const [d, ev, c, s, cf] = await Promise.all([
    sb.from('entity_documents').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
    sb.from('entity_events').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
    sb.from('entity_connections').select('id', { count: 'exact', head: true }).or(`entity_a_id.eq.${e.id},entity_b_id.eq.${e.id}`),
    sb.from('story_entities').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
    sb.from('case_file_entities').select('id', { count: 'exact', head: true }).eq('entity_id', e.id),
  ]);

  const hasBio = e.bio && e.bio.length > 20;
  const hasEv = e.metadata?.evidence_summary?.length > 20;
  const hasPh = Boolean(e.profile_image_url);
  const hasFin = e.financial_summary && Object.keys(e.financial_summary).length > 0;

  let sc = 0;
  if (hasBio) sc++;
  if (hasEv) sc++;
  if (hasPh) sc++;
  if (hasFin) sc++;
  if (d.count > 0) sc++;
  if (d.count > 5) sc++;
  if (ev.count > 0) sc++;
  if (c.count > 0) sc++;
  if (s.count > 0) sc++;
  if (cf.count > 0) sc++;

  out.push({ name: e.name, tier: e.tier, cat: e.category || '-', sc, bio: hasBio, ev: hasEv, ph: hasPh, fi: hasFin, docs: d.count, events: ev.count, conns: c.count, stories: s.count, cf: cf.count });
}

out.sort((a, b) => a.sc - b.sc || a.tier - b.tier);

const y = v => v ? 'Y' : '-';
console.log(`\nENTITY PROFILE RICHNESS AUDIT (${out.length} published)`);
console.log('Score 0-10: bio, evSummary, photo, financial, docs>0, docs>5, events, conns, stories, caseFiles\n');
console.log('Name'.padEnd(28) + 'T  Cat'.padEnd(15) + 'Sc Bio Ev  Ph  Fi Docs Evts Conn Stor CF');
console.log('-'.repeat(100));
for (const r of out) {
  console.log(
    r.name.substring(0, 27).padEnd(28) +
    `${r.tier}  ${r.cat.substring(0, 10)}`.padEnd(15) +
    String(r.sc).padStart(2) + '  ' +
    y(r.bio).padEnd(4) + y(r.ev).padEnd(4) + y(r.ph).padEnd(4) + y(r.fi).padEnd(3) +
    String(r.docs).padStart(4) + String(r.events).padStart(5) +
    String(r.conns).padStart(5) + String(r.stories).padStart(5) + String(r.cf).padStart(3)
  );
}

const thin = out.filter(r => r.sc <= 3);
const med = out.filter(r => r.sc > 3 && r.sc <= 6);
const rich = out.filter(r => r.sc > 6);
console.log(`\nSummary: ${thin.length} thin (0-3), ${med.length} medium (4-6), ${rich.length} rich (7-10)\n`);

console.log('HIGH-PRIORITY TARGETS (score <= 4 AND tier 1-3):');
for (const r of out.filter(r => r.sc <= 4 && r.tier <= 3)) {
  const missing = [
    !r.bio && 'bio', !r.ev && 'evidence_summary', !r.ph && 'photo', !r.fi && 'financial',
    r.docs < 1 && 'docs', r.events < 1 && 'events', r.conns < 1 && 'connections',
    r.stories < 1 && 'stories', r.cf < 1 && 'case_files'
  ].filter(Boolean).join(', ');
  console.log(`  T${r.tier} [${r.sc}/10] ${r.name} — missing: ${missing}`);
}
