import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return i > 0 ? [l.substring(0, i).trim(), l.substring(i + 1).trim()] : null; }).filter(Boolean));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from('public_events').insert({
  date: '2026-10-08',
  title: 'Leon Botstein resigns ALL remaining Bard positions after Raskin letter alleges direct Epstein-abuse involvement',
  category: 'resignation',
  description: "Rep. Jamie Raskin (House Judiciary ranking member) sent a letter citing a redacted 2014 email — which Congress members say they verified in unredacted DOJ files — in which Epstein sends a young aspiring singer to Botstein for evaluation and an unidentified sender asks 'Is she for me or are you keeping her for yourself?'; Raskin's letter also cites whistleblower reports of sexually inappropriate conduct and interference in Title IX proceedings protecting accused faculty. Botstein denies authoring/sending the email. Bard's Board Executive Committee unanimously accepted his immediate resignation from all remaining roles (professorship, The Orchestra Now, other music programs) — going beyond his earlier 2026 retirement as president, which left him teaching and performing. A board-commissioned law firm review found no illegal conduct but said his decisions 'reflect on his leadership.' This is distinct from the already-logged 2026-05-01 presidential-retirement-announcement event.",
  impact_level: 'high',
  source_urls: [
    'https://spectrumlocalnews.com/nys/buffalo/news/2026/10/08/former-bard-leader-resigns-from-positions-amid-investigation-into-epstein-ties',
    'https://lavocedinewyork.com/en/news/2026/10/09/epstein-case-former-bard-college-president-resigns-from-all-positions/',
  ],
  entity_names: ['Leon Botstein'],
  tags: ['names_revealed', 'investigation', 'oversight_committee'],
  notes: "Corpus independently corroborates this email per THREAD_20_Botstein_Bard_College.md / the 2026-10-11 daily-investigation entity-creation session (entity 0cf98a6f-bc27-4a6a-afe3-4e92b43ba4f6, EFTA01922992) — strongest case to date of a breaking-news allegation with independent DOJ-corpus support found before this monitoring pass caught the news. Follow-up: exact date of Raskin's letter itself not stated in sources reviewed; Bard arts-staff open letter calling for 'full termination' also surfaced but not separately logged (same underlying story, no new factual development).",
}).select('id, date, title').single();

if (error) { console.error('ERR', error.message); process.exit(1); }
console.log('Created:', JSON.stringify(data, null, 2));
