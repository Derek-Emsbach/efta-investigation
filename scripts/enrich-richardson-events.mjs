import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const {data: richardson} = await sb.from('entities').select('id').eq('slug', 'bill-richardson').single();
if (!richardson) { console.error('Richardson not found'); process.exit(1); }
console.log('Richardson ID:', richardson.id);

// Check existing events linked to Richardson
const {data: existing} = await sb.from('entity_events')
  .select('event_id, events(title)')
  .eq('entity_id', richardson.id);
console.log('Existing events:', (existing||[]).length);
const existingTitles = new Set((existing||[]).map(e => e.events?.title));

const events = [
  {
    title: 'Pilot Morrison testifies seeing Richardson at Zorro Ranch',
    description: 'Larry Eugene Morrison, Epstein\'s pilot, testifies under oath that he saw Bill Richardson at Ranch Central being escorted to the main house for dinner. Places visit "well before" February 2007.',
    date: '2009-10-06',
    event_type: 'legal',
    metadata: { deposition_pages: '167-169', witness: 'Larry Eugene Morrison', source_document: 'EFTA01247021' },
    role: 'subject',
  },
  {
    title: 'Richardson withdraws Commerce Secretary nomination',
    description: 'Withdraws nomination citing unrelated federal investigation into CDR Financial Products pay-to-play allegations (later closed). Four months after Epstein guilty plea; Zorro Trust donations on public record.',
    date: '2009-01-04',
    event_type: 'institutional',
    metadata: {},
    role: 'subject',
  },
  {
    title: 'Bill Richardson dies at age 75',
    description: 'Dies in Chatham, Massachusetts. Recently returned from North Korea after negotiating Private Travis King\'s release. Never investigated for Epstein connection.',
    date: '2023-08-28',
    event_type: 'personal',
    metadata: {},
    role: 'subject',
  },
  {
    title: 'Deputy CoS coordinates Zorro Ranch visit after Epstein conviction',
    description: 'Email from Janis Hartley (Richardson Deputy CoS) coordinates ranch visit — after Epstein\'s 2008 conviction and sex offender registration.',
    date: '2010-08-15',
    event_type: 'communication',
    metadata: { sender: 'Janis Hartley', role: 'Deputy Chief of Staff', source_document: 'EFTA02407935' },
    role: 'subject',
  },
];

for (const {role, ...eventData} of events) {
  if (existingTitles.has(eventData.title)) {
    console.log(`  SKIP: ${eventData.title}`);
    continue;
  }
  // Insert event
  const {data: ev, error: evErr} = await sb.from('events').insert(eventData).select('id').single();
  if (evErr) { console.error(`  ERROR event: ${evErr.message}`); continue; }
  // Link to entity
  const {error: linkErr} = await sb.from('entity_events').insert({
    entity_id: richardson.id,
    event_id: ev.id,
    role,
  });
  if (linkErr) console.error(`  ERROR link: ${linkErr.message}`);
  else console.log(`  Created: ${eventData.date} — ${eventData.title}`);
}

console.log('Done.');
