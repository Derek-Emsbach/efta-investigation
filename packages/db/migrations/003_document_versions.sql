-- Migration 003: Document Versioning
-- Run this in the Supabase SQL Editor
-- Adds support for re-uploading documents, version tracking, and diff computation

-- ============================================================
-- 1. document_versions table — snapshots before re-processing
-- ============================================================

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('initial_import', 'reupload', 'reprocess')),

  -- Snapshot of processing-derived fields (before overwrite)
  file_url TEXT,
  file_size_bytes BIGINT,
  page_count INTEGER,
  extracted_text TEXT,
  document_type TEXT,
  original_date DATE,
  classification TEXT,
  severity TEXT,
  processing_status TEXT,
  forensic_metadata JSONB DEFAULT '{}',
  flags TEXT[] DEFAULT '{}',

  -- Review state snapshot
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Denormalized summaries for quick diffing
  redaction_summary JSONB DEFAULT '{}',
  entity_ids TEXT[] DEFAULT '{}',
  processing_results JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, version_number)
);

CREATE INDEX idx_doc_versions_document ON document_versions(document_id);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON document_versions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service write" ON document_versions
  FOR ALL USING (true);

-- ============================================================
-- 2. New columns on documents
-- ============================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_notes TEXT;

-- ============================================================
-- 3. New columns on processing_queue
-- ============================================================

ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS is_reprocess BOOLEAN DEFAULT false;
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES document_versions(id);
