-- Hand-reviewed News Wire seed (2026-10-14). Run once in the Supabase SQL editor.
-- Source: cron dry run, then edited for accurate attribution and wording.
-- Safe to re-run: duplicates are skipped by the unique source_url.

INSERT INTO news_items (headline, summary, source_name, source_url, published_at, category, created_by) VALUES
(
  'Reps. Dean and Raskin ask DOJ to investigate former Bard president over Epstein email',
  'In a press release, Reps. Madeleine Dean and Jamie Raskin called on the Justice Department to investigate former Bard College president Leon Botstein, citing an email they say shows him asking Epstein whether a young woman was meant for him.',
  'U.S. House — dean.house.gov',
  'https://dean.house.gov/2026/10/reps-dean-raskin-n-demand-doj-investigate-former-bard-college-president-after-uncovering-his-email-asking-whether-young-woman-was-for-me-or-epstein-himself-reveal-history-of-sex-abuse-coverup-at-bard',
  '2026-10-07', 'congress', 'manual-seed'
),
(
  'Former Prince Andrew wins ruling that Epstein-linked search warrants were unlawful',
  'NBC News reports a London judge ruled that police warrants used to search Andrew Mountbatten-Windsor''s properties, in a misconduct investigation linked to Epstein, were unlawful.',
  'NBC News',
  'https://www.nbcnews.com/world/united-kingdom/former-prince-andrew-wins-legal-dispute-uk-search-warrants-epstein-rcna602280',
  '2026-10-08', 'court', 'manual-seed'
),
(
  'Florida judge weighs combining Epstein victims'' lawsuits against the FBI',
  'Law360 reports a Florida federal judge asked for input on whether to consolidate lawsuits claiming the FBI mishandled Epstein investigations, including one seeking $320 million.',
  'Law360',
  'https://www.law360.com/whitecollar/articles/2536519',
  '2026-10-09', 'court', 'manual-seed'
),
(
  'DOJ denies New Mexico request for unredacted Epstein files',
  'Law360 reports the Justice Department rejected New Mexico''s request for unredacted Epstein files for its Zorro Ranch investigation, citing privacy concerns.',
  'Law360',
  'https://www.law360.com/publicpolicy/articles/2537091',
  '2026-10-13', 'doj-release', 'manual-seed'
)
ON CONFLICT (source_url) DO NOTHING;
