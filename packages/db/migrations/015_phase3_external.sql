-- 015_phase3_external.sql
-- Phase 3: External integration, infrastructure fixes
--
-- 1a. external_urls JSONB on entities + suspect_watchlist
-- 1b. research_platforms table (global registry of research tools)
-- 1c. external_entities table (rhowardstone person registry cross-reference)
-- 1d. Expand locations.location_type CHECK constraint
-- 1e. Fix BUG-01: fuzzy search RPCs to include aliases

-- ============================================================
-- 1a. Add external_urls JSONB column
-- ============================================================

ALTER TABLE entities ADD COLUMN IF NOT EXISTS external_urls JSONB DEFAULT '{}';
ALTER TABLE suspect_watchlist ADD COLUMN IF NOT EXISTS external_urls JSONB DEFAULT '{}';

COMMENT ON COLUMN entities.external_urls IS 'Links to external research tools. Shape: { "jmail": "url", "jwiki": "url", "rhowardstone": "url", "carstensen": "url", "other": ["url1"] }';
COMMENT ON COLUMN suspect_watchlist.external_urls IS 'Same schema as entities.external_urls';

-- ============================================================
-- 1b. Create research_platforms table
-- ============================================================
-- NOTE: NOT named "external_sources" — migration 004 already created that
-- as a per-entity junction table for Wikipedia/news/court content.
-- This is a global registry of research tools/platforms.

CREATE TABLE research_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'search_platform', 'research_repo', 'tracker', 'government',
    'archive', 'media', 'court_records', 'data_corpus', 'community', 'other'
  )),
  description TEXT,
  capabilities TEXT[] DEFAULT '{}',
  person_page_template TEXT,
  api_available BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unreliable', 'offline', 'deprecated')),
  last_checked TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_research_platforms_type ON research_platforms(source_type);

ALTER TABLE research_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON research_platforms
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 1c. Create external_entities table
-- ============================================================
-- Cross-reference layer for external person registries (rhowardstone 1,536-person).
-- Separate from our curated entities table — this is a lookup resource.

CREATE TABLE external_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'rhowardstone',
  source_id TEXT,
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  entity_type TEXT,
  occupation TEXT,
  legal_status TEXT,
  mention_count INTEGER,
  matched_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  matched_suspect_id UUID REFERENCES suspect_watchlist(id) ON DELETE SET NULL,
  match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN (
    'unmatched', 'matched', 'new_lead', 'not_relevant'
  )),
  raw_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ext_entities_source ON external_entities(source);
CREATE INDEX idx_ext_entities_name ON external_entities USING gin(to_tsvector('english', name));
CREATE INDEX idx_ext_entities_match ON external_entities(match_status);
CREATE INDEX idx_ext_entities_matched_entity ON external_entities(matched_entity_id);

ALTER TABLE external_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON external_entities
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 1d. Expand locations.location_type CHECK constraint
-- ============================================================
-- Add investigation-specific types for Epstein property taxonomy.

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_location_type_check;
ALTER TABLE locations ADD CONSTRAINT locations_location_type_check CHECK (
  location_type IN (
    'property', 'airport', 'office', 'court', 'restaurant', 'hotel', 'school',
    'epstein_property', 'associated_property', 'recruitment_site', 'government_facility',
    'other'
  )
);

-- ============================================================
-- 1e. Fix BUG-01: fuzzy search RPCs to include aliases
-- ============================================================
-- Current RPCs (migration 013) only run similarity() on name.
-- The lookup_person handler already does exact alias matching via
-- aliases.cs.{name}, but typos in aliases fail.
-- Fix: run similarity() against unnest(aliases) too.
-- NOTE: Must DROP first — CREATE OR REPLACE cannot change return type
-- (we added aliases TEXT[] to the return table).
-- NOTE 2: Explicit ::FLOAT and ::INT casts required — PL/pgSQL won't
-- implicitly cast REAL→DOUBLE PRECISION in complex expressions.

DROP FUNCTION IF EXISTS search_entities_fuzzy(TEXT, FLOAT);
DROP FUNCTION IF EXISTS search_entities_fuzzy(TEXT, DOUBLE PRECISION);

CREATE FUNCTION search_entities_fuzzy(query_name TEXT, sim_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, name TEXT, tier INT, category TEXT, aliases TEXT[], similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.tier::INT, e.category, e.aliases,
    GREATEST(
      similarity(e.name, query_name),
      COALESCE((SELECT MAX(similarity(a, query_name)) FROM unnest(e.aliases) AS a), 0::REAL)
    )::FLOAT AS similarity
  FROM entities e
  WHERE similarity(e.name, query_name) > sim_threshold
     OR EXISTS (SELECT 1 FROM unnest(e.aliases) AS a WHERE similarity(a, query_name) > sim_threshold)
  ORDER BY similarity DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

DROP FUNCTION IF EXISTS search_suspects_fuzzy(TEXT, FLOAT);
DROP FUNCTION IF EXISTS search_suspects_fuzzy(TEXT, DOUBLE PRECISION);

CREATE FUNCTION search_suspects_fuzzy(query_name TEXT, sim_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, name TEXT, status TEXT, priority TEXT, category TEXT, db_status TEXT, entity_id UUID, aliases TEXT[], similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.status, s.priority, s.category, s.db_status, s.entity_id, s.aliases,
    GREATEST(
      similarity(s.name, query_name),
      COALESCE((SELECT MAX(similarity(a, query_name)) FROM unnest(s.aliases) AS a), 0::REAL)
    )::FLOAT AS similarity
  FROM suspect_watchlist s
  WHERE similarity(s.name, query_name) > sim_threshold
     OR EXISTS (SELECT 1 FROM unnest(s.aliases) AS a WHERE similarity(a, query_name) > sim_threshold)
  ORDER BY similarity DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;
