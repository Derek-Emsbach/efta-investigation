-- 015c_fix_fuzzy_rpcs_v2.sql
-- Second attempt: explicit type casts to avoid "structure of query
-- does not match function result type" errors.
--
-- Root cause: similarity() returns REAL (float4), but RETURNS TABLE
-- declares FLOAT (= DOUBLE PRECISION = float8). PL/pgSQL sometimes
-- fails the implicit cast depending on the expression complexity.
-- Fix: explicit ::FLOAT cast on the similarity output.

-- Drop any existing versions (handles both old 5-col and new 6-col signatures)
DROP FUNCTION IF EXISTS search_entities_fuzzy(TEXT, FLOAT);
DROP FUNCTION IF EXISTS search_entities_fuzzy(TEXT, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS search_suspects_fuzzy(TEXT, FLOAT);
DROP FUNCTION IF EXISTS search_suspects_fuzzy(TEXT, DOUBLE PRECISION);

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
