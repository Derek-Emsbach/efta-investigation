-- Migration 013: Suspect watchlist + pg_trgm fuzzy matching + connection strength
-- Run in Supabase SQL Editor

-- ============================================================
-- 1. Enable trigram fuzzy matching (Supabase Pro supports this)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Add numeric strength to entity_connections
--    (existing evidence_strength TEXT stays alongside)
-- ============================================================
ALTER TABLE entity_connections
  ADD COLUMN IF NOT EXISTS strength INTEGER CHECK (strength >= 0 AND strength <= 100);

-- ============================================================
-- 3. Suspect watchlist table
-- ============================================================
CREATE TABLE suspect_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',

  -- Classification
  status TEXT NOT NULL DEFAULT 'watchlist'
    CHECK (status IN (
      'confirmed_co_conspirator',   -- Named in NPA or charged
      'suspect',                     -- Substantial public evidence of knowing participation
      'watchlist',                   -- Documented connections, actively monitor during review
      'possible_suspect',            -- Limited evidence, needs EFTA corroboration
      'watch',                       -- Tangential connection, note if encountered
      'deprioritized'                -- Cleared or shown unrelated
    )),
  category TEXT,                     -- accused_abuser, inner_circle, political, financial, operational, media
  priority TEXT CHECK (priority IN ('P1', 'P2', 'P3', 'P4', 'P5')),
    -- P1 = drop everything, P5 = ignore unless it falls in your lap
    -- Investigation sequencing priority, NOT evidence severity

  -- Public source evidence (external sources, NOT from EFTA doc analysis)
  public_sources TEXT,               -- WHERE suspicion comes from: "Named in NPA; Giuffre testimony"
  known_connections TEXT,            -- Known relationships: "Trump fundraiser; visited island Dec 2012"

  -- Cross-reference to our investigation
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  db_status TEXT DEFAULT 'not_in_db'
    CHECK (db_status IN ('not_in_db', 'pending_promotion', 'in_db')),
  cross_references TEXT,             -- "Cross-ref DS9 EFTA02674602 Adfin; DS12 bank statements"

  -- Additional fields
  known_associates TEXT[] DEFAULT '{}',
  first_seen_document_id UUID REFERENCES documents(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX idx_suspects_name ON suspect_watchlist(name);
CREATE INDEX idx_suspects_name_trgm ON suspect_watchlist USING GIN(name gin_trgm_ops);
CREATE INDEX idx_suspects_status ON suspect_watchlist(status);
CREATE INDEX idx_suspects_priority ON suspect_watchlist(priority);
CREATE INDEX idx_suspects_search ON suspect_watchlist USING GIN(search_vector);

-- Trigram index on entities.name for fuzzy lookup_person tool
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON entities USING GIN(name gin_trgm_ops);

-- ============================================================
-- 5. FTS trigger
--    name at A-weight; public_sources, known_connections, notes, aliases at B-weight
-- ============================================================
CREATE OR REPLACE FUNCTION suspects_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.public_sources, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.known_connections, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.aliases, ' '), '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suspects_search_trigger
  BEFORE INSERT OR UPDATE ON suspect_watchlist
  FOR EACH ROW EXECUTE FUNCTION suspects_search_update();

-- ============================================================
-- 6. Fuzzy search RPC functions (used by lookup_person MCP tool)
-- ============================================================

-- Fuzzy search entities by name using pg_trgm similarity
CREATE OR REPLACE FUNCTION search_entities_fuzzy(query_name TEXT, sim_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, name TEXT, tier INT, category TEXT, aliases TEXT[], similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.tier, e.category, e.aliases,
         similarity(e.name, query_name) AS similarity
  FROM entities e
  WHERE similarity(e.name, query_name) > sim_threshold
  ORDER BY similarity(e.name, query_name) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fuzzy search suspects by name using pg_trgm similarity
CREATE OR REPLACE FUNCTION search_suspects_fuzzy(query_name TEXT, sim_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, name TEXT, status TEXT, priority TEXT, category TEXT, db_status TEXT, entity_id UUID, aliases TEXT[], similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.status, s.priority, s.category, s.db_status, s.entity_id, s.aliases,
         similarity(s.name, query_name) AS similarity
  FROM suspect_watchlist s
  WHERE similarity(s.name, query_name) > sim_threshold
  ORDER BY similarity(s.name, query_name) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 7. RLS
-- ============================================================
ALTER TABLE suspect_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON suspect_watchlist
  FOR ALL USING (auth.role() = 'authenticated');
