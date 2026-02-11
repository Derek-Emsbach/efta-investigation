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
