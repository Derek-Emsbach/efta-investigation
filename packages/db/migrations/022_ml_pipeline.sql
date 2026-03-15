-- Migration 022: ML Pipeline Tables
-- Adds tables for ML-assisted entity extraction, cross-referencing, anomaly detection,
-- and connection suggestions.

-- ─────────────────────────────────────────────────
-- Training data snapshots
-- ─────────────────────────────────────────────────
CREATE TABLE ml_training_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  total_samples INTEGER NOT NULL,
  positive_samples INTEGER,
  negative_samples INTEGER,
  split_config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(model_name, version)
);

-- ─────────────────────────────────────────────────
-- Model training/evaluation runs
-- ─────────────────────────────────────────────────
CREATE TABLE ml_model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_id UUID REFERENCES ml_training_snapshots(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  hyperparameters JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  artifact_path TEXT,
  duration_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────
-- Per-document entity extraction evaluation
-- ─────────────────────────────────────────────────
CREATE TABLE ml_entity_eval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES ml_training_snapshots(id),
  ground_truth_entity_ids UUID[] DEFAULT '{}',
  predicted_entity_ids UUID[] DEFAULT '{}',
  true_positives INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  false_negatives INTEGER DEFAULT 0,
  precision FLOAT,
  recall FLOAT,
  f1 FLOAT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────
-- Cross-reference confidence scores
-- ─────────────────────────────────────────────────
CREATE TABLE ml_crossref_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_a UUID REFERENCES documents(id) ON DELETE CASCADE,
  document_b UUID REFERENCES documents(id) ON DELETE CASCADE,
  score FLOAT CHECK (score >= 0 AND score <= 100),
  score_components JSONB DEFAULT '{}',
  model_run_id UUID REFERENCES ml_model_runs(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_a, document_b)
);

-- ─────────────────────────────────────────────────
-- Anomaly detections
-- ─────────────────────────────────────────────────
CREATE TABLE ml_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
    'redaction_inconsistency', 'redaction_density_spike', 'redaction_category_mismatch',
    'timeline_activity_gap', 'mention_frequency_spike', 'mention_frequency_drop', 'event_cluster',
    'entity_density_outlier', 'cross_dataset_redaction_inconsistency', 'type_redaction_combo'
  )),
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  score FLOAT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_ids UUID[] DEFAULT '{}',
  document_ids UUID[] DEFAULT '{}',
  evidence JSONB DEFAULT '{}',
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'confirmed', 'dismissed', 'false_positive')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  model_run_id UUID REFERENCES ml_model_runs(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────
-- Connection suggestions
-- ─────────────────────────────────────────────────
CREATE TABLE ml_connection_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a UUID REFERENCES entities(id) ON DELETE CASCADE,
  entity_b UUID REFERENCES entities(id) ON DELETE CASCADE,
  suggested_type TEXT NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  evidence_summary TEXT,
  co_occurrence_count INTEGER,
  shared_document_ids UUID[] DEFAULT '{}',
  context_excerpts JSONB DEFAULT '[]',
  score_components JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  merged_connection_id UUID REFERENCES entity_connections(id),
  model_run_id UUID REFERENCES ml_model_runs(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_a, entity_b, suggested_type)
);

-- ─────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────
CREATE INDEX idx_ml_anomalies_type ON ml_anomalies(anomaly_type);
CREATE INDEX idx_ml_anomalies_status ON ml_anomalies(review_status);
CREATE INDEX idx_ml_anomalies_severity ON ml_anomalies(severity);
CREATE INDEX idx_ml_suggestions_status ON ml_connection_suggestions(status);
CREATE INDEX idx_ml_suggestions_confidence ON ml_connection_suggestions(confidence DESC);
CREATE INDEX idx_ml_crossref_doc_a ON ml_crossref_scores(document_a);
CREATE INDEX idx_ml_crossref_doc_b ON ml_crossref_scores(document_b);
CREATE INDEX idx_ml_crossref_score ON ml_crossref_scores(score DESC);
CREATE INDEX idx_ml_entity_eval_doc ON ml_entity_eval(document_id);

-- ─────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────
ALTER TABLE ml_training_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_entity_eval ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_crossref_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_connection_suggestions ENABLE ROW LEVEL SECURITY;

-- Service role key bypasses RLS; these policies allow authenticated users read access
CREATE POLICY "Authenticated read" ON ml_training_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON ml_model_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON ml_entity_eval FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON ml_crossref_scores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON ml_anomalies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON ml_connection_suggestions FOR SELECT USING (auth.role() = 'authenticated');

-- Write policies for anomaly/suggestion review (authenticated users can update status)
CREATE POLICY "Authenticated update" ON ml_anomalies FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update" ON ml_connection_suggestions FOR UPDATE USING (auth.role() = 'authenticated');
