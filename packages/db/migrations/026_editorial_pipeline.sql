-- Migration 026: Editorial Pipeline ("My Desk")
-- Adds editorial workflow status to stories and story-image assignments

BEGIN;

-- ============================================================
-- Editorial workflow columns on stories
-- ============================================================

ALTER TABLE stories ADD COLUMN IF NOT EXISTS editorial_status TEXT
  DEFAULT 'published' CHECK (editorial_status IN ('draft', 'review', 'published'));
ALTER TABLE stories ADD COLUMN IF NOT EXISTS editorial_notes TEXT;

-- Backfill based on current publish state
UPDATE stories SET editorial_status = 'published' WHERE is_published = true;
UPDATE stories SET editorial_status = 'draft' WHERE is_published = false;

-- ============================================================
-- Story-image assignments (corpus images linked to stories)
-- ============================================================

CREATE TABLE IF NOT EXISTS story_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES document_images(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('hero', 'inline', 'candidate')),
  sort_order INTEGER DEFAULT 0,
  caption_override TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_story_images_story ON story_images(story_id);

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE story_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY story_images_auth_all ON story_images
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY story_images_public_read ON story_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = story_images.story_id
        AND stories.is_published = true
    )
  );

COMMIT;
