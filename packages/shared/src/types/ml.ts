// ─────────────────────────────────────────────────
// ML Pipeline Types
// ─────────────────────────────────────────────────

export type MlModelStatus = 'pending' | 'running' | 'completed' | 'failed'

export type MlAnomalyType =
  | 'redaction_inconsistency'
  | 'redaction_density_spike'
  | 'redaction_category_mismatch'
  | 'timeline_gap'
  | 'timeline_cluster'
  | 'entity_appearance_disappearance'
  | 'entity_density_outlier'
  | 'cross_dataset_inconsistency'
  | 'document_type_redaction_combo'

export type MlAnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

export type MlAnomalyStatus = 'new' | 'reviewing' | 'confirmed' | 'dismissed' | 'false_positive'

export type MlSuggestionStatus = 'pending' | 'approved' | 'rejected' | 'merged'

export type MlConnectionType =
  | 'attorney_for'
  | 'family_of'
  | 'co_accused'
  | 'financial'
  | 'social'
  | 'employed_by'
  | 'connected_to'

export interface MlTrainingSnapshot {
  id: string
  model_name: string
  version: number
  total_samples: number
  positive_samples: number | null
  negative_samples: number | null
  split_config: Record<string, number>
  metadata: Record<string, unknown>
  created_at: string
}

export interface MlModelRun {
  id: string
  model_name: string
  version: number
  snapshot_id: string | null
  status: MlModelStatus
  hyperparameters: Record<string, unknown>
  metrics: {
    precision?: number
    recall?: number
    f1?: number
    accuracy?: number
    confusion_matrix?: number[][]
    [key: string]: unknown
  }
  artifact_path: string | null
  duration_seconds: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface MlEntityEval {
  id: string
  document_id: string
  snapshot_id: string | null
  ground_truth_entity_ids: string[]
  predicted_entity_ids: string[]
  true_positives: number
  false_positives: number
  false_negatives: number
  precision: number | null
  recall: number | null
  f1: number | null
  details: Record<string, unknown>
  created_at: string
}

export interface MlCrossrefScore {
  id: string
  document_a: string
  document_b: string
  score: number
  score_components: {
    entity_cooccurrence?: number
    semantic_similarity?: number
    temporal_proximity?: number
    document_type_compat?: number
  }
  model_run_id: string | null
  created_at: string
}

export interface MlAnomaly {
  id: string
  anomaly_type: MlAnomalyType
  severity: MlAnomalySeverity
  score: number | null
  title: string
  description: string
  entity_ids: string[]
  document_ids: string[]
  evidence: Record<string, unknown>
  status: MlAnomalyStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  model_run_id: string | null
  created_at: string
}

export interface MlConnectionSuggestion {
  id: string
  entity_a: string
  entity_b: string
  suggested_type: MlConnectionType
  confidence: number
  evidence_summary: string | null
  co_occurrence_count: number | null
  shared_document_ids: string[]
  context_excerpts: Array<{
    document_id: string
    excerpt: string
    page?: number
  }>
  score_components: {
    frequency?: number
    context_quality?: number
    document_type_diversity?: number
    entity_tier_relevance?: number
    claude_classification?: number
  }
  status: MlSuggestionStatus
  approved_by: string | null
  approved_at: string | null
  merged_connection_id: string | null
  model_run_id: string | null
  created_at: string
  // Joined fields (from API queries)
  entity_a_name?: string
  entity_a_tier?: number
  entity_b_name?: string
  entity_b_tier?: number
}
