#!/usr/bin/env python3
"""
EFTA01266380 + EFTA01266427 Deep Read
Original Epstein 2014 Trust + First Amendment to the Amendment and Restatement.
Run: python3 scripts/mcp_deep_read_01266380.py
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
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "investigation")


def mcp_call(tool: str, args: dict, timeout: int = 30) -> dict:
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


def extract_document(efta_number: str, max_page: int = 30) -> str:
    """Read a document in 7-page chunks, return full text."""
    print(f"\n  Reading {efta_number}...")
    all_text = []
    total_chars = 0
    page = 0

    while page <= max_page:
        end = min(page + 6, max_page)
        print(f"    Pages {page}-{end}...", end=" ", flush=True)
        raw = mcp_call_raw("corpus_get_document_text", {
            "efta_number": efta_number,
            "start_page": page,
            "end_page": end,
        }, timeout=60)

        if "[ERROR:" in raw:
            print(f"ERROR: {raw[:80]}")
            break

        truncated = "[TRUNCATION_INFO:" in raw

        # Parse header
        parts = raw.split("\n\n", 1)
        if len(parts) == 2:
            try:
                header = json.loads(parts[0])
                text = parts[1]
                pages_returned = header.get("pages_returned", 0)
                chars = header.get("total_chars", header.get("char_count", len(text)))

                if pages_returned == 0:
                    print("(no pages — past end)")
                    break

                print(f"{pages_returned} pages, {chars:,} chars", end="")
                if truncated:
                    print(" ⚠ TRUNCATED", end="")
                print(" ✓")

                all_text.append(text)
                total_chars += chars
            except json.JSONDecodeError:
                text = raw
                all_text.append(text)
                total_chars += len(text)
                print(f"{len(text):,} chars (no header) ✓")
        else:
            # No header separator — might be an error or single-line response
            if "not found" in raw.lower() or "no pages" in raw.lower():
                print("(document not found or no pages)")
                break
            all_text.append(raw)
            total_chars += len(raw)
            print(f"{len(raw):,} chars (raw) ✓")

        page = end + 1

    full_text = "\n\n--- PAGE BREAK ---\n\n".join(all_text)
    print(f"  Total: {total_chars:,} chars")
    return full_text


# ── Main ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("EFTA01266380 + EFTA01266427 Deep Read")
    print("Original Trust + First Amendment to the A&R")
    print("=" * 55)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ── Phase 1: Read EFTA01266380 (Original Trust) ──
    print("\n" + "=" * 70)
    print("PHASE 1: EFTA01266380 — Original Trust (November 2014)")
    print("=" * 70)

    text_380 = extract_document("EFTA01266380")
    path_380 = os.path.join(OUTPUT_DIR, "EFTA01266380_raw_text.txt")
    with open(path_380, "w") as f:
        f.write(text_380)
    print(f"  Saved: {path_380}")

    # ── Phase 2: Read EFTA01266427 (First Amendment) ──
    print("\n" + "=" * 70)
    print("PHASE 2: EFTA01266427 — First Amendment to the A&R")
    print("=" * 70)

    text_427 = extract_document("EFTA01266427")
    path_427 = os.path.join(OUTPUT_DIR, "EFTA01266427_raw_text.txt")
    with open(path_427, "w") as f:
        f.write(text_427)
    print(f"  Saved: {path_427}")

    # ── Phase 3: Quick corpus searches ──
    print("\n" + "=" * 70)
    print("PHASE 3: Corpus searches")
    print("=" * 70)

    searches = [
        ("\"November 18, 2014\" Epstein trust", "Original trust execution date"),
        ("Staley trustee resign remove", "Any Staley trustee changes"),
    ]

    for query, purpose in searches:
        print(f"\n  Search: {query}")
        print(f"  Purpose: {purpose}")
        result = mcp_call("corpus_search", {"query": query, "limit": 10})
        count = result.get("count", 0)
        data = result.get("data", [])
        print(f"  → {count} results")
        for j, hit in enumerate(data[:3]):
            efta = hit.get("efta_number", "?")
            page = hit.get("page_number", "?")
            snippet = hit.get("snippet", "")[:80]
            print(f"    [{j+1}] {efta} p{page}: {snippet}...")

    print("\n" + "=" * 70)
    print("DONE — Raw text saved for both documents.")
    print("Next: Analyze and write comparison report.")
    print("=" * 70)
