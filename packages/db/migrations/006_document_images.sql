-- Migration 006: Document Images (Photo Album Pipeline)
-- Tracks images extracted from PDFs by Worker Stage 1.5

CREATE TABLE document_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_index INTEGER NOT NULL DEFAULT 0,

  -- R2 storage
  r2_key TEXT NOT NULL,
  thumbnail_r2_key TEXT,
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  format TEXT,

  -- Classification
  image_type TEXT NOT NULL DEFAULT 'embedded'
    CHECK (image_type IN ('embedded', 'photo', 'graphic', 'signature', 'map', 'chart', 'unknown')),

  -- Tagging
  tags TEXT[] DEFAULT '{}',
  caption TEXT,
  is_redacted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(document_id, page_number, image_index)
);

-- Indexes
CREATE INDEX idx_docimg_document ON document_images(document_id);
CREATE INDEX idx_docimg_type ON document_images(image_type);
CREATE INDEX idx_docimg_tags ON document_images USING GIN(tags);
CREATE INDEX idx_docimg_created ON document_images(created_at DESC);

-- RLS
ALTER TABLE document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_document_images"
  ON document_images FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "service_write_document_images"
  ON document_images FOR ALL
  TO service_role USING (true);
