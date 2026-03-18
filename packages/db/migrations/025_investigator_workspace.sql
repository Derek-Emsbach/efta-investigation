-- 025: Investigator Workspace — notes, submissions, XP-on-approve trigger

BEGIN;

-- ============================================================
-- 1. Personal notes for investigators + supporters
-- ============================================================

CREATE TABLE IF NOT EXISTS investigator_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  entity_ids UUID[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigator_notes_user
  ON investigator_notes(user_id);

ALTER TABLE investigator_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notes_all" ON investigator_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_notes_all" ON investigator_notes
  FOR ALL TO service_role USING (true);

-- ============================================================
-- 2. User submissions (findings, connections, entities, corrections)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN (
    'finding', 'connection', 'entity', 'correction'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  entity_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'approved', 'rejected'
  )),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_submissions_user
  ON user_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_submissions_status
  ON user_submissions(status);

ALTER TABLE user_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_submissions_all" ON user_submissions
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service_submissions_all" ON user_submissions
  FOR ALL TO service_role USING (true);

-- ============================================================
-- 3. XP-on-approve trigger
-- ============================================================
-- Awards XP when a submission is approved. Also tracks submission counts.

CREATE OR REPLACE FUNCTION handle_submission_status_change()
RETURNS TRIGGER AS $$
DECLARE
  xp INTEGER;
BEGIN
  -- Award XP on approval
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    xp := CASE NEW.submission_type
      WHEN 'entity'     THEN 75
      WHEN 'finding'    THEN 50
      WHEN 'connection' THEN 30
      WHEN 'correction' THEN 25
      ELSE 0
    END;

    INSERT INTO xp_transactions (user_id, event_type, xp_amount, reference_id, notes)
    VALUES (NEW.user_id, 'finding_approved', xp, NEW.id,
            'Submission approved: ' || LEFT(NEW.title, 100));

    UPDATE user_submissions SET xp_awarded = xp WHERE id = NEW.id;

    UPDATE investigator_stats
    SET approved_submissions_count = approved_submissions_count + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  -- Track submission count when first submitted
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    UPDATE investigator_stats
    SET submissions_count = submissions_count + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_submission_status_change
  AFTER UPDATE ON user_submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_submission_status_change();

COMMIT;
