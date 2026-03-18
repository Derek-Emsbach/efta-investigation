-- 023: Stripe integration — add 'supporter' tier, stripe_customer_id, donation tracking
-- Model: subscriber (free) → supporter (one-time donation) → investigator (monthly subscription)

BEGIN;

-- ============================================================
-- 1. Add 'supporter' to subscription_tier CHECK constraint
-- ============================================================
-- PostgreSQL can't ALTER a CHECK constraint — drop and re-add.

-- Find and drop the existing CHECK constraint on subscription_tier
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%subscription_tier%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_tier_check
    CHECK (subscription_tier IN ('subscriber', 'supporter', 'investigator'));

-- ============================================================
-- 2. Add Stripe columns to profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS donation_total_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_donation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- 3. Update handle_new_user() — everyone starts as 'subscriber'
-- ============================================================
-- No more reading subscription_tier from signup metadata.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, display_name, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    'viewer',
    COALESCE((NEW.raw_user_meta_data->>'display_name')::TEXT, 'Anonymous'),
    'subscriber'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. Update investigator trigger to also handle supporter tier
-- ============================================================
-- Create investigator_stats row when tier becomes 'investigator' OR 'supporter'

CREATE OR REPLACE FUNCTION handle_investigator_signup() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_tier IN ('investigator', 'supporter') AND
     (OLD IS NULL OR OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier) THEN
    INSERT INTO investigator_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Donation log table (Stripe event dedup + audit trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS donation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,  -- idempotency key
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stripe_customer_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'one_time_payment',
    'subscription_created',
    'subscription_renewed',
    'subscription_cancelled',
    'subscription_expired'
  )),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donation_events_user ON donation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_donation_events_stripe ON donation_events(stripe_event_id);

ALTER TABLE donation_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own donation history
CREATE POLICY "own_donations_read" ON donation_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_donations_all" ON donation_events
  FOR ALL TO service_role USING (true);

COMMIT;
