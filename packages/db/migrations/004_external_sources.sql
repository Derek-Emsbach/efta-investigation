-- External sources: Wikipedia, news, court records, etc.
CREATE TABLE IF NOT EXISTS external_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'wikipedia', 'news_article', 'court_record', 'flight_log',
    'public_record', 'financial_disclosure'
  )),
  source_url TEXT,
  source_name TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  published_date DATE,
  thumbnail_url TEXT,
  retrieved_at TIMESTAMPTZ DEFAULT now(),
  verification_status TEXT DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'disputed', 'retracted')),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- External events derived from external sources
CREATE TABLE IF NOT EXISTS external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  source_id UUID REFERENCES external_sources(id),
  event_type TEXT,
  verification_status TEXT DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'disputed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_sources_entity ON external_sources(entity_id);
CREATE INDEX IF NOT EXISTS idx_external_sources_type ON external_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_external_events_entity ON external_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_external_events_date ON external_events(date);

ALTER TABLE external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_events ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can read, service role can write
CREATE POLICY "authenticated_read_external_sources"
  ON external_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_external_events"
  ON external_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_write_external_sources"
  ON external_sources FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "service_write_external_events"
  ON external_events FOR ALL
  TO service_role
  USING (true);
