-- Performance: server-side aggregation functions
-- These replace client-side loops that fetch 1M+ rows into JavaScript

-- 1. Document severity stats (replaces 3 full table scans in /api/documents/stats)
--    Returns the full stats blob the frontend expects in one round-trip.
CREATE OR REPLACE FUNCTION document_severity_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH severity_totals AS (
    SELECT severity, COUNT(*) AS cnt
    FROM documents
    WHERE severity IS NOT NULL
    GROUP BY severity
  ),
  type_breakdown AS (
    SELECT severity, document_type, COUNT(*) AS cnt
    FROM documents
    WHERE severity IS NOT NULL AND document_type IS NOT NULL
    GROUP BY severity, document_type
  ),
  status_breakdown AS (
    SELECT severity, processing_status, COUNT(*) AS cnt
    FROM documents
    WHERE severity IS NOT NULL
    GROUP BY severity, processing_status
  ),
  total_count AS (
    SELECT COUNT(*) AS cnt FROM documents
  ),
  unassessed_count AS (
    SELECT COUNT(*) AS cnt FROM documents WHERE severity IS NULL
  )
  SELECT jsonb_build_object(
    'severities', COALESCE((
      SELECT jsonb_object_agg(
        s.severity,
        jsonb_build_object(
          'total', s.cnt,
          'byType', COALESCE((
            SELECT jsonb_object_agg(t.document_type, t.cnt)
            FROM type_breakdown t
            WHERE t.severity = s.severity
          ), '{}'::jsonb),
          'byStatus', COALESCE((
            SELECT jsonb_object_agg(st.processing_status, st.cnt)
            FROM status_breakdown st
            WHERE st.severity = s.severity
          ), '{}'::jsonb)
        )
      )
      FROM severity_totals s
    ), '{}'::jsonb),
    'total', (SELECT cnt FROM total_count),
    'unassessed', (SELECT cnt FROM unassessed_count)
  ) INTO result;

  RETURN result;
END;
$$;

-- 2. Total storage bytes (replaces fetching 1.3M rows in /api/admin/metrics)
CREATE OR REPLACE FUNCTION document_storage_bytes()
RETURNS BIGINT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(file_size_bytes), 0)::BIGINT FROM documents;
$$;

-- 3. Processing queue stats (replaces fetching entire queue to loop-count)
CREATE OR REPLACE FUNCTION processing_queue_stats()
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    jsonb_object_agg(status, cnt),
    '{}'::jsonb
  )
  FROM (
    SELECT status, COUNT(*) AS cnt
    FROM processing_queue
    GROUP BY status
  ) sub;
$$;

-- 4. Count documents grouped by a column, with optional filter
--    Used by dashboard alerts for "pending reviews by severity" etc.
CREATE OR REPLACE FUNCTION count_documents_by(
  p_group_col TEXT,
  p_filter_col TEXT DEFAULT NULL,
  p_filter_val TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result JSONB;
  query TEXT;
BEGIN
  -- Whitelist allowed column names to prevent SQL injection
  IF p_group_col NOT IN ('severity', 'processing_status', 'document_type') THEN
    RAISE EXCEPTION 'Invalid group column: %', p_group_col;
  END IF;

  IF p_filter_col IS NOT NULL AND p_filter_col NOT IN ('severity', 'processing_status', 'document_type') THEN
    RAISE EXCEPTION 'Invalid filter column: %', p_filter_col;
  END IF;

  query := format('SELECT COALESCE(jsonb_object_agg(COALESCE(%I::text, ''null''), cnt), ''{}''::jsonb) FROM (SELECT %I, COUNT(*) AS cnt FROM documents', p_group_col, p_group_col);

  IF p_filter_col IS NOT NULL AND p_filter_val IS NOT NULL THEN
    query := query || format(' WHERE %I = %L', p_filter_col, p_filter_val);
  END IF;

  query := query || format(' GROUP BY %I) sub', p_group_col);

  EXECUTE query INTO result;
  RETURN result;
END;
$$;

-- Grant execute to authenticated users (matches RLS read policy)
GRANT EXECUTE ON FUNCTION document_severity_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION document_storage_bytes() TO authenticated;
GRANT EXECUTE ON FUNCTION processing_queue_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION count_documents_by(TEXT, TEXT, TEXT) TO authenticated;
