"""Detect timeline-related anomalies.

Three anomaly types:
1. Activity gaps — T1-3 entities with >2 year gaps in event timeline
2. Sudden appearance/disappearance — change-point detection on entity mention frequency
3. Event clustering — flag when unrelated entities cluster in same 7-day window
"""

import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
import db

console = Console()


def _parse_date(date_str: str | None) -> datetime | None:
    """Parse a date string, returning None on failure."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(date_str.split("+")[0].split("Z")[0], fmt.replace("%z", ""))
        except ValueError:
            continue
    return None


def detect_activity_gaps() -> list[dict]:
    """Find T1-3 entities with >2 year gaps in their event timeline."""
    console.print("  Checking entity activity gaps...")

    entities = db.get_all_entities()
    high_tier = [e for e in entities if (e.get("tier") or 6) <= 3]

    anomalies = []

    for entity in high_tier:
        events_data = db.get_events_for_entity(entity["id"])
        if not events_data:
            continue

        # Extract and sort dates
        dates = []
        for ed in events_data:
            event = ed.get("events")
            if not event:
                continue
            dt = _parse_date(event.get("date"))
            if dt:
                dates.append((dt, event))

        dates.sort(key=lambda x: x[0])

        if len(dates) < 2:
            continue

        # Find gaps > 2 years
        for i in range(len(dates) - 1):
            gap = (dates[i + 1][0] - dates[i][0]).days
            if gap > 730:  # ~2 years
                gap_years = gap / 365.25
                tier = entity.get("tier") or 6
                severity = "critical" if tier <= 1 else "high" if tier <= 2 else "medium"

                anomalies.append({
                    "anomaly_type": "timeline_activity_gap",
                    "severity": severity,
                    "score": min(100, gap_years * 20),
                    "title": f"{entity['name']}: {gap_years:.1f}-year activity gap ({dates[i][0].strftime('%Y-%m')} to {dates[i+1][0].strftime('%Y-%m')})",
                    "description": (
                        f"Tier {tier} entity '{entity['name']}' has a {gap_years:.1f}-year gap "
                        f"in their event timeline between {dates[i][0].strftime('%B %Y')} and "
                        f"{dates[i+1][0].strftime('%B %Y')}. The events before and after the gap are: "
                        f"'{dates[i][1].get('title', 'Unknown')}' → '{dates[i+1][1].get('title', 'Unknown')}'. "
                        f"This gap may indicate missing records or undisclosed activity."
                    ),
                    "entity_ids": [entity["id"]],
                    "document_ids": [],
                    "evidence": {
                        "gap_days": gap,
                        "gap_years": gap_years,
                        "before_event": dates[i][1].get("title"),
                        "before_date": dates[i][0].isoformat(),
                        "after_event": dates[i + 1][1].get("title"),
                        "after_date": dates[i + 1][0].isoformat(),
                    },
                })

    console.print(f"    Found {len(anomalies)} activity gap anomalies")
    return anomalies


def detect_mention_frequency_shifts() -> list[dict]:
    """Detect sudden changes in entity mention frequency over time.

    Uses a simple rolling window comparison: if a 6-month window has >3x
    the mentions of adjacent windows, flag it as a spike or drop.
    """
    console.print("  Checking mention frequency shifts...")

    client = db.get_client()

    # Step 1: Get entity_documents links (paginate, no join)
    ed_rows: list[dict] = []
    offset = 0
    page_size = 1000
    while True:
        result = client.table("entity_documents").select(
            "entity_id, document_id"
        ).range(offset, offset + page_size - 1).execute()
        rows = result.data or []
        ed_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    console.print(f"    Loaded {len(ed_rows)} entity-document links")

    # Step 2: Get document dates in batches
    unique_doc_ids = list(set(r["document_id"] for r in ed_rows))
    doc_dates: dict[str, str | None] = {}
    for i in range(0, len(unique_doc_ids), 200):
        batch = unique_doc_ids[i:i + 200]
        dr = client.table("documents").select(
            "id, original_date"
        ).in_("id", batch).not_.is_("original_date", "null").execute()
        for d in (dr.data or []):
            doc_dates[d["id"]] = d.get("original_date")

    console.print(f"    {len(doc_dates)} documents have dates")

    # Group mentions by entity and 6-month bucket
    entity_buckets: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in ed_rows:
        date_str = doc_dates.get(row["document_id"])
        if not date_str:
            continue
        dt = _parse_date(date_str)
        if not dt:
            continue
        bucket = f"{dt.year}-{'H1' if dt.month <= 6 else 'H2'}"
        entity_buckets[row["entity_id"]][bucket] = entity_buckets[row["entity_id"]][bucket] + 1

    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}

    anomalies = []

    for entity_id, buckets in entity_buckets.items():
        if len(buckets) < 3:
            continue

        entity = entity_map.get(entity_id)
        if not entity:
            continue

        sorted_buckets = sorted(buckets.items())
        counts = [c for _, c in sorted_buckets]

        # Check for spikes: window > 3x mean of neighbors
        for i in range(1, len(counts) - 1):
            neighbor_mean = (counts[i - 1] + counts[i + 1]) / 2
            if neighbor_mean > 0 and counts[i] > 3 * neighbor_mean and counts[i] >= 10:
                bucket_label = sorted_buckets[i][0]
                tier = entity.get("tier") or 6
                severity = "high" if tier <= 2 else "medium"
                ratio = counts[i] / neighbor_mean

                anomalies.append({
                    "anomaly_type": "mention_frequency_spike",
                    "severity": severity,
                    "score": min(100, ratio * 15),
                    "title": f"{entity['name']}: mention spike in {bucket_label} ({counts[i]} vs avg {neighbor_mean:.0f})",
                    "description": (
                        f"Entity '{entity['name']}' has {counts[i]} document mentions in {bucket_label}, "
                        f"which is {ratio:.1f}x the average of adjacent periods "
                        f"({counts[i-1]} and {counts[i+1]}). This sudden spike may indicate "
                        f"a significant event or selective document release."
                    ),
                    "entity_ids": [entity_id],
                    "document_ids": [],
                    "evidence": {
                        "bucket": bucket_label,
                        "count": counts[i],
                        "prev_count": counts[i - 1],
                        "next_count": counts[i + 1],
                        "ratio": ratio,
                    },
                })

            # Check for drops: window < 1/3 mean of neighbors
            if counts[i] > 0 and neighbor_mean > 3 * counts[i] and neighbor_mean >= 10:
                bucket_label = sorted_buckets[i][0]
                tier = entity.get("tier") or 6
                if tier > 3:
                    continue
                severity = "high" if tier <= 2 else "medium"
                ratio = neighbor_mean / counts[i]

                anomalies.append({
                    "anomaly_type": "mention_frequency_drop",
                    "severity": severity,
                    "score": min(100, ratio * 15),
                    "title": f"{entity['name']}: mention drop in {bucket_label} ({counts[i]} vs avg {neighbor_mean:.0f})",
                    "description": (
                        f"Entity '{entity['name']}' has only {counts[i]} document mentions in {bucket_label}, "
                        f"which is {ratio:.1f}x below the average of adjacent periods "
                        f"({counts[i-1]} and {counts[i+1]}). This sudden drop may indicate "
                        f"document suppression or redaction."
                    ),
                    "entity_ids": [entity_id],
                    "document_ids": [],
                    "evidence": {
                        "bucket": bucket_label,
                        "count": counts[i],
                        "prev_count": counts[i - 1],
                        "next_count": counts[i + 1],
                        "ratio": ratio,
                    },
                })

    console.print(f"    Found {len(anomalies)} mention frequency anomalies")
    return anomalies


def detect_event_clustering() -> list[dict]:
    """Flag when unrelated entities cluster in the same 7-day window.

    Uses a sliding 7-day window over all events. If entities without
    existing connections co-appear in the same window, flag it.
    """
    console.print("  Checking event clustering...")

    client = db.get_client()

    # Get all events with their linked entities
    result = client.table("entity_events").select(
        "entity_id, event_id, events(id, title, date, event_type)"
    ).not_.is_("events.date", "null").execute()

    # Build event→entities and event→date maps
    event_entities: dict[str, set[str]] = defaultdict(set)
    event_dates: dict[str, datetime] = {}
    event_info: dict[str, dict] = {}

    for row in (result.data or []):
        event = row.get("events")
        if not event:
            continue
        dt = _parse_date(event.get("date"))
        if not dt:
            continue
        event_entities[event["id"]].add(row["entity_id"])
        event_dates[event["id"]] = dt
        event_info[event["id"]] = event

    # Get existing connections to know which entity pairs are already linked
    connections = db.get_connections()
    connected_pairs: set[tuple[str, str]] = set()
    for c in connections:
        a, b = c.get("entity_a", ""), c.get("entity_b", "")
        connected_pairs.add((min(a, b), max(a, b)))

    entities = db.get_all_entities()
    entity_map = {e["id"]: e for e in entities}

    # Sort events by date
    sorted_events = sorted(event_dates.items(), key=lambda x: x[1])

    anomalies = []
    seen_clusters: set[str] = set()

    # Sliding window: for each event, find other events within 7 days
    for i, (event_id, event_dt) in enumerate(sorted_events):
        window_events = []
        for j in range(i, len(sorted_events)):
            other_id, other_dt = sorted_events[j]
            if (other_dt - event_dt).days > 7:
                break
            window_events.append(other_id)

        if len(window_events) < 2:
            continue

        # Collect all entities in this window
        window_entities: set[str] = set()
        for eid in window_events:
            window_entities.update(event_entities.get(eid, set()))

        if len(window_entities) < 3:
            continue

        # Check for unconnected pairs in this window
        entity_list = sorted(window_entities)
        unconnected_pairs = []
        for a_idx in range(len(entity_list)):
            for b_idx in range(a_idx + 1, len(entity_list)):
                pair = (min(entity_list[a_idx], entity_list[b_idx]),
                        max(entity_list[a_idx], entity_list[b_idx]))
                if pair not in connected_pairs:
                    unconnected_pairs.append(pair)

        if not unconnected_pairs:
            continue

        # Create a cluster key to avoid duplicates
        cluster_key = f"{event_dt.strftime('%Y-%m-%d')}-{'|'.join(entity_list[:5])}"
        if cluster_key in seen_clusters:
            continue
        seen_clusters.add(cluster_key)

        # Get entity names for the title
        names = [entity_map.get(eid, {}).get("name", "?") for eid in entity_list[:4]]
        name_str = ", ".join(names)
        if len(entity_list) > 4:
            name_str += f" +{len(entity_list) - 4} more"

        window_event_titles = [event_info.get(eid, {}).get("title", "?") for eid in window_events[:5]]

        anomalies.append({
            "anomaly_type": "event_cluster",
            "severity": "medium",
            "score": min(100, len(unconnected_pairs) * 15 + len(window_entities) * 5),
            "title": f"Event cluster ({event_dt.strftime('%Y-%m-%d')}): {len(window_entities)} entities, {len(unconnected_pairs)} unconnected pairs",
            "description": (
                f"{len(window_entities)} entities ({name_str}) appear in events within a 7-day window "
                f"around {event_dt.strftime('%B %d, %Y')}. {len(unconnected_pairs)} entity pairs "
                f"in this cluster have no recorded connection. Events: {'; '.join(window_event_titles)}."
            ),
            "entity_ids": entity_list[:20],
            "document_ids": [],
            "evidence": {
                "window_start": event_dt.isoformat(),
                "window_end": (event_dt + timedelta(days=7)).isoformat(),
                "entity_count": len(window_entities),
                "unconnected_pairs": len(unconnected_pairs),
                "events": window_event_titles,
            },
        })

    # Keep top 30 by score
    anomalies.sort(key=lambda x: x["score"], reverse=True)
    anomalies = anomalies[:30]

    console.print(f"    Found {len(anomalies)} event clustering anomalies")
    return anomalies


def run() -> list[dict]:
    """Run all timeline anomaly detectors."""
    anomalies = []
    for fn in [detect_activity_gaps, detect_mention_frequency_shifts, detect_event_clustering]:
        try:
            anomalies.extend(fn())
        except Exception as e:
            console.print(f"    [yellow]Skipped {fn.__name__}: {e}[/]")
    return anomalies
