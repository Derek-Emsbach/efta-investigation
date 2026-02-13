-- EFTA Investigation Platform — Database Schema
-- Run this in Supabase SQL Editor to create all tables
-- Version 1.0 | February 2026

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Datasets (DS1-12)
CREATE TABLE datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  size_bytes BIGINT,
  total_files INTEGER,
  total_pages INTEGER,
  reviewed_count INTEGER DEFAULT 0,
  bates_range_start TEXT,
  bates_range_end TEXT,
  release_date DATE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Investigations (case threads like "Leon Black Prosecution Failure")
CREATE TABLE investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'pending')),
  summary TEXT,
  open_questions TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Entities (persons, organizations, properties, trusts, vehicles)
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'property', 'vehicle', 'trust', 'agency')),
  tier INTEGER CHECK (tier BETWEEN 1 AND 6),
  tier_justification TEXT,
  category TEXT, -- person: abuser, attorney, judge, prosecutor, victim, staff, witness, recruiter
                 -- org: shell_company, law_firm, financial, government, nonprofit, media
  bio TEXT,
  status TEXT, -- convicted, not_investigated, settled, identified, deceased, active, unknown
  aliases TEXT[] DEFAULT '{}',
  profile_image_url TEXT,
  is_public BOOLEAN DEFAULT false, -- victim privacy control
  datasets_appeared INTEGER[] DEFAULT '{}', -- which datasets this entity appears in
  metadata JSONB DEFAULT '{}',
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (every file ingested)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bates_number TEXT UNIQUE,
  dataset_id UUID REFERENCES datasets(id),
  title TEXT,
  document_type TEXT, -- email, fbi_302, financial, photo, memo, prosecution_memo, court_filing, 
                      -- victim_journal, senate_letter, legal_report, call_notes, blank
  original_date DATE,
  date_range DATERANGE,
  page_count INTEGER,
  file_size_bytes BIGINT,
  file_url TEXT, -- R2 URL to original file
  thumbnail_url TEXT, -- R2 URL to preview image
  extracted_text TEXT,
  summary TEXT,
  classification TEXT CHECK (classification IN ('high', 'medium', 'low')),
  severity TEXT CHECK (severity IN ('extreme_critical', 'critical', 'high', 'routine')),
  processing_status TEXT DEFAULT 'queued' 
    CHECK (processing_status IN ('queued', 'processing', 'extracted', 'needs_review', 'reviewed', 'published', 'failed')),
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  batch_number INTEGER, -- which review batch this was processed in
  forensic_metadata JSONB DEFAULT '{}',
  flags TEXT[] DEFAULT '{}', -- red_flag, redaction_failure, signature_violence, name_leak, etc.
  current_version INTEGER DEFAULT 1,
  version_notes TEXT,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events (timeline entries)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE,
  date_end DATE, -- for events spanning multiple days
  date_precision TEXT DEFAULT 'day' CHECK (date_precision IN ('day', 'month', 'year', 'approximate')),
  time_start TIME,                       -- for time-precise events
  time_end TIME,
  title TEXT NOT NULL,
  description TEXT,
  significance TEXT,
  event_type TEXT CHECK (event_type IN ('legal', 'evidence', 'communication', 'institutional', 'personal', 'financial', 'legislative', 'travel', 'sighting')),
  location_id UUID, -- will reference locations table
  investigation_id UUID REFERENCES investigations(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- JUNCTION / RELATIONSHIP TABLES
-- ============================================================

-- Entity ↔ Document (which entities appear in which documents)
CREATE TABLE entity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  role_in_document TEXT, -- subject, mentioned, author, recipient, witness, photographer, attorney
  excerpt TEXT, -- relevant quote from document
  page_number INTEGER,
  UNIQUE(entity_id, document_id, role_in_document)
);

-- Entity ↔ Event (which entities are involved in which events)
CREATE TABLE entity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  role TEXT, -- subject, participant, decision_maker, victim, witness
  UNIQUE(entity_id, event_id, role)
);

-- Event ↔ Document (which documents are sources for which events)
CREATE TABLE event_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(event_id, document_id)
);

-- Entity ↔ Entity (connections / relationships)
CREATE TABLE entity_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a UUID REFERENCES entities(id) ON DELETE CASCADE,
  entity_b UUID REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- employed_by, trafficked_by, represented_by, investigated_by,
                                   -- paid_by, connected_to, family_of, victim_of, attorney_for,
                                   -- hired_by, referred_by, subsidiary_of, owned_by
  evidence_strength TEXT CHECK (evidence_strength IN ('documented', 'alleged', 'circumstantial')),
  description TEXT,
  source_document_ids UUID[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(entity_a, entity_b, relationship_type)
);

-- Entity ↔ Investigation
CREATE TABLE entity_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  investigation_id UUID REFERENCES investigations(id) ON DELETE CASCADE,
  role TEXT, -- subject, prosecutor, victim, witness, attorney
  UNIQUE(entity_id, investigation_id)
);

-- Investigation ↔ Document
CREATE TABLE investigation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relevance_notes TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(investigation_id, document_id)
);

-- Investigation ↔ Event
CREATE TABLE investigation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  relevance_notes TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(investigation_id, event_id)
);

-- Investigation notes (narrative, AI summaries, analysis)
CREATE TABLE investigation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN (
    'narrative', 'ai_summary', 'hypothesis', 'gap_analysis', 'evidence_summary', 'user_note'
  )),
  created_by TEXT, -- 'user' or 'archer'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- LOCATION INTELLIGENCE TABLES
-- ============================================================

-- Every physical place referenced in the investigation
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_type TEXT CHECK (location_type IN ('property', 'airport', 'office', 'court', 'restaurant', 'hotel', 'school', 'other')),
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  owner_entity_id UUID REFERENCES entities(id),
  description TEXT,
  aliases TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entity location sightings — every time a document places a person at a place
CREATE TABLE entity_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  time_precision TEXT DEFAULT 'day' CHECK (time_precision IN ('exact', 'approximate', 'day', 'am_pm')),
  sighting_type TEXT NOT NULL CHECK (sighting_type IN (
    'flight_departure', 'flight_arrival', 'present_at', 'email_sent_from',
    'court_appearance', 'photo_at', 'financial_transaction', 'phone_call',
    'text_message', 'witness_testimony', 'document_reference', 'residence'
  )),
  confidence TEXT DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'likely', 'possible', 'inferred')),
  description TEXT,
  with_entities UUID[] DEFAULT '{}',
  document_id UUID REFERENCES documents(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- EVIDENCE & ANALYSIS TABLES
-- ============================================================

-- Evidence items (specific pieces of evidence against/about entities)
CREATE TABLE evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  evidence_type TEXT, -- financial, testimony, physical, digital, forensic, documentary, photographic
  description TEXT NOT NULL,
  category TEXT CHECK (category IN ('primary', 'corroborating', 'contradictory', 'timeline')),
  strength TEXT CHECK (strength IN ('strong', 'moderate', 'weak')),
  images TEXT[] DEFAULT '{}', -- R2 URLs
  date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Redaction analysis
CREATE TABLE redactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  category TEXT CHECK (category IN ('A', 'B', 'C', 'D')),
  description TEXT,
  is_suspect BOOLEAN DEFAULT false,
  red_flags TEXT[] DEFAULT '{}',
  assessment TEXT CHECK (assessment IN ('likely_violation', 'suspect', 'unclear', 'needs_research', 'review_failure')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Processing queue (for document pipeline)
CREATE TABLE processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'needs_review')),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  current_step TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  results JSONB DEFAULT '{}',
  is_reprocess BOOLEAN DEFAULT false,
  previous_version_id UUID, -- references document_versions(id)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document versions (snapshots before re-processing / re-upload)
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('initial_import', 'reupload', 'reprocess')),
  file_url TEXT,
  file_size_bytes BIGINT,
  page_count INTEGER,
  extracted_text TEXT,
  document_type TEXT,
  original_date DATE,
  classification TEXT,
  severity TEXT,
  processing_status TEXT,
  forensic_metadata JSONB DEFAULT '{}',
  flags TEXT[] DEFAULT '{}',
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  redaction_summary JSONB DEFAULT '{}',
  entity_ids TEXT[] DEFAULT '{}',
  processing_results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, version_number)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Full-text search indexes
CREATE INDEX idx_entities_search ON entities USING GIN(search_vector);
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);

-- Common query indexes
CREATE INDEX idx_entities_tier ON entities(tier);
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_category ON entities(category);
CREATE INDEX idx_entities_name ON entities(name);

CREATE INDEX idx_documents_bates ON documents(bates_number);
CREATE INDEX idx_documents_dataset ON documents(dataset_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_severity ON documents(severity);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_date ON documents(original_date);

CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_investigation ON events(investigation_id);

CREATE INDEX idx_entity_documents_entity ON entity_documents(entity_id);
CREATE INDEX idx_entity_documents_document ON entity_documents(document_id);

CREATE INDEX idx_entity_connections_a ON entity_connections(entity_a);
CREATE INDEX idx_entity_connections_b ON entity_connections(entity_b);
CREATE INDEX idx_entity_connections_type ON entity_connections(relationship_type);

CREATE INDEX idx_evidence_entity ON evidence_items(entity_id);
CREATE INDEX idx_evidence_document ON evidence_items(document_id);

CREATE INDEX idx_redactions_document ON redactions(document_id);
CREATE INDEX idx_redactions_category ON redactions(category);

CREATE INDEX idx_inv_docs_investigation ON investigation_documents(investigation_id);
CREATE INDEX idx_inv_docs_document ON investigation_documents(document_id);
CREATE INDEX idx_inv_events_investigation ON investigation_events(investigation_id);
CREATE INDEX idx_inv_events_event ON investigation_events(event_id);
CREATE INDEX idx_inv_notes_investigation ON investigation_notes(investigation_id);

CREATE INDEX idx_locations_type ON locations(location_type);
CREATE INDEX idx_locations_city ON locations(city);

CREATE INDEX idx_sightings_entity ON entity_sightings(entity_id);
CREATE INDEX idx_sightings_location ON entity_sightings(location_id);
CREATE INDEX idx_sightings_date ON entity_sightings(date);
CREATE INDEX idx_sightings_type ON entity_sightings(sighting_type);
CREATE INDEX idx_sightings_entity_date ON entity_sightings(entity_id, date);

CREATE INDEX idx_processing_status ON processing_queue(status);
CREATE INDEX idx_processing_priority ON processing_queue(priority);

-- ============================================================
-- FULL-TEXT SEARCH TRIGGERS
-- ============================================================

-- Auto-update entity search vector
CREATE OR REPLACE FUNCTION entities_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.aliases, ' '), '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_search_trigger
  BEFORE INSERT OR UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION entities_search_update();

-- Auto-update document search vector
CREATE OR REPLACE FUNCTION documents_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.bates_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_search_trigger
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_search_update();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE redactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_sightings ENABLE ROW LEVEL SECURITY;

-- Admin: full access (authenticated users)
-- For now, all authenticated users are admins
CREATE POLICY "Admin full access" ON entities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON entity_documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON entity_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON event_documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON entity_connections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON evidence_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON redactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON datasets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON investigations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON processing_queue FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON entity_investigations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON investigation_documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON investigation_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON investigation_notes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON locations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON entity_sightings FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- PLATFORM SUGGESTIONS (AI Assistant)
-- ============================================================

CREATE TABLE platform_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('feature', 'tracking', 'tool', 'investigation', 'data_model', 'ux')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'dismissed', 'completed')),
  source_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE platform_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON platform_suggestions FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- CONVERSATION PERSISTENCE (Detective Partner)
-- ============================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_conv_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_conv_messages_created ON conversation_messages(conversation_id, created_at);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON conversations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access" ON conversation_messages FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- ADMIN METRICS & NOTIFICATIONS
-- ============================================================

-- API usage tracking (one row per AI request)
CREATE TABLE api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  tool_iterations INTEGER DEFAULT 1,
  user_id UUID,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_usage_created ON api_usage_log(created_at DESC);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON api_usage_log FOR ALL USING (auth.role() = 'authenticated');

-- Notification alerts
CREATE TABLE notification_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'token_usage_high', 'storage_warning', 'database_warning',
    'failed_login', 'worker_failure', 'processing_backlog',
    'system_info'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_active ON notification_alerts(created_at DESC) WHERE NOT dismissed;

ALTER TABLE notification_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON notification_alerts FOR ALL USING (auth.role() = 'authenticated');

-- Service role bypass (for worker)
-- The service_role key bypasses RLS automatically in Supabase
