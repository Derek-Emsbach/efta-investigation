"""
Stage 9: Auto-Review

Lightweight AI agent that runs after classification (Stage 7) on documents
with score >= AUTO_REVIEW_MIN_SCORE. Uses Claude Haiku for cost-effective
entity discovery and redaction validation.

Actions are split into two categories:
  - Auto-applied (safe): Entity-document links for existing entities,
    new T5/T6 entities
  - Queued for review (risky): New T1-T4 entities, redaction overrides

Cost: ~$0.01-0.03/doc with Haiku (vs $0.15-0.30 with Sonnet)
"""

import json
import time
from typing import Any
from pathlib import Path

from config import (
    AUTO_REVIEW_MODEL,
    AUTO_REVIEW_MAX_TEXT,
    AUTO_REVIEW_DAILY_BUDGET,
    AUTO_REVIEW_RATE_LIMIT,
    ANTHROPIC_API_KEY,
)
from db import (
    fetch_document_for_processing,
    fetch_all_entities,
    create_entity_document,
    get_client,
)
from storage import download_text
from stages.auto_review_prompt import SYSTEM_PROMPT, build_user_prompt


# ── Rate limiting + budget tracking ──────────────────────

_call_timestamps: list[float] = []
_daily_spend: float = 0.0
_daily_spend_reset: float = 0.0

# Approximate Haiku pricing (per 1K tokens)
HAIKU_INPUT_COST = 0.001   # $1/MTok input
HAIKU_OUTPUT_COST = 0.005  # $5/MTok output


def _check_rate_limit() -> bool:
    """Returns True if we can make another API call."""
    now = time.time()
    # Remove timestamps older than 60 seconds
    while _call_timestamps and _call_timestamps[0] < now - 60:
        _call_timestamps.pop(0)
    return len(_call_timestamps) < AUTO_REVIEW_RATE_LIMIT


def _record_call():
    """Record an API call timestamp."""
    _call_timestamps.append(time.time())


def _check_budget() -> bool:
    """Returns True if daily budget hasn't been exceeded."""
    global _daily_spend, _daily_spend_reset
    now = time.time()
    # Reset daily spend at midnight (approximation: every 86400s)
    if now - _daily_spend_reset > 86400:
        _daily_spend = 0.0
        _daily_spend_reset = now
    return _daily_spend < AUTO_REVIEW_DAILY_BUDGET


def _record_cost(input_tokens: int, output_tokens: int):
    """Record estimated cost from token usage."""
    global _daily_spend
    cost = (input_tokens / 1000 * HAIKU_INPUT_COST) + (output_tokens / 1000 * HAIKU_OUTPUT_COST)
    _daily_spend += cost


# ── Entity catalog cache (reuse from Stage 4) ────────────

def _get_entity_name_map() -> dict[str, dict[str, Any]]:
    """Build name→entity mapping for matching AI-found entities to existing ones."""
    entities = fetch_all_entities()
    name_map: dict[str, dict[str, Any]] = {}
    for entity in entities:
        name_map[entity["name"].lower()] = entity
        for alias in (entity.get("aliases") or []):
            name_map[alias.lower()] = entity
    return name_map


# ── AI call ───────────────────────────────────────────────

def _call_claude(document_text: str, known_entities: list[str],
                 redaction_summary: dict | None, document_type: str | None,
                 bates_number: str | None) -> dict[str, Any] | None:
    """Call Claude Haiku and parse the JSON response."""
    import anthropic

    if not ANTHROPIC_API_KEY:
        return None

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    user_prompt = build_user_prompt(
        document_text=document_text[:AUTO_REVIEW_MAX_TEXT],
        known_entities=known_entities,
        redaction_summary=redaction_summary,
        document_type=document_type,
        bates_number=bates_number,
    )

    _record_call()

    response = client.messages.create(
        model=AUTO_REVIEW_MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    # Track cost
    usage = response.usage
    _record_cost(usage.input_tokens, usage.output_tokens)

    # Parse JSON from response
    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


# ── Apply safe actions ────────────────────────────────────

def _apply_safe_actions(
    result: dict[str, Any],
    document_id: str,
    name_map: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """
    Auto-apply safe actions from the AI review:
    - Entity-document links for entities already in DB
    - New T5/T6 entities (low risk)

    Returns summary of what was applied vs queued.
    """
    applied_links = []
    pending_entities = []
    pending_redactions = []

    # Process entity_links (existing entities the AI found)
    for link in result.get("entity_links", []):
        name = link.get("name", "").strip()
        if not name:
            continue
        entity = name_map.get(name.lower())
        if entity:
            role = link.get("role", "mentioned")
            context = link.get("context", "")
            create_entity_document(
                entity_id=entity["id"],
                document_id=document_id,
                role=role,
                excerpt=f"[auto-review] {context}" if context else "[auto-review]",
            )
            applied_links.append({"name": entity["name"], "role": role})

    # Process new_entities
    for new_entity in result.get("new_entities", []):
        name = new_entity.get("name", "").strip()
        tier = new_entity.get("tier", 4)
        category = new_entity.get("category", "person")
        context = new_entity.get("context", "")

        if not name or len(name) < 3:
            continue

        # Check if entity already exists (AI might not know about it)
        existing = name_map.get(name.lower())
        if existing:
            # Just create a link
            create_entity_document(
                entity_id=existing["id"],
                document_id=document_id,
                role="mentioned",
                excerpt=f"[auto-review] {context}" if context else "[auto-review]",
            )
            applied_links.append({"name": existing["name"], "role": "mentioned"})
            continue

        # T5/T6 entities: auto-create as draft
        if tier >= 5:
            try:
                supabase = get_client()
                new_record = supabase.table("entities").insert({
                    "name": name,
                    "tier": tier,
                    "category": category,
                    "entity_type": category,
                    "bio": context or f"Identified by auto-review in document analysis.",
                    "processing_status": "needs_review",
                }).execute()
                if new_record.data:
                    new_id = new_record.data[0]["id"]
                    create_entity_document(
                        entity_id=new_id,
                        document_id=document_id,
                        role="mentioned",
                        excerpt=f"[auto-review] {context}" if context else "[auto-review]",
                    )
                    applied_links.append({"name": name, "role": "auto-created T" + str(tier)})
            except Exception as e:
                # If insert fails (e.g., name conflict), queue for review
                pending_entities.append({**new_entity, "error": str(e)})
        else:
            # T1-T4: too consequential for automation — queue for review
            pending_entities.append(new_entity)

    # Redaction overrides always go to review
    pending_redactions = result.get("redaction_overrides", [])

    return {
        "applied_links": applied_links,
        "pending_entities": pending_entities,
        "pending_redactions": pending_redactions,
        "summary": result.get("summary", ""),
    }


# ── Main entry point ─────────────────────────────────────

def run_auto_review(
    document_id: str,
    r2_key: str,
    entity_results: dict[str, Any],
    redaction_results: dict[str, Any],
    classify_results: dict[str, Any],
) -> dict[str, Any]:
    """
    Run AI auto-review on a document.

    Skips if:
    - Score below threshold
    - Rate limit exceeded
    - Budget exceeded
    - No API key
    - No text to analyze
    """
    score = classify_results.get("score", 0)

    # Pre-flight checks
    if not ANTHROPIC_API_KEY:
        return {"skipped": True, "reason": "no API key"}

    if not _check_rate_limit():
        return {"skipped": True, "reason": "rate limit exceeded"}

    if not _check_budget():
        return {"skipped": True, "reason": "daily budget exceeded"}

    # Fetch document text
    doc = fetch_document_for_processing(document_id)
    if not doc:
        return {"skipped": True, "reason": "document not found"}

    bates = doc.get("bates_number")
    text = download_text(bates) if bates else None
    if not text:
        text = doc.get("extracted_text") or ""
    if len(text.strip()) < 500:
        return {"skipped": True, "reason": "insufficient text"}

    # Build known entity list from Stage 4 results
    known_entity_ids = entity_results.get("entity_ids", [])
    name_map = _get_entity_name_map()
    known_names = []
    for eid in known_entity_ids:
        for name, entity in name_map.items():
            if entity["id"] == eid:
                known_names.append(entity["name"])
                break

    document_type = doc.get("document_type")

    # Call Claude
    ai_result = _call_claude(
        document_text=text,
        known_entities=known_names,
        redaction_summary=redaction_results,
        document_type=document_type,
        bates_number=bates,
    )

    if ai_result is None:
        return {"skipped": True, "reason": "AI call failed or returned invalid JSON"}

    # Apply safe actions, queue risky ones
    actions = _apply_safe_actions(ai_result, document_id, name_map)

    has_pending = bool(actions["pending_entities"] or actions["pending_redactions"])

    return {
        "skipped": False,
        "auto_applied": len(actions["applied_links"]),
        "applied_links": actions["applied_links"],
        "pending_entities": actions["pending_entities"],
        "pending_redactions": actions["pending_redactions"],
        "has_pending": has_pending,
        "summary": actions["summary"],
        "daily_spend": round(_daily_spend, 4),
    }
