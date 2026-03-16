"""SQLite corpus reader for the ML pipeline.

Connects to the rhowardstone EFTA corpus databases (read-only) to access
full document text, concordance metadata, redaction analysis, and image
descriptions across 1.38M documents / 2.77M pages.
"""

import os
import sqlite3
from pathlib import Path
from typing import Any

from config import SUPABASE_URL  # Just to trigger .env loading

# Default corpus path — relative to the MCP server data directory
CORPUS_DIR = Path(os.environ.get(
    "CORPUS_DATA_DIR",
    str(Path(__file__).parent.parent / "efta-mcp-server" / "data"),
))

_connections: dict[str, sqlite3.Connection] = {}


def _get_db(name: str) -> sqlite3.Connection | None:
    """Get or open a read-only SQLite connection."""
    if name in _connections:
        return _connections[name]

    db_path = CORPUS_DIR / name
    if not db_path.exists():
        return None

    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    _connections[name] = conn
    return conn


def get_corpus_db() -> sqlite3.Connection | None:
    return _get_db("full_text_corpus.db")


def get_concordance_db() -> sqlite3.Connection | None:
    return _get_db("concordance_complete.db")


def get_redaction_db() -> sqlite3.Connection | None:
    return _get_db("redaction_analysis_v2.db")


def get_image_db() -> sqlite3.Connection | None:
    return _get_db("image_analysis.db")


# ─────────────────────────────────────────────────
# Full-text search
# ─────────────────────────────────────────────────

def corpus_search(query: str, limit: int = 50, dataset: int | None = None) -> list[dict]:
    """FTS5 search across all pages. Returns efta_number, page_number, snippet."""
    db = get_corpus_db()
    if not db:
        return []

    sql = """
        SELECT p.efta_number, p.page_number,
               snippet(pages_fts, 0, '>>>', '<<<', '...', 40) AS snippet
        FROM pages_fts
        JOIN pages p ON p.rowid = pages_fts.rowid
    """
    params: list[Any] = []

    if dataset:
        sql += " JOIN documents d ON d.efta_number = p.efta_number WHERE pages_fts MATCH ? AND d.dataset = ?"
        params = [query, dataset]
    else:
        sql += " WHERE pages_fts MATCH ?"
        params = [query]

    sql += " ORDER BY rank LIMIT ?"
    params.append(limit)

    try:
        rows = db.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []


def get_document_text(efta_number: str) -> str | None:
    """Get full concatenated text for a document."""
    db = get_corpus_db()
    if not db:
        return None

    rows = db.execute(
        "SELECT text_content FROM pages WHERE efta_number = ? ORDER BY page_number",
        [efta_number],
    ).fetchall()

    if not rows:
        return None

    return "\n\n".join(r["text_content"] for r in rows if r["text_content"])


def get_page_text(efta_number: str, page_number: int) -> str | None:
    """Get text for a specific page."""
    db = get_corpus_db()
    if not db:
        return None

    row = db.execute(
        "SELECT text_content FROM pages WHERE efta_number = ? AND page_number = ?",
        [efta_number, page_number],
    ).fetchone()

    return row["text_content"] if row else None


def count_entity_mentions(name: str, aliases: list[str] | None = None) -> int:
    """Count total pages mentioning an entity name or aliases."""
    db = get_corpus_db()
    if not db:
        return 0

    names = [name] + (aliases or [])
    # Build FTS5 OR query
    fts_query = " OR ".join(f'"{n}"' for n in names if n)

    try:
        row = db.execute(
            "SELECT COUNT(*) as cnt FROM pages_fts WHERE pages_fts MATCH ?",
            [fts_query],
        ).fetchone()
        return row["cnt"] if row else 0
    except Exception:
        return 0


def find_entity_documents(name: str, aliases: list[str] | None = None,
                          limit: int = 5000) -> list[dict]:
    """Find all documents mentioning an entity. Returns efta_number + page count."""
    db = get_corpus_db()
    if not db:
        return []

    names = [name] + (aliases or [])
    fts_query = " OR ".join(f'"{n}"' for n in names if n)

    try:
        rows = db.execute("""
            SELECT p.efta_number, COUNT(DISTINCT p.page_number) as page_count
            FROM pages_fts
            JOIN pages p ON p.rowid = pages_fts.rowid
            WHERE pages_fts MATCH ?
            GROUP BY p.efta_number
            ORDER BY page_count DESC
            LIMIT ?
        """, [fts_query, limit]).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []


# ─────────────────────────────────────────────────
# Concordance (DOJ production metadata)
# ─────────────────────────────────────────────────

def get_concordance(efta_number: str) -> dict | None:
    """Get DOJ concordance metadata for a document."""
    db = get_concordance_db()
    if not db:
        return None

    row = db.execute(
        "SELECT * FROM documents WHERE efta_number = ?",
        [efta_number],
    ).fetchone()

    return dict(row) if row else None


# ─────────────────────────────────────────────────
# Proximity search (for context extraction)
# ─────────────────────────────────────────────────

def find_co_occurrence_excerpts(
    efta_number: str,
    name_a: str,
    name_b: str,
    window: int = 500,
) -> list[dict]:
    """Find passages where two names appear within `window` chars of each other."""
    import re

    text = get_document_text(efta_number)
    if not text:
        return []

    excerpts = []
    positions_a = [m.start() for m in re.finditer(re.escape(name_a), text, re.IGNORECASE)]
    positions_b = [m.start() for m in re.finditer(re.escape(name_b), text, re.IGNORECASE)]

    for pa in positions_a:
        for pb in positions_b:
            distance = abs(pa - pb)
            if distance <= window and distance > 0:
                ctx_start = max(0, min(pa, pb) - 100)
                ctx_end = min(len(text), max(pa, pb) + len(name_b) + 100)
                excerpts.append({
                    "excerpt": text[ctx_start:ctx_end].strip(),
                    "distance": distance,
                })

    # Deduplicate by position bucket
    seen = set()
    unique = []
    for exc in sorted(excerpts, key=lambda x: x["distance"]):
        bucket = exc["distance"] // 200
        if bucket not in seen:
            seen.add(bucket)
            unique.append(exc)
        if len(unique) >= 5:
            break

    return unique
