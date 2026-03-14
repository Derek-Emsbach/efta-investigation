// TypeScript types matching packages/db/schema.sql exactly
// All UUID columns → string, TEXT[] → string[], JSONB → Record<string, unknown>
// TSVECTOR columns omitted (server-only, never sent to client)

// ============================================================
// ENUM / UNION TYPES (from CHECK constraints)
// ============================================================

export type EntityType = 'person' | 'organization' | 'property' | 'vehicle' | 'trust' | 'agency'

export type PersonCategory = 'abuser' | 'attorney' | 'judge' | 'prosecutor' | 'victim' | 'staff' | 'witness' | 'recruiter'
export type OrgCategory = 'shell_company' | 'law_firm' | 'financial' | 'government' | 'nonprofit' | 'media'
export type EntityCategory = PersonCategory | OrgCategory

export type EntityStatus = 'convicted' | 'not_investigated' | 'settled' | 'identified' | 'deceased' | 'active' | 'unknown'

export type Tier = 1 | 2 | 3 | 4 | 5 | 6

export type DocumentType =
  | 'email' | 'fbi_302' | 'financial' | 'photo' | 'memo'
  | 'prosecution_memo' | 'court_filing' | 'victim_journal'
  | 'senate_letter' | 'legal_report' | 'call_notes' | 'blank'

export type Classification = 'high' | 'medium' | 'low'
export type Severity = 'extreme_critical' | 'critical' | 'high' | 'routine'
export type ProcessingStatus = 'pending_upload' | 'queued' | 'processing' | 'extracted' | 'needs_review' | 'reviewed' | 'published' | 'failed'

export type EventType = 'legal' | 'evidence' | 'communication' | 'institutional' | 'personal' | 'financial' | 'legislative' | 'travel' | 'sighting'
export type DatePrecision = 'day' | 'month' | 'year' | 'approximate'

export type RelationshipType =
  | 'employed_by' | 'trafficked_by' | 'represented_by' | 'investigated_by'
  | 'paid_by' | 'connected_to' | 'family_of' | 'victim_of' | 'attorney_for'
  | 'hired_by' | 'referred_by' | 'subsidiary_of' | 'owned_by'

export type EvidenceStrength = 'documented' | 'alleged' | 'circumstantial'
export type EvidenceType = 'financial' | 'testimony' | 'physical' | 'digital' | 'forensic' | 'documentary' | 'photographic'
export type EvidenceCategory = 'primary' | 'corroborating' | 'contradictory' | 'timeline'
export type EvidenceItemStrength = 'strong' | 'moderate' | 'weak'

export type RedactionCategory = 'A' | 'B' | 'C' | 'D'
export type RedactionAssessment = 'likely_violation' | 'suspect' | 'unclear' | 'needs_research' | 'review_failure'

export type LocationType = 'property' | 'airport' | 'office' | 'court' | 'restaurant' | 'hotel' | 'school' | 'other'
export type SightingType =
  | 'flight_departure' | 'flight_arrival' | 'present_at' | 'email_sent_from'
  | 'court_appearance' | 'photo_at' | 'financial_transaction' | 'phone_call'
  | 'text_message' | 'witness_testimony' | 'document_reference' | 'residence'
export type SightingConfidence = 'confirmed' | 'likely' | 'possible' | 'inferred'
export type TimePrecision = 'exact' | 'approximate' | 'day' | 'am_pm'

export type ImageType = 'embedded' | 'photo' | 'graphic' | 'signature' | 'map' | 'chart' | 'unknown'
export type ImageEntityRole = 'subject' | 'background' | 'mentioned'
export type TagConfidence = 'confirmed' | 'likely' | 'possible'

export type SuspectStatus = 'confirmed_co_conspirator' | 'suspect' | 'watchlist' | 'possible_suspect' | 'watch' | 'deprioritized'
export type SuspectPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
export type SuspectDbStatus = 'not_in_db' | 'pending_promotion' | 'in_db'

export type UserRole = 'admin' | 'viewer'

export type SubscriptionTier = 'subscriber' | 'investigator'

export type InvestigatorRank =
  | 'Junior Detective'
  | 'Detective'
  | 'Detective Sergeant'
  | 'Detective Lieutenant'
  | 'Detective Captain'
  | 'Chief Inspector'

export type XpEventType =
  | 'case_file_approved'
  | 'finding_approved'
  | 'comment_helpful'
  | 'first_approval_bonus'
  | 'manual_award'

export type DatasetStatus = 'not_started' | 'in_progress' | 'completed'
export type DatasetPriority = 'critical' | 'high' | 'medium' | 'low'
export type InvestigationStatus = 'active' | 'completed' | 'pending'

export type DocumentRole = 'subject' | 'mentioned' | 'author' | 'recipient' | 'witness' | 'photographer' | 'attorney'
export type EventRole = 'subject' | 'participant' | 'decision_maker' | 'victim' | 'witness'
export type InvestigationRole = 'subject' | 'prosecutor' | 'victim' | 'witness' | 'attorney'

export type QueueStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'needs_review'

// ============================================================
// TABLE INTERFACES
// ============================================================

export interface Dataset {
  id: string
  number: number
  name: string | null
  description: string | null
  size_bytes: number | null
  total_files: number | null
  total_pages: number | null
  reviewed_count: number
  bates_range_start: string | null
  bates_range_end: string | null
  release_date: string | null
  status: DatasetStatus
  priority: DatasetPriority
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Investigation {
  id: string
  name: string
  status: InvestigationStatus
  summary: string | null
  open_questions: string[]
  created_at: string
  updated_at: string
}

export interface VideoLink {
  url: string
  title: string
  source?: string
  date?: string
}

export interface Entity {
  id: string
  name: string
  slug: string | null
  entity_type: EntityType
  tier: Tier | null
  tier_justification: string | null
  category: EntityCategory | null
  bio: string | null
  status: EntityStatus | null
  aliases: string[]
  profile_image_url: string | null
  is_public: boolean
  datasets_appeared: number[]
  financial_summary: Record<string, unknown>
  profile_published: boolean
  video_links: VideoLink[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  bates_number: string | null
  dataset_id: string | null
  title: string | null
  document_type: DocumentType | null
  original_date: string | null
  date_range: { start: string; end: string } | null
  page_count: number | null
  file_size_bytes: number | null
  file_url: string | null
  thumbnail_url: string | null
  extracted_text: string | null
  summary: string | null
  classification: Classification | null
  severity: Severity | null
  processing_status: ProcessingStatus
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  batch_number: number | null
  forensic_metadata: Record<string, unknown>
  flags: string[]
  current_version: number
  version_notes: string | null
  created_at: string
  updated_at: string
}

export interface DocumentImage {
  id: string
  document_id: string
  page_number: number
  image_index: number
  r2_key: string
  thumbnail_r2_key: string | null
  file_size_bytes: number | null
  width: number | null
  height: number | null
  format: string | null
  image_type: ImageType
  tags: string[]
  caption: string | null
  is_redacted: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface ImageEntity {
  id: string
  image_id: string
  entity_id: string
  role: ImageEntityRole | null
  confidence: TagConfidence
  created_at: string
}

export interface ImageLocation {
  id: string
  image_id: string
  location_id: string
  confidence: TagConfidence
  notes: string | null
  created_at: string
}

export interface Event {
  id: string
  date: string | null
  date_end: string | null
  date_precision: DatePrecision
  time_start: string | null
  time_end: string | null
  title: string
  description: string | null
  significance: string | null
  event_type: EventType | null
  location_id: string | null
  investigation_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface EntityDocument {
  id: string
  entity_id: string
  document_id: string
  role_in_document: DocumentRole | null
  excerpt: string | null
  page_number: number | null
}

export interface EntityEvent {
  id: string
  entity_id: string
  event_id: string
  role: EventRole | null
}

export interface EventDocument {
  id: string
  event_id: string
  document_id: string
}

export interface EntityConnection {
  id: string
  entity_a: string
  entity_b: string
  relationship_type: RelationshipType
  evidence_strength: EvidenceStrength | null
  strength: number | null
  description: string | null
  source_document_ids: string[]
  start_date: string | null
  end_date: string | null
  metadata: Record<string, unknown>
}

export interface EntityInvestigation {
  id: string
  entity_id: string
  investigation_id: string
  role: InvestigationRole | null
}

export type InvestigationNoteType =
  | 'narrative'
  | 'ai_summary'
  | 'hypothesis'
  | 'gap_analysis'
  | 'evidence_summary'
  | 'user_note'

export interface InvestigationDocument {
  id: string
  investigation_id: string
  document_id: string
  relevance_notes: string | null
  added_at: string
}

export interface InvestigationEvent {
  id: string
  investigation_id: string
  event_id: string
  relevance_notes: string | null
  added_at: string
}

export interface InvestigationNote {
  id: string
  investigation_id: string
  content: string
  note_type: InvestigationNoteType
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  name: string
  location_type: LocationType | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  owner_entity_id: string | null
  description: string | null
  aliases: string[]
  metadata: Record<string, unknown>
  created_at: string
}

export interface EntitySighting {
  id: string
  entity_id: string
  location_id: string | null
  date: string
  time_start: string | null
  time_end: string | null
  time_precision: TimePrecision
  sighting_type: SightingType
  confidence: SightingConfidence
  description: string | null
  with_entities: string[]
  document_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface EvidenceItem {
  id: string
  entity_id: string
  document_id: string | null
  evidence_type: EvidenceType | null
  description: string
  category: EvidenceCategory | null
  strength: EvidenceItemStrength | null
  images: string[]
  date: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Redaction {
  id: string
  document_id: string
  page_number: number | null
  category: RedactionCategory | null
  description: string | null
  is_suspect: boolean
  red_flags: string[]
  assessment: RedactionAssessment | null
  notes: string | null
  created_at: string
}

export interface ProcessingQueueItem {
  id: string
  document_id: string
  status: QueueStatus
  priority: number
  current_step: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  results: Record<string, unknown>
  is_reprocess: boolean
  previous_version_id: string | null
  created_at: string
}

export type VersionTrigger = 'initial_import' | 'reupload' | 'reprocess'

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  trigger: VersionTrigger
  file_url: string | null
  file_size_bytes: number | null
  page_count: number | null
  extracted_text: string | null
  document_type: string | null
  original_date: string | null
  classification: string | null
  severity: string | null
  processing_status: string | null
  forensic_metadata: Record<string, unknown>
  flags: string[]
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  redaction_summary: Record<string, unknown>
  entity_ids: string[]
  processing_results: Record<string, unknown>
  created_at: string
}

export interface SuspectWatchlist {
  id: string
  name: string
  aliases: string[]
  status: SuspectStatus
  category: string | null
  priority: SuspectPriority | null
  public_sources: string | null
  known_connections: string | null
  entity_id: string | null
  db_status: SuspectDbStatus
  cross_references: string | null
  known_associates: string[]
  first_seen_document_id: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================================
// EXTERNAL SOURCES
// ============================================================

export type SourceType = 'wikipedia' | 'news_article' | 'court_record' | 'flight_log' | 'public_record' | 'financial_disclosure'
export type VerificationStatus = 'verified' | 'unverified' | 'disputed' | 'retracted'

export interface ExternalSource {
  id: string
  entity_id: string
  source_type: SourceType
  source_url: string | null
  source_name: string | null
  title: string | null
  content: string | null
  summary: string | null
  published_date: string | null
  thumbnail_url: string | null
  retrieved_at: string
  verification_status: VerificationStatus
  verified_by: string | null
  verified_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ExternalEvent {
  id: string
  entity_id: string
  date: string
  description: string
  source_id: string | null
  event_type: string | null
  verification_status: 'verified' | 'unverified' | 'disputed'
  metadata: Record<string, unknown>
  created_at: string
}

// ============================================================
// ADMIN METRICS & NOTIFICATIONS
// ============================================================

export type AlertType =
  | 'token_usage_high'
  | 'storage_warning'
  | 'database_warning'
  | 'failed_login'
  | 'worker_failure'
  | 'processing_backlog'
  | 'system_info'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface ApiUsageLog {
  id: string
  endpoint: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  total_tokens: number
  tool_iterations: number
  user_id: string | null
  duration_ms: number | null
  error: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  role: UserRole
  subscription_tier: SubscriptionTier | null
  avatar_url: string | null
  bio_short: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface InvestigatorStats {
  user_id: string
  xp_total: number
  current_rank: InvestigatorRank
  ai_queries_used_today: number
  ai_queries_reset_date: string
  ai_queries_daily_limit: number
  submissions_count: number
  approved_submissions_count: number
  first_approval_bonus_granted: boolean
  created_at: string
  updated_at: string
}

export interface XpTransaction {
  id: string
  user_id: string
  event_type: XpEventType
  xp_amount: number
  reference_id: string | null
  notes: string | null
  created_at: string
}

export interface NotificationAlert {
  id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  is_read: boolean
  dismissed: boolean
  metadata: Record<string, unknown>
  action_url: string | null
  created_at: string
}

// ============================================================
// PUBLICATION TABLES (The Epstein Record)
// ============================================================

export type StorySection = 'the-network' | 'follow-the-money' | 'the-cover-up' | 'the-operation' | 'voices'
export type CaseFileStatus = 'active' | 'complete' | 'archived'
export type CaseFileClassification = 'public' | 'restricted'
export type QuestionPriority = 'critical' | 'high' | 'medium' | 'low'
export type QuestionStatus = 'open' | 'partially_answered' | 'answered'

export interface Story {
  id: string
  slug: string
  title: string
  deck: string | null
  section: StorySection | null
  body_markdown: string
  byline: string
  reading_time_minutes: number | null
  is_published: boolean
  is_featured: boolean
  published_at: string | null
  case_file_id: string | null
  hero_image_url: string | null
  hero_image_caption: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface StoryEntity {
  id: string
  story_id: string
  entity_id: string
  mention_count: number
  is_primary: boolean
}

export interface StoryCitation {
  id: string
  story_id: string
  citation_number: number
  document_id: string | null
  description: string | null
  bates_number: string | null
  page_reference: string | null
}

export interface CaseFile {
  id: string
  slug: string
  case_id: string
  title: string
  status: CaseFileStatus
  classification: CaseFileClassification
  dataset_id: string | null
  summary: string | null
  findings_markdown: string
  methodology_notes: string | null
  date_range_start: string | null
  date_range_end: string | null
  docs_reviewed: number
  completion_percentage: number
  is_published: boolean
  published_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CaseFileEntity {
  id: string
  case_file_id: string
  entity_id: string
  role: string | null
}

export interface OpenQuestion {
  id: string
  case_file_id: string | null
  question: string
  priority: QuestionPriority
  status: QuestionStatus
  answer: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================================
// COMPOSITE / "WITH RELATIONS" TYPES
// ============================================================

export interface EntityWithCounts extends Entity {
  doc_count: number
  event_count: number
  connection_count: number
  evidence_count: number
}

export interface EntityWithRelations extends Entity {
  documents: (EntityDocument & { document: Document })[]
  events: (EntityEvent & { event: Event })[]
  connections: (EntityConnection & { connected_entity: Entity })[]
  evidence: EvidenceItem[]
  investigations: (EntityInvestigation & { investigation: Investigation })[]
}

export interface DocumentWithRelations extends Document {
  dataset: Dataset | null
  entities: (EntityDocument & { entity: Entity })[]
  redactions: Redaction[]
  evidence: EvidenceItem[]
  events: (EventDocument & { event: Event })[]
}

// ============================================================
// COMMUNITY PHASE 2: COMMENTS, REACTIONS, FLAGS
// ============================================================

export type CommentContentType = 'story' | 'case_file' | 'entity'
export type CommentReactionType = 'helpful' | 'insightful' | 'disagree'
export type CommentFlagReason = 'spam' | 'harassment' | 'misinformation' | 'off_topic' | 'other'
export type InaccuracyFlagStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export interface Comment {
  id: string
  content_type: CommentContentType
  content_id: string
  parent_id: string | null
  author_id: string
  body: string
  is_hidden: boolean
  is_deleted: boolean
  flag_count: number
  created_at: string
  updated_at: string
}

export interface CommentReaction {
  id: string
  comment_id: string
  user_id: string
  reaction_type: CommentReactionType
  created_at: string
}

export interface CommentFlag {
  id: string
  comment_id: string
  user_id: string
  reason: CommentFlagReason
  description: string | null
  created_at: string
}

export interface InaccuracyFlag {
  id: string
  content_type: CommentContentType
  content_id: string
  user_id: string
  excerpt: string | null
  description: string
  status: InaccuracyFlagStatus
  reviewer_id: string | null
  reviewer_notes: string | null
  resolved_at: string | null
  created_at: string
}

export interface CommentAuthor {
  id: string
  display_name: string | null
  avatar_url: string | null
  subscription_tier: SubscriptionTier | null
  current_rank: string | null
}

export interface CommentReactionCounts {
  helpful: number
  insightful: number
  disagree: number
}

export interface CommentWithAuthor extends Comment {
  author: CommentAuthor
  reactions: CommentReactionCounts
  user_reactions: CommentReactionType[]
  replies: CommentWithAuthor[]
}
