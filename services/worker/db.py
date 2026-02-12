"""Supabase client wrapper for the processing worker."""

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


def fetch_next_queued() -> dict[str, Any] | None:
    """Fetch the next queued item from the processing queue."""
    client = get_client()
    result = (
        client.table("processing_queue")
        .select("*, documents(*)")
        .eq("status", "queued")
        .order("priority", desc=False)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def lock_queue_item(queue_id: str) -> None:
    """Lock a queue item by setting status to processing."""
    client = get_client()
    client.table("processing_queue").update(
        {"status": "processing", "started_at": "now()"}
    ).eq("id", queue_id).execute()


def update_queue_step(queue_id: str, step: str, results: dict | None = None) -> None:
    """Update the current processing step and optional results."""
    client = get_client()
    update: dict[str, Any] = {"current_step": step}
    if results:
        # Merge results into existing results JSONB
        existing = (
            client.table("processing_queue")
            .select("results")
            .eq("id", queue_id)
            .single()
            .execute()
        )
        merged = existing.data.get("results", {}) if existing.data else {}
        merged.update(results)
        update["results"] = merged
    client.table("processing_queue").update(update).eq("id", queue_id).execute()


def complete_queue_item(queue_id: str, document_id: str) -> None:
    """Mark a queue item as completed and document as needs_review."""
    client = get_client()
    client.table("processing_queue").update(
        {"status": "completed", "completed_at": "now()"}
    ).eq("id", queue_id).execute()
    client.table("documents").update(
        {"processing_status": "needs_review"}
    ).eq("id", document_id).execute()


def fail_queue_item(queue_id: str, document_id: str, error_message: str) -> None:
    """Mark a queue item and document as failed."""
    client = get_client()
    client.table("processing_queue").update(
        {"status": "failed", "error_message": error_message, "completed_at": "now()"}
    ).eq("id", queue_id).execute()
    client.table("documents").update(
        {"processing_status": "failed"}
    ).eq("id", document_id).execute()


def update_document(document_id: str, fields: dict[str, Any]) -> None:
    """Update fields on a document record."""
    client = get_client()
    client.table("documents").update(fields).eq("id", document_id).execute()


def update_queue_priority(queue_id: str, priority: int) -> None:
    """Update the priority of a queue item."""
    client = get_client()
    client.table("processing_queue").update(
        {"priority": priority}
    ).eq("id", queue_id).execute()


def complete_queue_item_with_status(
    queue_id: str, document_id: str, processing_status: str
) -> None:
    """Mark queue item completed and set a specific document processing_status."""
    client = get_client()
    client.table("processing_queue").update(
        {"status": "completed", "completed_at": "now()"}
    ).eq("id", queue_id).execute()
    client.table("documents").update(
        {"processing_status": processing_status}
    ).eq("id", document_id).execute()


# ── Stage 4-7 helpers ────────────────────────────────────────────


def fetch_all_entities() -> list[dict[str, Any]]:
    """Load all entities for name matching (id, name, aliases, tier, entity_type, category)."""
    client = get_client()
    result = (
        client.table("entities")
        .select("id, name, aliases, tier, entity_type, category")
        .execute()
    )
    return result.data or []


def fetch_document_for_processing(document_id: str) -> dict[str, Any] | None:
    """Fetch a single document with all fields."""
    client = get_client()
    result = (
        client.table("documents")
        .select("*")
        .eq("id", document_id)
        .single()
        .execute()
    )
    return result.data


def create_entity_document(
    entity_id: str,
    document_id: str,
    role: str,
    excerpt: str | None = None,
    page_number: int | None = None,
) -> None:
    """Insert an entity-document link (upsert to handle re-runs)."""
    client = get_client()
    row: dict[str, Any] = {
        "entity_id": entity_id,
        "document_id": document_id,
        "role_in_document": role,
    }
    if excerpt is not None:
        row["excerpt"] = excerpt
    if page_number is not None:
        row["page_number"] = page_number
    client.table("entity_documents").upsert(
        row, on_conflict="entity_id,document_id,role_in_document"
    ).execute()


def create_redaction(
    document_id: str,
    page_number: int,
    category: str | None,
    description: str,
    is_suspect: bool = False,
    red_flags: list[str] | None = None,
    assessment: str | None = None,
) -> None:
    """Insert a redaction record for a document page."""
    client = get_client()
    row: dict[str, Any] = {
        "document_id": document_id,
        "page_number": page_number,
        "description": description,
        "is_suspect": is_suspect,
    }
    if category is not None:
        row["category"] = category
    if red_flags:
        row["red_flags"] = red_flags
    if assessment is not None:
        row["assessment"] = assessment
    client.table("redactions").insert(row).execute()


def fetch_entity_documents_for_doc(document_id: str) -> list[dict[str, Any]]:
    """Get all entity links for a document."""
    client = get_client()
    result = (
        client.table("entity_documents")
        .select("entity_id, role_in_document")
        .eq("document_id", document_id)
        .execute()
    )
    return result.data or []


def fetch_documents_by_entities(entity_ids: list[str]) -> list[dict[str, Any]]:
    """Find documents that mention any of the given entities."""
    if not entity_ids:
        return []
    client = get_client()
    result = (
        client.table("entity_documents")
        .select("document_id, entity_id")
        .in_("entity_id", entity_ids)
        .limit(200)
        .execute()
    )
    return result.data or []


def fetch_events_by_date_range(
    start_date: str, end_date: str
) -> list[dict[str, Any]]:
    """Find timeline events within a date range."""
    client = get_client()
    result = (
        client.table("events")
        .select("id, date, title, event_type, significance")
        .gte("date", start_date)
        .lte("date", end_date)
        .limit(50)
        .execute()
    )
    return result.data or []


# ── Version diff helpers ─────────────────────────────────────────


def fetch_document_version(version_id: str) -> dict[str, Any] | None:
    """Fetch a specific version snapshot."""
    client = get_client()
    result = (
        client.table("document_versions")
        .select("*")
        .eq("id", version_id)
        .single()
        .execute()
    )
    return result.data


def fetch_redaction_summary(document_id: str) -> dict[str, Any]:
    """Compute current redaction summary for a document."""
    client = get_client()
    result = (
        client.table("redactions")
        .select("page_number, category")
        .eq("document_id", document_id)
        .execute()
    )
    redactions = result.data or []
    categories: dict[str, int] = {"A": 0, "B": 0, "C": 0, "D": 0}
    pages: set[int] = set()
    for r in redactions:
        cat = r.get("category")
        if cat and cat in categories:
            categories[cat] += 1
        page = r.get("page_number")
        if page is not None:
            pages.add(page)
    return {
        "total_pages_with_redactions": len(pages),
        "categories": categories,
        "total_redactions": len(redactions),
    }


def fetch_entity_ids_for_document(document_id: str) -> list[str]:
    """Get all entity IDs linked to a document."""
    client = get_client()
    result = (
        client.table("entity_documents")
        .select("entity_id")
        .eq("document_id", document_id)
        .execute()
    )
    return list({r["entity_id"] for r in (result.data or [])})
