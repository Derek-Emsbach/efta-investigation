#!/usr/bin/env python3
"""
EFTA01266403 Deep Read — Jeffrey E. Epstein 2014 Trust (24 pages)
Extracts full text via MCP corpus tools and runs related searches.
Run: python3 scripts/mcp_deep_read_01266403.py
"""

import json
import os
import sys
import urllib.request

MCP_URL = "http://localhost:3001/mcp"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}
_call_id = 0

EFTA_NUMBER = "EFTA01266403"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "investigation")


def mcp_call(tool: str, args: dict, timeout: int = 30) -> dict:
    """Call an MCP tool and return parsed result."""
    global _call_id
    _call_id += 1
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": _call_id,
        "method": "tools/call",
        "params": {"name": tool, "arguments": args},
    })
    req = urllib.request.Request(MCP_URL, data=payload.encode(), headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode()
    except Exception as e:
        return {"error": str(e)}

    for line in reversed(body.strip().split("\n")):
        if line.startswith("data:"):
            try:
                rpc = json.loads(line[5:].strip())
                if "result" in rpc and "content" in rpc["result"]:
                    text = rpc["result"]["content"][0].get("text", "")
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        if text.startswith("{"):
                            brace = 0
                            for i, c in enumerate(text):
                                if c == "{": brace += 1
                                elif c == "}": brace -= 1
                                if brace == 0:
                                    try:
                                        return json.loads(text[: i + 1])
                                    except json.JSONDecodeError:
                                        pass
                                    break
                        return {"raw_text": text}
                return rpc
            except json.JSONDecodeError:
                continue
    return {"error": "No valid SSE response", "body": body[:500]}


def mcp_call_raw(tool: str, args: dict, timeout: int = 60) -> str:
    """Call an MCP tool and return raw text content (for corpus reads)."""
    global _call_id
    _call_id += 1
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": _call_id,
        "method": "tools/call",
        "params": {"name": tool, "arguments": args},
    })
    req = urllib.request.Request(MCP_URL, data=payload.encode(), headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode()
    except Exception as e:
        return f"[ERROR: {e}]"

    for line in reversed(body.strip().split("\n")):
        if line.startswith("data:"):
            try:
                rpc = json.loads(line[5:].strip())
                if "result" in rpc and "content" in rpc["result"]:
                    return rpc["result"]["content"][0].get("text", "")
            except json.JSONDecodeError:
                continue
    return "[ERROR: No valid SSE response]"


# ── Phase 1: Extract full text ────────────────────────────────────────

def phase1_extract():
    """Read all 24 pages in 7-page chunks."""
    print("=" * 70)
    print(f"PHASE 1: Extracting full text of {EFTA_NUMBER} (24 pages)")
    print("=" * 70)

    chunks = [
        (0, 6),    # pages 0-6
        (7, 13),   # pages 7-13
        (14, 20),  # pages 14-20
        (21, 23),  # pages 21-23
    ]

    all_text = []
    total_chars = 0

    for i, (start, end) in enumerate(chunks):
        print(f"\n  Call {i+1}/4: Pages {start}-{end}...", end=" ", flush=True)
        raw = mcp_call_raw("corpus_get_document_text", {
            "efta_number": EFTA_NUMBER,
            "start_page": start,
            "end_page": end,
        }, timeout=60)

        # Check for truncation
        truncated = "[TRUNCATION_INFO:" in raw
        if truncated:
            print("⚠ TRUNCATED!", end=" ")

        # Extract text after the JSON header line
        # Format: {json_header}\n\n{actual_text}
        parts = raw.split("\n\n", 1)
        if len(parts) == 2:
            header_str = parts[0]
            text = parts[1]
            try:
                header = json.loads(header_str)
                chars = header.get("total_chars", header.get("char_count", len(text)))
                pages_returned = header.get("pages_returned", end - start + 1)
                print(f"{pages_returned} pages, {chars:,} chars", end="")
            except json.JSONDecodeError:
                text = raw
                chars = len(text)
                print(f"{chars:,} chars (no header)", end="")
        else:
            text = raw
            chars = len(text)
            print(f"{chars:,} chars (no header)", end="")

        all_text.append(text)
        total_chars += chars
        print(" ✓")

    # Combine and save
    full_text = "\n\n--- PAGE BREAK ---\n\n".join(all_text)
    output_path = os.path.join(OUTPUT_DIR, f"{EFTA_NUMBER}_raw_text.txt")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(full_text)

    print(f"\n  Total: {total_chars:,} chars across 24 pages")
    print(f"  Saved: {output_path}")

    return full_text


# ── Phase 2: Corpus searches ─────────────────────────────────────────

def phase2_searches():
    """Search for related trust documents in the corpus."""
    print("\n" + "=" * 70)
    print("PHASE 2: Corpus searches for related documents")
    print("=" * 70)

    searches = [
        ("\"Epstein 2014 Trust\"", "Other references to this trust"),
        ("\"David Mitchell\" trustee", "Identify the third trustee"),
        ("Indyke Staley Mitchell", "Co-occurrence of all three trustees"),
        ("\"Financial Trust Company\"", "Institutional trustee"),
        ("\"Amendment and Restatement\" Epstein", "Find original trust version"),
        ("Staley resign trustee", "Staley resignation from trust"),
        ("\"Butterfly Trust\" OR \"1953 Trust\"", "Other known Epstein trusts"),
    ]

    all_results = {}

    for i, (query, purpose) in enumerate(searches):
        print(f"\n  Search {i+1}/7: {query}")
        print(f"  Purpose: {purpose}")
        result = mcp_call("corpus_search", {"query": query, "limit": 20})

        if result.get("error"):
            print(f"  ✗ Error: {result['error']}")
            all_results[query] = {"error": result["error"]}
            continue

        count = result.get("count", 0)
        data = result.get("data", [])
        print(f"  → {count} results")

        # Show top 5 results
        for j, hit in enumerate(data[:5]):
            efta = hit.get("efta_number", "?")
            page = hit.get("page_number", "?")
            snippet = hit.get("snippet", "")[:80]
            print(f"    [{j+1}] {efta} p{page}: {snippet}...")

        all_results[query] = {"count": count, "data": data}

    # Save search results
    output_path = os.path.join(OUTPUT_DIR, f"{EFTA_NUMBER}_search_results.json")
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n  Saved search results: {output_path}")

    return all_results


# ── Main ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nEFTA01266403 Deep Read — Jeffrey E. Epstein 2014 Trust")
    print(f"{'─' * 55}\n")

    # Phase 1: Extract full text
    full_text = phase1_extract()

    # Phase 2: Corpus searches
    search_results = phase2_searches()

    print("\n" + "=" * 70)
    print("DONE — Raw text and search results saved.")
    print("Next: Analyze text and write EFTA01266403_Analysis.md")
    print("=" * 70)
