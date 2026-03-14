-- Migration 021: Enable RLS on doj_accountability
-- Fixes Supabase Advisor security warning: "RLS Disabled in Public"
-- This table was created in migration 014 without RLS.

ALTER TABLE doj_accountability ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can view accountability records
CREATE POLICY "doj_accountability_public_read"
  ON doj_accountability
  FOR SELECT
  USING (true);

-- Write access: service role only (bypasses RLS automatically)
-- No INSERT/UPDATE/DELETE policies for anon or authenticated roles,
-- so writes are restricted to service_role key used by admin API routes.
