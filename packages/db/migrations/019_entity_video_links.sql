-- Migration 019: Add video_links JSONB field to entities table
-- Structure: [{url, title, source, date}]
-- Stores YouTube/external video embed links for entity profiles.

ALTER TABLE entities ADD COLUMN video_links JSONB DEFAULT '[]';

COMMENT ON COLUMN entities.video_links IS 'Array of video embed objects: [{url, title, source, date}]';
