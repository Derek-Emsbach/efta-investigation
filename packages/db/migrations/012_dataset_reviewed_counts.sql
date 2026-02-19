-- Returns the count of reviewed documents per dataset (live, not cached).
-- Used by /datasets and dashboard pages to show accurate review progress.
CREATE OR REPLACE FUNCTION dataset_reviewed_counts()
RETURNS TABLE(dataset_id UUID, count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT d.dataset_id, COUNT(*) AS count
  FROM documents d
  WHERE d.dataset_id IS NOT NULL
    AND d.processing_status = 'reviewed'
  GROUP BY d.dataset_id;
$$;

GRANT EXECUTE ON FUNCTION dataset_reviewed_counts() TO authenticated;
