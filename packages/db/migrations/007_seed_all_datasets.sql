-- 007_seed_all_datasets.sql
-- Populate metadata for all 12 EFTA datasets.
-- Safe to run multiple times — uses ON CONFLICT to upsert.
--
-- Data sourced from:
--   - Load file analysis (DAT/OPT pairs for 10 volumes)
--   - docs/reference/INVESTIGATION_CONTEXT.md
--   - docs/investigation/OPEN_QUESTIONS.md
--   - docs/investigation/DS12_SUMMARY.md

INSERT INTO datasets (number, name, description, bates_range_start, bates_range_end,
                      total_files, total_pages, release_date, status, priority, notes)
VALUES
  -- ═══ WAVE 1 (Dec 19-22, 2025): Datasets 1-8 ═══

  (1,
   'Initial Index & Cover Pages',
   'First production volume. Contains index pages, cover sheets, and preliminary document listings for the EFTA release. Primarily administrative pages rather than substantive investigative material.',
   'EFTA00000001', 'EFTA00003158',
   3158, 3158,
   '2025-12-19', 'not_started', 'low',
   'Wave 1 release. VOL00001. 3,158 single-page documents — likely cover sheets and index pages (1 page per document). Metadata stripped (DAT: Bates fields only).'),

  (2,
   'Dataset 2',
   'Wave 1 production volume. Load files not yet located — may have been included in a combined volume or released separately.',
   NULL, NULL,
   NULL, NULL,
   '2025-12-19', 'not_started', 'medium',
   'Wave 1 release. Load files (VOL00002) not found in local archive. Needs investigation.'),

  (3,
   'Early Investigation Records',
   'Contains 67 multi-page documents spanning Bates range EFTA00003858–EFTA00005704. Average 27.6 pages per document suggests substantive investigative files rather than single-page records.',
   'EFTA00003858', 'EFTA00005704',
   67, 1847,
   '2025-12-20', 'not_started', 'medium',
   'Wave 1 release. VOL00003. 67 documents, 1,847 pages. High page-per-doc ratio (27.6 avg) indicates substantive files. Metadata stripped.'),

  (4,
   'Investigation Files — Part 1',
   'Contains 152 documents across 2,704 pages. Same document count as DS12 but different content scope. Covers Bates range EFTA00005705–EFTA00008408.',
   'EFTA00005705', 'EFTA00008408',
   152, 2704,
   '2025-12-20', 'not_started', 'medium',
   'Wave 1 release. VOL00004. 152 documents, 2,704 pages. 17.8 pages avg per document. Metadata stripped.'),

  (5,
   'Short-Form Records',
   'Contains 120 single-page documents. Likely receipts, cover pages, or one-page memos/communications.',
   'EFTA00008409', 'EFTA00008528',
   120, 120,
   '2025-12-20', 'not_started', 'low',
   'Wave 1 release. VOL00005. 120 documents, all single-page. Smallest volume by page count. Metadata stripped.'),

  (6,
   'Investigation Files — Part 2',
   'Small volume with only 13 documents across 487 pages. High page-per-document ratio (37.5 avg) suggests lengthy investigation reports, legal filings, or multi-page evidence packages.',
   'EFTA00008529', 'EFTA00009015',
   13, 487,
   '2025-12-21', 'not_started', 'high',
   'Wave 1 release. VOL00006. 13 documents, 487 pages. Very high page ratio (37.5 avg) — likely substantive legal or investigation files. Priority for review.'),

  (7,
   'Investigation Files — Part 3',
   'Contains 17 documents across 660 pages. High page-per-document ratio (38.8 avg) — similar profile to DS6. May contain lengthy reports, depositions, or evidence compilations.',
   'EFTA00009016', 'EFTA00009675',
   17, 660,
   '2025-12-21', 'not_started', 'high',
   'Wave 1 release. VOL00007. 17 documents, 660 pages. 38.8 pages avg — substantive files. Metadata stripped.'),

  (8,
   'FBI Co-Conspirator & Analysis Files',
   'Expected to contain the FBI Co-Conspirator Chart (Aug 15, 2019) referenced in DS12 documents. Key cross-reference target for open questions OQ-01 (redacted names on inner circle diagram).',
   NULL, NULL,
   NULL, NULL,
   '2025-12-22', 'not_started', 'critical',
   'Wave 1 release. Load files (VOL00008) not found in local archive. Critical priority: contains FBI Co-Conspirator Chart cross-referenced from DS12. Needs immediate sourcing.'),

  -- ═══ WAVE 2 (Jan 30, 2026): Datasets 9-12 ═══

  (9,
   'Bulk DOJ/DANY Correspondence',
   'Massive volume: 531K+ documents, 1.2M+ pages. Contains DANY (Manhattan DA) emails, declination patterns, and investigation team communications. Key for open questions OQ-09 (additional declinations), OQ-12 (DANY team mapping), and OQ-07 (cross-referencing "Mr." names from victim journals).',
   'EFTA00039025', 'EFTA01262781',
   531307, 1223757,
   '2026-01-30', 'not_started', 'critical',
   'Wave 2 release. VOL00009. Largest volume by document count. Contains DANY emails per OQ-12, declination patterns per OQ-09. Severe metadata stripping (Bates fields only). 2.3 pages avg per document.'),

  (10,
   'Evidence & Media Files',
   'Second-largest volume: 503K+ documents, 950K+ pages. Referenced in OQ-04 regarding video evidence ("6 men, victim with 3, circulating on some disgusting sex site"). May contain media file references and evidence chain documentation.',
   'EFTA01262782', 'EFTA02212882',
   503154, 950101,
   '2026-01-30', 'not_started', 'critical',
   'Wave 2 release. VOL00010. 503K documents, 950K pages. Cross-referenced from OQ-04 (video evidence). 1.9 pages avg per document. Metadata stripped.'),

  (11,
   'Financial, Travel & Property Records',
   'Third-largest volume: 331K+ documents, 517K+ pages. Expected to contain flight logs, property records, and financial transaction records per open questions OQ-05 (federal worker in flight logs), OQ-07 (property visitor records), OQ-11 (Black payment cross-references).',
   'EFTA02212883', 'EFTA02730264',
   331655, 517382,
   '2026-01-30', 'not_started', 'critical',
   'Wave 2 release. VOL00011. 331K documents, 517K pages. Cross-referenced from OQ-05 (flight logs), OQ-07 (property records), OQ-11 (financial records). 1.6 pages avg per document. Metadata stripped.'),

  (12,
   'Leon Black Prosecution File',
   '~80% Leon Black investigation chain (SDNY/DANY prosecutor emails, victim proffers, evidence transfers, FBI coordination, formal decline-to-charge), ~10% Epstein/Maxwell case infrastructure, ~10% institutional records and evidence files. Contains 14 EXTREME CRITICAL and 33 CRITICAL findings.',
   'EFTA02730265', 'EFTA02731789',
   152, 1525,
   '2026-01-30', 'completed', 'critical',
   'Wave 2 release. VOL00012. 137/152 documents reviewed. Contains prosecution failure evidence for Leon Black case. 10 pages avg per document. See DS12_SUMMARY.md for complete analysis.')

ON CONFLICT (number) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  bates_range_start = COALESCE(EXCLUDED.bates_range_start, datasets.bates_range_start),
  bates_range_end = COALESCE(EXCLUDED.bates_range_end, datasets.bates_range_end),
  total_files = COALESCE(EXCLUDED.total_files, datasets.total_files),
  total_pages = COALESCE(EXCLUDED.total_pages, datasets.total_pages),
  release_date = EXCLUDED.release_date,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  notes = EXCLUDED.notes,
  updated_at = now();
