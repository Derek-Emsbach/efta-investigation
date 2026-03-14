import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../apps/web/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Search for documents mentioning AOL
const { data: aol } = await sb.from('documents').select('id, bates_number, title, severity').textSearch('search_vector', 'AOL', { type: 'plain' }).limit(10);
console.log('--- AOL ---');
for (const d of aol || []) console.log('  ' + d.bates_number + ' — ' + (d.title || 'untitled').substring(0, 80));

// Search for prosecution memo references to journals
const { data: memo } = await sb.from('documents').select('id, bates_number, title, severity, summary').eq('bates_number', 'EFTA02731082').single();
console.log('\n--- EFTA02731082 (Prosecution Memo) ---');
console.log('  Title: ' + memo?.title);
console.log('  Severity: ' + memo?.severity);
console.log('  Summary: ' + (memo?.summary || 'none').substring(0, 200));

// Check what docs are in the NPA range
const { data: npa } = await sb.from('documents').select('bates_number, title, severity').textSearch('search_vector', 'immunity & agreement', { type: 'plain' }).order('severity', { ascending: false }).limit(5);
console.log('\n--- immunity + agreement ---');
for (const d of npa || []) console.log('  ' + d.bates_number + ' — ' + (d.title || 'untitled').substring(0, 80) + ' [' + (d.severity || '-') + ']');

// Check for flight log docs
const { data: flight } = await sb.from('documents').select('bates_number, title, severity').textSearch('search_vector', 'flight & log', { type: 'plain' }).order('severity', { ascending: false }).limit(5);
console.log('\n--- flight + log ---');
for (const d of flight || []) console.log('  ' + d.bates_number + ' — ' + (d.title || 'untitled').substring(0, 80) + ' [' + (d.severity || '-') + ']');

// The Giuffre v Maxwell case docs
const { data: gm } = await sb.from('documents').select('bates_number, title, severity').textSearch('search_vector', 'Giuffre & Maxwell', { type: 'plain' }).order('severity', { ascending: false }).limit(5);
console.log('\n--- Giuffre + Maxwell ---');
for (const d of gm || []) console.log('  ' + d.bates_number + ' — ' + (d.title || 'untitled').substring(0, 80) + ' [' + (d.severity || '-') + ']');

// Washington DC related
const { data: dc } = await sb.from('documents').select('bates_number, title, severity').textSearch('search_vector', 'Washington & Virginia', { type: 'plain' }).order('severity', { ascending: false }).limit(5);
console.log('\n--- Washington + Virginia ---');
for (const d of dc || []) console.log('  ' + d.bates_number + ' — ' + (d.title || 'untitled').substring(0, 80) + ' [' + (d.severity || '-') + ']');
