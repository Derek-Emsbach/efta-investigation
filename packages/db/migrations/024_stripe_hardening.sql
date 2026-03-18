-- 024: Stripe hardening — atomic donation increment, replay protection, redundant index cleanup

BEGIN;

-- ============================================================
-- 1. Drop redundant index (stripe_event_id UNIQUE already creates one)
-- ============================================================

DROP INDEX IF EXISTS idx_donation_events_stripe;

-- ============================================================
-- 2. Atomic donation increment with replay guard
-- ============================================================
-- Prevents double-counting when Stripe replays an event.
-- Only increments if the donation_events row was freshly inserted
-- (i.e., stripe_event_id didn't already exist).

CREATE OR REPLACE FUNCTION record_donation(
  p_stripe_event_id TEXT,
  p_user_id UUID,
  p_stripe_customer_id TEXT,
  p_event_type TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT DEFAULT 'usd',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN  -- true if new event, false if duplicate
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inserted BOOLEAN;
BEGIN
  -- Attempt insert; do nothing on duplicate stripe_event_id
  INSERT INTO donation_events (
    stripe_event_id, user_id, stripe_customer_id,
    event_type, amount_cents, currency, metadata
  ) VALUES (
    p_stripe_event_id, p_user_id, p_stripe_customer_id,
    p_event_type, p_amount_cents, p_currency, p_metadata
  )
  ON CONFLICT (stripe_event_id) DO NOTHING;

  -- Check if we actually inserted
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted THEN
    -- Atomically increment the user's donation total
    UPDATE profiles
    SET donation_total_cents = donation_total_cents + p_amount_cents,
        first_donation_at = COALESCE(first_donation_at, now())
    WHERE id = p_user_id;
  END IF;

  RETURN inserted;
END;
$$;

-- ============================================================
-- 3. Remove 'subscription_renewed' from event_type CHECK
-- ============================================================
-- No Stripe event maps to this type. Renewals come via
-- invoice.payment_succeeded which we track as one_time_payment
-- or handle via subscription_updated.

ALTER TABLE donation_events DROP CONSTRAINT IF EXISTS donation_events_event_type_check;

ALTER TABLE donation_events
  ADD CONSTRAINT donation_events_event_type_check
    CHECK (event_type IN (
      'one_time_payment',
      'subscription_created',
      'subscription_cancelled',
      'subscription_expired'
    ));

-- ============================================================
-- 4. Restrict investigator_stats trigger to 'investigator' only
-- ============================================================
-- Supporters are donors, not workspace users. Only investigators
-- get investigator_stats rows and workspace access.

CREATE OR REPLACE FUNCTION handle_investigator_signup() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_tier = 'investigator' AND
     (OLD IS NULL OR OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier) THEN
    INSERT INTO investigator_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
