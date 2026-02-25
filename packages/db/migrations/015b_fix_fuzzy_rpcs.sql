-- 015b_fix_fuzzy_rpcs.sql
-- Fix: CREATE OR REPLACE cannot change return type of existing functions.
-- Must DROP first, then CREATE with new return type (added aliases TEXT[]).

DROP FUNCTION IF EXISTS search_entities_fuzzy(TEXT, FLOAT);
DROP FUNCTION IF EXISTS search_suspects_fuzzy(TEXT, FLOAT);

CREATE FUNCTION search_entities_fuzzy(query_name TEXT, sim_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, name TEXT, tier INT, category TEXT, aliases TEXT[], similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (e.id) e.id, e.name, e.tier, e.category, e.aliases,
    GREATEST(
      similarity(e.name, query_name),
      COALESCE((SELECT MAX(similarity(a, query_name)) FROM unnest(e.aliases) AS a), 0)
    ) AS similarity
  FROM entities e
  WHERE similarity(e.name, query_name) > sim_threshold
     OR EXISTS (SELECT 1 FROM unnest(e.aliases) AS a WHERE similarity(a, query_name) > sim_threshold)
  ORDER BY e.id, similarity DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE FUNCTION search_suspects_fuzzy(query_name TEXT, sim_threshold FLOAT DEFAULT 0.3)
RETURNS TABLE(id UUID, name TEXT, status TEXT, priority TEXT, category TEXT, db_status TEXT, entity_id UUID, aliases TEXT[], similarity FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (s.id) s.id, s.name, s.status, s.priority, s.category, s.db_status, s.entity_id, s.aliases,
    GREATEST(
      similarity(s.name, query_name),
      COALESCE((SELECT MAX(similarity(a, query_name)) FROM unnest(s.aliases) AS a), 0)
    ) AS similarity
  FROM suspect_watchlist s
  WHERE similarity(s.name, query_name) > sim_threshold
     OR EXISTS (SELECT 1 FROM unnest(s.aliases) AS a WHERE similarity(a, query_name) > sim_threshold)
  ORDER BY s.id, similarity DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;
