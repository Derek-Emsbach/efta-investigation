-- 010: Cursor-based pagination support for 1.37M+ document scale
-- Provides fast estimated count and composite indexes for cursor tiebreaking.

-- ═══════════════════════════════════════════════════════════════
-- ESTIMATED COUNT
-- ═══════════════════════════════════════════════════════════════

-- Fast estimated row count from pg_class (avoids COUNT(*) on 1.37M rows).
-- Returns reltuples from the most recent ANALYZE.
-- Supabase runs auto-analyze periodically; value is sufficient for "~1.37M documents" display.
CREATE OR REPLACE FUNCTION estimated_document_count()
RETURNS BIGINT AS $$
  SELECT COALESCE(reltuples::bigint, 0)
  FROM pg_class
  WHERE relname = 'documents';
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════════════════════════
-- COMPOSITE INDEXES FOR CURSOR TIEBREAKING
-- ═══════════════════════════════════════════════════════════════

-- Default sort: created_at DESC with id tiebreaker
CREATE INDEX IF NOT EXISTS idx_documents_created_id
  ON documents (created_at DESC, id DESC);

-- Common alternative sort: bates_number ASC with id tiebreaker
CREATE INDEX IF NOT EXISTS idx_documents_bates_id
  ON documents (bates_number ASC, id ASC);
