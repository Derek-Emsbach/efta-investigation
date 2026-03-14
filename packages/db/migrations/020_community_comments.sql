-- Migration 020: Community Phase 2 — Comments, Reactions, Flags
-- Adds subscriber social features: threaded comments on stories/case files/entities,
-- per-comment reactions (helpful/insightful/disagree), comment flagging with auto-hide,
-- and inaccuracy flags for editorial content.

BEGIN;

-- ============================================================
-- 1. Comments (polymorphic on content_type + content_id)
-- ============================================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('story', 'case_file', 'entity')),
  content_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  flag_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_content ON comments(content_type, content_id, created_at DESC);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_flagged ON comments(flag_count DESC) WHERE flag_count > 0 AND NOT is_deleted;

-- ============================================================
-- 2. Comment reactions
-- ============================================================

CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('helpful', 'insightful', 'disagree')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX idx_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_reactions_user ON comment_reactions(user_id);

-- ============================================================
-- 3. Comment flags (community moderation)
-- ============================================================

CREATE TABLE comment_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'misinformation', 'off_topic', 'other')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_flags_comment ON comment_flags(comment_id);

-- ============================================================
-- 4. Inaccuracy flags (factual errors in published content)
-- ============================================================

CREATE TABLE inaccuracy_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('story', 'case_file', 'entity')),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  excerpt TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  reviewer_id UUID REFERENCES profiles(id),
  reviewer_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inaccuracy_content ON inaccuracy_flags(content_type, content_id);
CREATE INDEX idx_inaccuracy_status ON inaccuracy_flags(status) WHERE status IN ('pending', 'under_review');
CREATE INDEX idx_inaccuracy_user ON inaccuracy_flags(user_id);

-- ============================================================
-- 5. Auto-hide trigger: hide comment after 3 community flags
-- ============================================================

CREATE OR REPLACE FUNCTION handle_comment_flag() RETURNS TRIGGER AS $$
BEGIN
  UPDATE comments
    SET flag_count = flag_count + 1,
        is_hidden = CASE WHEN flag_count + 1 >= 3 THEN true ELSE is_hidden END,
        updated_at = now()
    WHERE id = NEW.comment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_flag
  AFTER INSERT ON comment_flags
  FOR EACH ROW EXECUTE FUNCTION handle_comment_flag();

-- ============================================================
-- 6. Row Level Security
-- ============================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE inaccuracy_flags ENABLE ROW LEVEL SECURITY;

-- Comments: authenticated can read non-deleted
CREATE POLICY "authenticated_read_comments" ON comments
  FOR SELECT TO authenticated USING (NOT is_deleted);

CREATE POLICY "users_create_comments" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "users_update_own_comments" ON comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "service_comments_all" ON comments
  FOR ALL TO service_role USING (true);

-- Reactions: authenticated read all, insert/delete own
CREATE POLICY "authenticated_read_reactions" ON comment_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_create_reactions" ON comment_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_reactions" ON comment_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service_reactions_all" ON comment_reactions
  FOR ALL TO service_role USING (true);

-- Flags: users insert own, service full access
CREATE POLICY "users_create_flags" ON comment_flags
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_flags_all" ON comment_flags
  FOR ALL TO service_role USING (true);

-- Inaccuracy flags: users insert + read own, service full access
CREATE POLICY "users_create_inaccuracy" ON inaccuracy_flags
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_inaccuracy" ON inaccuracy_flags
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service_inaccuracy_all" ON inaccuracy_flags
  FOR ALL TO service_role USING (true);

COMMIT;
