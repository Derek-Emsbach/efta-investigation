-- Migration 016: Publication tables for The Epstein Record
-- Adds stories, case files, open questions, and entity slug support

BEGIN;

-- ============================================================
-- Entity additions for public profiles
-- ============================================================

ALTER TABLE entities ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS financial_summary JSONB DEFAULT '{}';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS profile_published BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_entities_slug ON entities(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_published ON entities(profile_published) WHERE profile_published = true;

-- ============================================================
-- Case Files (investigation reports) — created first since stories references it
-- ============================================================

CREATE TABLE IF NOT EXISTS case_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  case_id TEXT UNIQUE NOT NULL,  -- e.g. "CF-2025-001"
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'complete', 'archived')) DEFAULT 'active',
  classification TEXT CHECK (classification IN ('public', 'restricted')) DEFAULT 'public',
  dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
  summary TEXT,
  findings_markdown TEXT DEFAULT '',
  methodology_notes TEXT,
  date_range_start DATE,
  date_range_end DATE,
  docs_reviewed INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_files_published ON case_files(is_published, published_at DESC) WHERE is_published = true;

-- ============================================================
-- Case File junction tables
-- ============================================================

CREATE TABLE IF NOT EXISTS case_file_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id UUID NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT,
  UNIQUE(case_file_id, entity_id)
);

-- ============================================================
-- Open Questions (linked to case files)
-- ============================================================

CREATE TABLE IF NOT EXISTS open_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id UUID REFERENCES case_files(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'partially_answered', 'answered')) DEFAULT 'open',
  answer TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Stories (editorial articles)
-- ============================================================

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  deck TEXT,  -- subtitle/subheadline
  section TEXT CHECK (section IN ('the-network', 'follow-the-money', 'the-cover-up', 'the-operation', 'voices')),
  body_markdown TEXT NOT NULL DEFAULT '',
  byline TEXT DEFAULT 'EFTA Investigation Team',
  reading_time_minutes INTEGER,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  case_file_id UUID REFERENCES case_files(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stories_published ON stories(is_published, published_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_stories_section ON stories(section) WHERE is_published = true;

-- ============================================================
-- Story junction tables
-- ============================================================

CREATE TABLE IF NOT EXISTS story_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  mention_count INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(story_id, entity_id)
);

CREATE TABLE IF NOT EXISTS story_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  citation_number INTEGER NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  description TEXT,
  bates_number TEXT,
  page_reference TEXT,
  UNIQUE(story_id, citation_number)
);

-- ============================================================
-- RLS policies for public access
-- ============================================================

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_file_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_questions ENABLE ROW LEVEL SECURITY;

-- Published content readable by anyone (including anon)
CREATE POLICY stories_public_read ON stories FOR SELECT USING (is_published = true);
CREATE POLICY stories_auth_all ON stories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY story_entities_public_read ON story_entities FOR SELECT
  USING (EXISTS (SELECT 1 FROM stories WHERE stories.id = story_entities.story_id AND stories.is_published = true));
CREATE POLICY story_entities_auth_all ON story_entities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY story_citations_public_read ON story_citations FOR SELECT
  USING (EXISTS (SELECT 1 FROM stories WHERE stories.id = story_citations.story_id AND stories.is_published = true));
CREATE POLICY story_citations_auth_all ON story_citations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY case_files_public_read ON case_files FOR SELECT USING (is_published = true);
CREATE POLICY case_files_auth_all ON case_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY case_file_entities_public_read ON case_file_entities FOR SELECT
  USING (EXISTS (SELECT 1 FROM case_files WHERE case_files.id = case_file_entities.case_file_id AND case_files.is_published = true));
CREATE POLICY case_file_entities_auth_all ON case_file_entities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY open_questions_public_read ON open_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM case_files WHERE case_files.id = open_questions.case_file_id AND case_files.is_published = true));
CREATE POLICY open_questions_auth_all ON open_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Entity public profiles readable by anyone (additive — doesn't replace existing authenticated policies)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'entities_public_profiles' AND tablename = 'entities') THEN
    CREATE POLICY entities_public_profiles ON entities FOR SELECT USING (profile_published = true);
  END IF;
END $$;

COMMIT;
