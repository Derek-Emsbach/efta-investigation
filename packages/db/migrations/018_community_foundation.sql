-- 018: Community foundation — subscriber/investigator tiers, XP, ranks
-- Extends profiles table and adds investigator_stats + xp_transactions

BEGIN;

-- ============================================================
-- 1. Extend profiles table with community fields
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT
    CHECK (subscription_tier IN ('subscriber', 'investigator')),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio_short TEXT,       -- max 160 chars, enforced at app layer
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_tier
  ON profiles(subscription_tier)
  WHERE subscription_tier IS NOT NULL;

-- ============================================================
-- 2. Update handle_new_user() trigger to read tier from metadata
-- ============================================================
-- When signing up via the public form, users pass subscription_tier
-- and display_name in Supabase auth metadata (options.data).
-- This trigger reads those values at profile creation time.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, display_name, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    'viewer',
    (NEW.raw_user_meta_data->>'display_name')::TEXT,
    (NEW.raw_user_meta_data->>'subscription_tier')::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Investigator stats (XP, rank, quota) — separate from profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS investigator_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp_total INTEGER NOT NULL DEFAULT 0,
  current_rank TEXT NOT NULL DEFAULT 'Junior Detective'
    CHECK (current_rank IN (
      'Junior Detective',
      'Detective',
      'Detective Sergeant',
      'Detective Lieutenant',
      'Detective Captain',
      'Chief Inspector'
    )),
  ai_queries_used_today INTEGER NOT NULL DEFAULT 0,
  ai_queries_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_queries_daily_limit INTEGER NOT NULL DEFAULT 10,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  approved_submissions_count INTEGER NOT NULL DEFAULT 0,
  first_approval_bonus_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. XP transaction ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'case_file_approved',
    'finding_approved',
    'comment_helpful',
    'first_approval_bonus',
    'manual_award'
  )),
  xp_amount INTEGER NOT NULL,
  reference_id UUID,           -- submission_id or comment_id
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created ON xp_transactions(created_at DESC);

-- ============================================================
-- 5. Rank computation function (immutable — safe to use in triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION compute_rank(xp INTEGER) RETURNS TEXT AS $$
BEGIN
  IF xp >= 10000 THEN RETURN 'Chief Inspector';
  ELSIF xp >= 4000 THEN RETURN 'Detective Captain';
  ELSIF xp >= 1500 THEN RETURN 'Detective Lieutenant';
  ELSIF xp >= 500  THEN RETURN 'Detective Sergeant';
  ELSIF xp >= 100  THEN RETURN 'Detective';
  ELSE RETURN 'Junior Detective';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 6. Trigger: update investigator_stats on xp_transactions insert
-- ============================================================

CREATE OR REPLACE FUNCTION handle_xp_transaction() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO investigator_stats (user_id, xp_total, current_rank)
  VALUES (NEW.user_id, NEW.xp_amount, compute_rank(NEW.xp_amount))
  ON CONFLICT (user_id) DO UPDATE
    SET xp_total     = investigator_stats.xp_total + NEW.xp_amount,
        current_rank = compute_rank(investigator_stats.xp_total + NEW.xp_amount),
        updated_at   = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_xp_transaction
  AFTER INSERT ON xp_transactions
  FOR EACH ROW EXECUTE FUNCTION handle_xp_transaction();

-- Auto-create investigator_stats row when a user signs up as investigator
CREATE OR REPLACE FUNCTION handle_investigator_signup() RETURNS TRIGGER AS $$
BEGIN
  -- Only create stats row for investigator tier
  IF NEW.subscription_tier = 'investigator' AND
     (OLD IS NULL OR OLD.subscription_tier IS DISTINCT FROM 'investigator') THEN
    INSERT INTO investigator_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_investigator_profile
  AFTER INSERT OR UPDATE OF subscription_tier ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_investigator_signup();

-- ============================================================
-- 7. Row Level Security
-- ============================================================

ALTER TABLE investigator_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own stats
CREATE POLICY "own_stats_read" ON investigator_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role full access (admin API routes)
CREATE POLICY "service_stats_all" ON investigator_stats
  FOR ALL TO service_role USING (true);

-- Public can read basic stats (for leaderboard — rank + xp only)
-- Note: leaderboard API queries via service_role with explicit column selection
CREATE POLICY "own_xp_read" ON xp_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_xp_all" ON xp_transactions
  FOR ALL TO service_role USING (true);

-- Allow public profiles to be read (for comment author display)
-- The existing "authenticated_read_profiles" covers logged-in users.
-- Anon needs to read display_name, avatar_url, subscription_tier, current_rank
-- for the public comment threads. Use service role in the public API route.
-- No anon RLS policy needed — public comments API uses service_role key.

COMMIT;
