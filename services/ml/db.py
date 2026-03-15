"""Supabase client wrapper for the ML pipeline."""

from typing import Any
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client | None = None


def get_client() -> Client:
    """Get or create the Supabase client (uses service role key to bypass RLS)."""
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


# ─────────────────────────────────────────────────
# Entity & document queries
# ─────────────────────────────────────────────────

def get_all_entities() -> list[dict[str, Any]]:
    """Fetch all entities with their names, aliases, tiers, and types."""
    client = get_client()
    result = client.table("entities").select(
        "id, name, aliases, entity_type, category, tier, profile_published"
    ).execute()
    return result.data or []


def get_entity_documents(
    entity_id: str | None = None,
    limit: int = 10000,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Fetch entity_documents links with optional entity filter."""
    client = get_client()
    query = client.table("entity_documents").select(
        "id, entity_id, document_id, role_in_document, excerpt, page_number"
    )
    if entity_id:
        query = query.eq("entity_id", entity_id)
    result = query.range(offset, offset + limit - 1).execute()
    return result.data or []


def get_entity_documents_count(entity_id: str | None = None) -> int:
    """Count entity_documents links."""
    client = get_client()
    query = client.table("entity_documents").select("id", count="exact")
    if entity_id:
        query = query.eq("entity_id", entity_id)
    result = query.execute()
    return result.count or 0


def get_document(document_id: str) -> dict[str, Any] | None:
    """Fetch a single document by ID."""
    client = get_client()
    result = client.table("documents").select("*").eq("id", document_id).single().execute()
    return result.data


def get_documents_by_ids(document_ids: list[str]) -> list[dict[str, Any]]:
    """Fetch multiple documents by their IDs."""
    client = get_client()
    result = client.table("documents").select(
        "id, bates_number, title, document_type, original_date, page_count, dataset_id, processing_status"
    ).in_("id", document_ids).execute()
    return result.data or []


def get_connections() -> list[dict[str, Any]]:
    """Fetch all entity connections."""
    client = get_client()
    result = client.table("entity_connections").select("*").execute()
    return result.data or []


def get_events_for_entity(entity_id: str) -> list[dict[str, Any]]:
    """Fetch events linked to an entity via entity_events."""
    client = get_client()
    result = client.table("entity_events").select(
        "id, entity_id, event_id, events(id, title, date, event_type, description)"
    ).eq("entity_id", entity_id).execute()
    return result.data or []


def get_redactions(document_id: str | None = None) -> list[dict[str, Any]]:
    """Fetch redaction records, optionally filtered by document."""
    client = get_client()
    query = client.table("redactions").select("*")
    if document_id:
        query = query.eq("document_id", document_id)
    result = query.execute()
    return result.data or []


# ─────────────────────────────────────────────────
# ML table writes
# ─────────────────────────────────────────────────

def create_training_snapshot(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a training snapshot record."""
    client = get_client()
    result = client.table("ml_training_snapshots").insert(data).execute()
    return result.data[0]


def create_model_run(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a model run record."""
    client = get_client()
    result = client.table("ml_model_runs").insert(data).execute()
    return result.data[0]


def update_model_run(run_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Update a model run record."""
    client = get_client()
    result = client.table("ml_model_runs").update(data).eq("id", run_id).execute()
    return result.data[0]


def upsert_crossref_scores(rows: list[dict[str, Any]]) -> int:
    """Bulk upsert cross-reference scores."""
    client = get_client()
    result = client.table("ml_crossref_scores").upsert(
        rows, on_conflict="document_a,document_b"
    ).execute()
    return len(result.data or [])


def insert_anomalies(rows: list[dict[str, Any]]) -> int:
    """Bulk insert anomaly detections."""
    client = get_client()
    result = client.table("ml_anomalies").insert(rows).execute()
    return len(result.data or [])


def upsert_connection_suggestions(rows: list[dict[str, Any]]) -> int:
    """Bulk upsert connection suggestions."""
    client = get_client()
    result = client.table("ml_connection_suggestions").upsert(
        rows, on_conflict="entity_a,entity_b,suggested_type"
    ).execute()
    return len(result.data or [])


def insert_entity_evals(rows: list[dict[str, Any]]) -> int:
    """Bulk insert entity evaluation records."""
    client = get_client()
    result = client.table("ml_entity_eval").insert(rows).execute()
    return len(result.data or [])


def create_connection(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a new entity_connections record (for approved suggestions)."""
    client = get_client()
    result = client.table("entity_connections").insert(data).execute()
    return result.data[0]
