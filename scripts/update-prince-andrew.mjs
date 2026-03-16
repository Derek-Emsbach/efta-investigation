/**
 * Prince Andrew — Add missing connections + fix event dates
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

const ANDREW_ID = 'fd960f37-8900-47df-8ca3-c801a95a146a';

async function main() {
  // ─── 1. Look up target entity IDs ──────────────────────────────────────────
  console.log('=== Looking up entity IDs ===\n');

  const names = ['Jeffrey Epstein', 'Ghislaine Maxwell', 'Jes Staley'];
  const entityIds = {};

  for (const name of names) {
    const { data, error } = await sb.from('entities')
      .select('id, name, slug')
      .eq('name', name)
      .single();
    if (error || !data) {
      console.log(`  ERROR: ${name} not found: ${error?.message}`);
      return;
    }
    entityIds[name] = data.id;
    console.log(`  ${name}: ${data.id} (slug: ${data.slug})`);
  }

  // ─── 2. Add connections ────────────────────────────────────────────────────
  console.log('\n=== Adding connections ===\n');

  const connections = [
    {
      entity_a: ANDREW_ID,
      entity_b: entityIds['Jeffrey Epstein'],
      relationship_type: 'associated_with',
      evidence_strength: 'documented',
      description: 'Post-conviction contact via email, birthday invitation, phone calls documented in EFTA corpus',
    },
    {
      entity_a: ANDREW_ID,
      entity_b: entityIds['Ghislaine Maxwell'],
      relationship_type: 'associated_with',
      evidence_strength: 'documented',
      description: 'Maxwell introduced victim to Prince Andrew, coordinated encounters per FBI 302',
    },
    {
      entity_a: ANDREW_ID,
      entity_b: entityIds['Jes Staley'],
      relationship_type: 'associated_with',
      evidence_strength: 'documented',
      description: 'Met with Prince Andrew per Epstein office message EFTA02422781',
    },
  ];

  for (const conn of connections) {
    const { data, error } = await sb.from('entity_connections')
      .upsert(conn, { onConflict: 'entity_a,entity_b,relationship_type' })
      .select('id');
    if (error) {
      console.log(`  ERROR adding ${conn.description.substring(0, 50)}: ${error.message}`);
    } else {
      console.log(`  OK: Andrew -> ${conn.entity_b} (${conn.relationship_type}) — id: ${data?.[0]?.id}`);
    }
  }

  // ─── 3. Look up and update event dates ─────────────────────────────────────
  console.log('\n=== Updating event dates ===\n');

  // Get all events linked to Prince Andrew
  const { data: eventLinks, error: evErr } = await sb.from('entity_events')
    .select('event_id, events(id, title, date, date_precision)')
    .eq('entity_id', ANDREW_ID);

  if (evErr) {
    console.log('  ERROR fetching events:', evErr.message);
    return;
  }

  console.log(`  Found ${eventLinks.length} linked events:\n`);
  for (const link of eventLinks) {
    const ev = link.events;
    console.log(`    "${ev.title}" — current date: ${ev.date}, precision: ${ev.date_precision}`);
  }

  // Use keyword matching since actual titles differ from shorthand
  const dateUpdates = [
    { keyword: 'meets Virginia Giuffre', date: '2001-01-15', date_precision: 'approximate' },
    { keyword: 'abuse', secondKeyword: 'New York', date: '2001-03-15', date_precision: 'approximate' },
    { keyword: 'abuse', secondKeyword: 'St. James', date: '2001-06-01', date_precision: 'approximate' },
    { keyword: 'NPA', date: '2007-09-24', date_precision: 'day' },
    { keyword: 'Metropolitan Police', date: '2015-10-15', date_precision: 'approximate' },
    { keyword: 'Newsnight', date: '2019-11-16', date_precision: 'day' },
    { keyword: 'lawsuit filed', date: '2021-08-09', date_precision: 'day' },
    { keyword: 'stripped', date: '2022-01-13', date_precision: 'day' },
    { keyword: 'settlement', date: '2022-02-15', date_precision: 'day' },
  ];

  console.log('\n  Applying date updates:\n');

  for (const upd of dateUpdates) {
    // Find matching event by keyword(s) in title
    const match = eventLinks.find(l => {
      const t = l.events.title.toLowerCase();
      const hasFirst = t.includes(upd.keyword.toLowerCase());
      const hasSecond = upd.secondKeyword ? t.includes(upd.secondKeyword.toLowerCase()) : true;
      return hasFirst && hasSecond;
    });
    if (!match) {
      console.log(`    SKIP: keyword "${upd.keyword}" — not found among linked events`);
      continue;
    }

    const { error: updErr } = await sb.from('events')
      .update({ date: upd.date, date_precision: upd.date_precision })
      .eq('id', match.events.id);

    if (updErr) {
      console.log(`    ERROR: "${match.events.title}": ${updErr.message}`);
    } else {
      console.log(`    OK: "${match.events.title}" → ${upd.date} (${upd.date_precision})`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
