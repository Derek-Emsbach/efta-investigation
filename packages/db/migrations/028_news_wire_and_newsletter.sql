-- Migration 028: News Wire + Newsletter subscribers
--
-- news_items: externally-sourced news headlines shown on the homepage "News Wire".
--   Written ONLY by the server (service role) — the /api/cron/news-wire job or an admin.
--   Every row is attributed to an outside outlet and links out. The site does not
--   author allegations here; summaries are neutral restatements of the linked report.
--
-- newsletter_subscribers: email capture for the weekly digest. No sending vendor yet;
--   export to Buttondown/Substack/Resend when ready.

CREATE TABLE IF NOT EXISTS news_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline      TEXT NOT NULL CHECK (char_length(headline) BETWEEN 10 AND 220),
  summary       TEXT NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 600),
  source_name   TEXT NOT NULL,               -- e.g. 'Reuters'
  source_url    TEXT NOT NULL UNIQUE,        -- dedupe key
  published_at  TIMESTAMPTZ,                 -- outlet's publish time (best effort)
  category      TEXT NOT NULL DEFAULT 'news'
                CHECK (category IN ('news', 'court', 'congress', 'doj-release', 'investigation')),
  is_published  BOOLEAN NOT NULL DEFAULT true,  -- flip false to pull an item instantly
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  related_story_slug TEXT,                   -- optional link to one of our stories
  created_by    TEXT NOT NULL DEFAULT 'news-wire-cron',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_items_feed
  ON news_items (is_published, is_pinned DESC, published_at DESC NULLS LAST);

ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_items_public_read" ON news_items;
CREATE POLICY "news_items_public_read" ON news_items
  FOR SELECT TO anon, authenticated USING (is_published = true);
-- No insert/update policies: only the service role (bypasses RLS) writes.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  source         TEXT,                        -- which form: 'home', 'story', 'support', 'footer'
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email_lower
  ON newsletter_subscribers (lower(email));

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- No public policies at all: emails are never readable or writable from the browser.
