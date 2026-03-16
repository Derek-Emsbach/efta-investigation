"""Automated entity sweep — scans the corpus to find gaps in entity coverage.

Three sweep modes:
1. Coverage audit — for each entity, compare corpus mentions vs entity_documents links
2. New entity discovery — find frequently occurring names not in the entity database
3. Co-occurrence context — fill in missing context excerpts for connection suggestions
"""

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

sys.path.insert(0, str(Path(__file__).parent))
import db
import corpus

console = Console()


def coverage_audit(min_tier: int = 4, top_n: int = 50) -> list[dict]:
    """Compare corpus mentions vs linked documents for each entity.

    Finds entities with large gaps between corpus presence and DB links.
    Returns sorted list of {entity, corpus_pages, linked_docs, gap_ratio}.
    """
    console.print("[bold]Running entity coverage audit...[/]\n")

    entities = db.get_all_entities()
    high_tier = [e for e in entities if (e.get("tier") or 6) <= min_tier]
    console.print(f"  Auditing {len(high_tier)} entities (tier <= {min_tier})")

    if not corpus.get_corpus_db():
        console.print("[red]  Corpus database not found![/]")
        return []

    results = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Auditing", total=len(high_tier))

        for entity in high_tier:
            progress.update(task, advance=1)

            name = entity["name"]
            aliases = entity.get("aliases") or []

            # Count corpus mentions
            corpus_pages = corpus.count_entity_mentions(name, aliases)

            # Count linked documents
            linked_count = db.get_entity_documents_count(entity["id"])

            gap = corpus_pages - linked_count
            gap_ratio = gap / max(corpus_pages, 1)

            results.append({
                "entity_id": entity["id"],
                "name": name,
                "tier": entity.get("tier") or 6,
                "corpus_pages": corpus_pages,
                "linked_docs": linked_count,
                "gap": gap,
                "gap_ratio": gap_ratio,
            })

    # Sort by gap descending
    results.sort(key=lambda x: x["gap"], reverse=True)

    # Display results
    table = Table(title=f"Entity Coverage Audit (top {top_n})")
    table.add_column("Entity", style="bold")
    table.add_column("Tier", justify="center")
    table.add_column("Corpus Pages", justify="right")
    table.add_column("Linked Docs", justify="right")
    table.add_column("Gap", justify="right")
    table.add_column("Coverage", justify="right")

    for r in results[:top_n]:
        coverage_pct = f"{(1 - r['gap_ratio']) * 100:.0f}%"
        gap_color = "red" if r["gap_ratio"] > 0.5 else "yellow" if r["gap_ratio"] > 0.2 else "green"
        table.add_row(
            r["name"],
            str(r["tier"]),
            f"{r['corpus_pages']:,}",
            f"{r['linked_docs']:,}",
            f"[{gap_color}]{r['gap']:,}[/]",
            f"[{gap_color}]{coverage_pct}[/]",
        )

    console.print(table)
    return results


def discover_frequent_names(min_mentions: int = 50, limit: int = 100) -> list[dict]:
    """Find names that appear frequently in the corpus but aren't tracked entities.

    Three discovery strategies:
    1. Concordance — custodians and email participants from DOJ production metadata
    2. Corpus FTS — names co-occurring with known entities in document text
    3. Suspect watchlist cross-check — names in watchlist that also appear in corpus
    """
    console.print("[bold]Discovering frequent untracked names...[/]\n")

    # Get all existing entity names + aliases for exclusion
    entities = db.get_all_entities()
    known_names: set[str] = set()
    for e in entities:
        known_names.add(e["name"].lower())
        for alias in (e.get("aliases") or []):
            if alias:
                known_names.add(alias.lower())

    console.print(f"  Known entity names/aliases: {len(known_names)}")

    name_counts: Counter = Counter()
    name_sources: dict[str, set[str]] = defaultdict(set)

    # Strategy 1: Concordance — custodians and email senders/recipients
    conc_db = corpus.get_concordance_db()
    if conc_db:
        console.print("  [cyan]Strategy 1:[/] Scanning concordance custodians & email participants...")

        # Custodians
        try:
            rows = conc_db.execute(
                "SELECT custodian, COUNT(*) as cnt FROM documents WHERE custodian IS NOT NULL AND custodian != '' GROUP BY custodian ORDER BY cnt DESC LIMIT 200"
            ).fetchall()
            for r in rows:
                name = r["custodian"].strip()
                if name.lower() not in known_names and len(name) > 3 and not name.startswith("EFTA"):
                    name_counts[name] += r["cnt"]
                    name_sources[name].add("custodian")
        except Exception as e:
            console.print(f"    [yellow]Custodian query failed: {e}[/]")

        # Email senders
        try:
            rows = conc_db.execute(
                "SELECT author, COUNT(*) as cnt FROM documents WHERE author IS NOT NULL AND author != '' GROUP BY author ORDER BY cnt DESC LIMIT 200"
            ).fetchall()
            for r in rows:
                name = r["author"].strip()
                if name.lower() not in known_names and len(name) > 3 and "@" not in name:
                    name_counts[name] += r["cnt"]
                    name_sources[name].add("author")
        except Exception as e:
            console.print(f"    [yellow]Author query failed: {e}[/]")

        console.print(f"    Found {len(name_counts)} unique names from concordance")
    else:
        console.print("  [yellow]Concordance database not found, skipping Strategy 1[/]")

    # Strategy 2: Corpus FTS — names near known entities in high-value docs
    corpus_db = corpus.get_corpus_db()
    if corpus_db:
        console.print("  [cyan]Strategy 2:[/] Scanning corpus for names near known entities...")
        name_pattern = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]{2,})\b')

        # Search for names co-occurring with top entities in prosecution/legal docs
        search_terms = [
            '"prosecution memo"', '"FBI 302"', '"grand jury"',
            '"plea agreement"', '"cooperating witness"',
            '"wire transfer" AND "Epstein"',
            '"Little St. James"', '"Zorro Ranch"',
            '"victim" AND "massage"',
            '"non-prosecution agreement"',
        ]

        for term in search_terms:
            results = corpus.corpus_search(term, limit=100)
            for r in results:
                snippet = r.get("snippet", "")
                names = name_pattern.findall(snippet)
                for name in names:
                    if name.lower() not in known_names and len(name) > 5:
                        name_counts[name] += 1
                        name_sources[name].add("corpus_fts")

        console.print(f"    Total unique names after FTS: {len(name_counts)}")

    # Strategy 3: Cross-check suspect watchlist
    supabase = db.get_client()
    try:
        suspects = supabase.table("suspect_watchlist").select("name, priority, notes").execute()
        if suspects.data:
            console.print(f"  [cyan]Strategy 3:[/] Cross-checking {len(suspects.data)} watchlist entries...")
            for s in suspects.data:
                sname = s["name"]
                if sname.lower() not in known_names:
                    # Check corpus presence
                    mentions = corpus.count_entity_mentions(sname) if corpus_db else 0
                    if mentions > 0:
                        name_counts[sname] += mentions
                        name_sources[sname].add(f"watchlist_P{s.get('priority', '?')}")
    except Exception:
        pass  # suspect_watchlist may not exist

    # Filter, sort, and display
    frequent = []
    for name, count in name_counts.most_common(limit):
        if count >= min_mentions:
            frequent.append({
                "name": name,
                "mention_count": count,
                "sources": sorted(name_sources.get(name, set())),
            })

    if frequent:
        table = Table(title=f"Frequent Untracked Names (>= {min_mentions} mentions)")
        table.add_column("Name", style="bold")
        table.add_column("Mentions", justify="right")
        table.add_column("Sources")
        for f in frequent[:40]:
            table.add_row(f["name"], f"{f['mention_count']:,}", ", ".join(f["sources"]))
        console.print(table)
    else:
        console.print(f"  No names found with >= {min_mentions} mentions")

    return frequent


def enrich_connection_contexts(max_pairs: int = 50) -> int:
    """Fill in missing context excerpts for connection suggestions using corpus text.

    For suggestions with empty context_excerpts, search the corpus for
    co-occurrence passages.
    """
    console.print("[bold]Enriching connection suggestion contexts from corpus...[/]\n")

    if not corpus.get_corpus_db():
        console.print("[red]  Corpus database not found![/]")
        return 0

    client = db.get_client()

    # Get suggestions missing context
    result = client.table("ml_connection_suggestions").select(
        "id, entity_a, entity_b, shared_document_ids, context_excerpts"
    ).eq("status", "pending").order("confidence", desc=True).limit(max_pairs).execute()

    suggestions = result.data or []
    needs_context = [s for s in suggestions if not s.get("context_excerpts")]
    console.print(f"  Suggestions needing context: {len(needs_context)}/{len(suggestions)}")

    if not needs_context:
        return 0

    # Load entity names
    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}

    # For each suggestion, look up shared docs in Supabase to get bates numbers,
    # then search corpus for co-occurrence excerpts
    enriched = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total}"),
        console=console,
    ) as progress:
        task = progress.add_task("Enriching", total=len(needs_context))

        for suggestion in needs_context:
            progress.update(task, advance=1)

            ea = entity_map.get(suggestion["entity_a"])
            eb = entity_map.get(suggestion["entity_b"])
            if not ea or not eb:
                continue

            # Get bates numbers for shared docs (batch to avoid URL-too-long)
            doc_ids = (suggestion.get("shared_document_ids") or [])[:20]
            if not doc_ids:
                continue

            docs = []
            for i in range(0, len(doc_ids), 200):
                docs.extend(db.get_documents_by_ids(doc_ids[i:i + 200]))

            # Search corpus for co-occurrences
            all_excerpts = []
            for doc in docs[:10]:  # Cap at 10 docs
                bates = doc.get("bates_number")
                if not bates:
                    continue

                excerpts = corpus.find_co_occurrence_excerpts(
                    bates, ea["name"], eb["name"]
                )
                for exc in excerpts:
                    exc["document_id"] = doc["id"]
                    exc["document_type"] = doc.get("document_type")
                    all_excerpts.append(exc)

                # Also try aliases
                for alias_a in (ea.get("aliases") or [])[:2]:
                    if alias_a and alias_a != ea["name"]:
                        excerpts = corpus.find_co_occurrence_excerpts(
                            bates, alias_a, eb["name"]
                        )
                        for exc in excerpts:
                            exc["document_id"] = doc["id"]
                            all_excerpts.append(exc)

            if all_excerpts:
                # Sort by distance, keep best 5
                all_excerpts.sort(key=lambda x: x["distance"])
                best = all_excerpts[:5]

                # Compute context quality score
                min_dist = min(e["distance"] for e in best)
                if min_dist < 100:
                    ctx_quality = 100
                elif min_dist < 300:
                    ctx_quality = 70
                elif min_dist < 500:
                    ctx_quality = 40
                else:
                    ctx_quality = 10

                # Update suggestion in database
                client.table("ml_connection_suggestions").update({
                    "context_excerpts": [
                        {"excerpt": e["excerpt"][:500], "distance": e["distance"],
                         "document_id": e.get("document_id")}
                        for e in best
                    ],
                    "score_components": {
                        **(suggestion.get("score_components") or {}),
                        "context_quality": ctx_quality,
                    },
                }).eq("id", suggestion["id"]).execute()

                enriched += 1
                name_a = ea["name"]
                name_b = eb["name"]
                console.print(f"    {name_a} ↔ {name_b}: {len(best)} excerpts (min dist: {min_dist})")

    console.print(f"\n  Enriched {enriched}/{len(needs_context)} suggestions with context")
    return enriched
