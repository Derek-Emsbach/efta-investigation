-- Migration 017: Add hero image fields to stories
-- Supports hero images on story pages (document screenshots from R2)

ALTER TABLE stories ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS hero_image_caption TEXT;
