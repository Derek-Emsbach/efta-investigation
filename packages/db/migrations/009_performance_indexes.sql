-- 009: Performance indexes for 1.37M+ document scale
-- Composite and partial indexes targeting the most common query patterns.
-- Safe to run on a live database (CREATE INDEX CONCURRENTLY not needed via SQL Editor).

-- ═══════════════════════════════════════════════════════════════
-- DOCUMENTS TABLE
-- ═══════════════════════════════════════════════════════════════

-- 1. Composite: dataset + status — used by document listing, dashboard counts,
--    and any filtered browse of documents within a dataset.
CREATE INDEX IF NOT EXISTS idx_documents_dataset_status
  ON documents (dataset_id, processing_status);

-- 2. Partial: review queue — only rows needing human attention.
--    Covers ~0.3% of rows instead of scanning 1.37M.
CREATE INDEX IF NOT EXISTS idx_documents_needs_review
  ON documents (created_at)
  WHERE processing_status IN ('needs_review', 'extracted');

-- 3. Composite: status + date — review queue ORDER BY created_at ASC.
CREATE INDEX IF NOT EXISTS idx_documents_status_created
  ON documents (processing_status, created_at);

-- ═══════════════════════════════════════════════════════════════
-- PROCESSING QUEUE TABLE
-- ═══════════════════════════════════════════════════════════════

-- 4. Composite: status + priority + created_at — processing dashboard
--    pagination: WHERE status = $1 ORDER BY priority, created_at.
CREATE INDEX IF NOT EXISTS idx_processing_queue_status_priority
  ON processing_queue (status, priority, created_at);

-- 5. Partial: queued items only — worker's claim_next_queued() RPC
--    scans only pending work, not completed/failed history.
CREATE INDEX IF NOT EXISTS idx_processing_queue_queued
  ON processing_queue (priority, created_at)
  WHERE status = 'queued';

-- ═══════════════════════════════════════════════════════════════
-- EVENTS TABLE
-- ═══════════════════════════════════════════════════════════════

-- 6. Composite: event_type + date — timeline page filters by type
--    with date range (WHERE event_type = $1 AND date BETWEEN $2 AND $3).
CREATE INDEX IF NOT EXISTS idx_events_type_date
  ON events (event_type, date);
