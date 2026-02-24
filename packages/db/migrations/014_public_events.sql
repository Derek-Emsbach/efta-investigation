-- Migration 014: Public Events & DOJ Accountability
-- Tracks real-world developments (arrests, congressional actions, DOJ behavior)
-- Separate from the investigation `events` table (which tracks document review findings)

-- ============================================================================
-- Table 1: public_events
-- ============================================================================

CREATE TABLE public_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  date DATE NOT NULL,
  date_end DATE,                    -- For multi-day events (e.g., reading room access period)
  title TEXT NOT NULL,              -- Short headline: "Khanna reads 6 names on House floor"
  description TEXT,                 -- Longer description with context

  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'legislative',          -- Bills passed, votes, discharge petitions
    'congressional_action', -- Reading room visits, floor speeches, letters to DOJ
    'doj_release',          -- Dataset releases, compliance claims
    'doj_action',           -- Deletions, re-redactions, surveillance, false claims
    'criminal_action',      -- Arrests, charges, indictments, investigations opened
    'resignation',          -- Resignations, firings, suspensions
    'court_action',         -- Court filings, rulings, orders
    'media_break',          -- Major investigative reporting, new findings published
    'community_resource',   -- Tools launched (Jmail, rhowardstone), advocacy actions
    'international',        -- Foreign government actions, investigations, diplomatic fallout
    'victim_advocacy',      -- Survivor statements, advocacy group actions
    'other'
  )),
  impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN (
    'critical',   -- Changes the investigation landscape (arrest, major release)
    'high',       -- Significant development (resignation, new evidence published)
    'medium',     -- Notable event (congressional statement, media article)
    'low'         -- Minor/contextual (tool update, routine filing)
  )),

  -- References
  source_urls TEXT[],               -- Array of source URLs (news articles, official statements)
  efta_numbers TEXT[],              -- Related EFTA document numbers
  entity_names TEXT[],              -- People involved (by name, for display -- not FK)

  -- Metadata
  tags TEXT[],                      -- Freeform tags for filtering
  notes TEXT,                       -- Internal analysis notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Full-text search (generated column -- auto-maintained on insert/update)
ALTER TABLE public_events ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'C')
  ) STORED;

-- Indexes
CREATE INDEX idx_public_events_date ON public_events(date DESC);
CREATE INDEX idx_public_events_category ON public_events(category);
CREATE INDEX idx_public_events_impact ON public_events(impact_level);
CREATE INDEX idx_public_events_tags ON public_events USING gin(tags);
CREATE INDEX idx_public_events_entities ON public_events USING gin(entity_names);
CREATE INDEX idx_public_events_search ON public_events USING gin(search_vector);

-- RLS
ALTER TABLE public_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public_events
  FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- Table 2: doj_accountability
-- ============================================================================

CREATE TABLE doj_accountability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  date DATE NOT NULL,
  title TEXT NOT NULL,              -- Short headline: "DOJ deletes Trump photo EFTA00000468"
  description TEXT NOT NULL,        -- Detailed description with evidence

  -- Classification
  action_type TEXT NOT NULL CHECK (action_type IN (
    'file_deletion',        -- Published files removed from DOJ website
    're_redaction',         -- Files republished with additional redactions
    'deadline_violation',   -- Missed EFTA statutory deadlines
    'viewer_surveillance',  -- Monitoring of congressional reading room visitors
    'false_compliance',     -- Misleading claims about EFTA compliance
    'victim_exposure',      -- Victim names/images improperly exposed
    'perpetrator_protection', -- Powerful names redacted while victims exposed
    'metadata_suppression', -- Systematic metadata stripping from eDiscovery
    'obstruction',          -- Active interference with oversight
    'other'
  )),
  severity TEXT NOT NULL CHECK (severity IN (
    'critical',   -- Potential criminal violation (obstruction, contempt)
    'high',       -- Serious compliance failure
    'medium',     -- Concerning pattern
    'low'         -- Minor issue
  )),

  -- Evidence
  legal_basis TEXT,                 -- Which EFTA section is violated
  efta_numbers TEXT[],              -- Specific EFTA documents involved
  source_urls TEXT[],               -- Evidence sources

  -- Status
  status TEXT DEFAULT 'documented' CHECK (status IN (
    'documented',           -- We've recorded it
    'reported',             -- Reported to Congress or media
    'under_investigation',  -- Being investigated
    'resolved',             -- Addressed/corrected
    'ongoing'               -- Continuing violation
  )),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Full-text search
ALTER TABLE doj_accountability ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'C')
  ) STORED;

-- Indexes
CREATE INDEX idx_doj_acct_date ON doj_accountability(date DESC);
CREATE INDEX idx_doj_acct_type ON doj_accountability(action_type);
CREATE INDEX idx_doj_acct_severity ON doj_accountability(severity);
CREATE INDEX idx_doj_acct_status ON doj_accountability(status);
CREATE INDEX idx_doj_acct_search ON doj_accountability USING gin(search_vector);
