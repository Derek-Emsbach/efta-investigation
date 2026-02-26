#!/usr/bin/env python3
"""
EFTA01266380 + EFTA01266427 Database Updates via MCP
Locks original trust + first amendment findings into Supabase.
Run: python3 scripts/mcp_update_01266380.py
"""

import json
import sys
import urllib.request

MCP_URL = "http://localhost:3001/mcp"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}
_call_id = 0


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


passes = 0
fails = 0


def check(label: str, result: dict):
    global passes, fails
    if "error" in result:
        fails += 1
        print(f"  FAIL: {label}")
        print(f"    {result['error'][:120]}")
    else:
        passes += 1
        print(f"  OK: {label}")
    return result


def lookup_entity(name: str) -> dict | None:
    """Lookup entity by name, return {id, name, tier} or None."""
    result = mcp_call("lookup_person", {"name": name})
    if not result.get("success"):
        return None
    data = result.get("data", {})
    entities = data.get("entity_matches", [])
    if entities:
        e = entities[0]
        return {"id": e["id"], "name": e["name"], "tier": e.get("tier"), "type": "entity"}
    suspects = data.get("suspect_matches", [])
    if suspects:
        s = suspects[0]
        return {"id": s["id"], "name": s["name"], "type": "suspect"}
    return None


# ── Phase 1: Lookups ─────────────────────────────────────────────────

print("=" * 70)
print("PHASE 1: Entity Lookups")
print("=" * 70)

entity_ids = {}

lookups = [
    "Jeffrey Epstein",
    "Jes Staley",
    "Darren Indyke",
    "David Mitchell",
    "Eva Andersson-Dubin",
    "Karyna Shuliak",
    "Richard D. Kahn",
    "Lesley Groff",
    "Mark Epstein",
    "Jean Luc Brunel",
    "Lawrence Visoski",
]

for name in lookups:
    print(f"  → {name}...", end=" ", flush=True)
    p = lookup_entity(name)
    if p:
        if p.get("type") == "suspect":
            print(f"⚠ SUSPECT — {p['id'][:12]}... (cannot use for FK links)")
        else:
            actual_name = p.get("name", "?")
            entity_ids[name] = p["id"]
            tier = p.get("tier", "?")
            if actual_name.lower() != name.lower():
                print(f"✓ {p['id'][:12]}... (T{tier}) — fuzzy: '{actual_name}'")
            else:
                print(f"✓ {p['id'][:12]}... (T{tier})")
        passes += 1
    else:
        print("✗ NOT FOUND")
        fails += 1

print(f"\n  Found {len(entity_ids)} entity IDs (usable for FK links)")
for name, eid in entity_ids.items():
    print(f"    {name}: {eid[:12]}...")


# ── Phase 2: Update EFTA01266380 ─────────────────────────────────────

print("\n" + "=" * 70)
print("PHASE 2: Update EFTA01266380 (Original Trust)")
print("=" * 70)

check("update EFTA01266380", mcp_call("update_document", {
    "bates_number": "EFTA01266380",
    "title": "The Jeffrey E. Epstein 2014 Trust",
    "document_type": "trust_document",
    "original_date": "2014-11-18",
    "summary": "Original Epstein 2014 Trust. Grantor: Jeffrey E. Epstein. Trustees: Darren K. Indyke, James E. Staley, David Mitchell ($250K/yr each). 22 bequests totaling ~$52M (7 redacted females at $5M each). Karyna Shuliak: $10M. Indyke: $5M. Jean Luc Brunel: $5M (openly named). Richard Kahn: $2M (later raised to $5M in A&R). Properties held via USVI shell companies (Maple, Nautilus, Cypress, Laurel, SCI JEP). Primary beneficiary redacted (later revealed as Celina Dubin in A&R EFTA01266403). Contingent: Eva Andersson-Dubin. Successor trustees: Eva, Steven Hanson, Joseph Pagano. Schedule A not included. USVI governing law with offshore situs transfer power. Amendment requires all trustees to sign (changed in first amendment).",
    "classification": "high",
}, timeout=30))


# ── Phase 3: Create EFTA01266427 ─────────────────────────────────────

print("\n" + "=" * 70)
print("PHASE 3: Create/Update EFTA01266427 (First Amendment)")
print("=" * 70)

# Try update first — it may already exist from catalog import
r = check("update EFTA01266427", mcp_call("update_document", {
    "bates_number": "EFTA01266427",
    "title": "First Amendment to the Amendment and Restatement of the Jeffrey E. Epstein 2014 Trust",
    "document_type": "trust_document",
    "original_date": "2015-09-01",
    "summary": "6-page amendment to the A&R. Key changes: (1) Amendment right simplified — Epstein can now amend unilaterally by delivering to one trustee (was: all trustees must sign). (2) Kahn bequest confirmed at $5M. (3) Fontanilla bequest expanded with Lyn & Jojo LLC transfer. (4) 5 new bequests added (A.33-37) including 2 conditional on 2-year continued service. (5) New Section 2.5 — 1-year post-death employment cliff for employee-beneficiaries. (6) $3M to Michelle Fern Saipher (Indyke wife) for FT Real Estate/KCAC/2 Kean Court NJ. All three trustees re-signed.",
    "classification": "high",
}, timeout=30))


# ── Phase 4: Entity-Document Links ───────────────────────────────────

print("\n" + "=" * 70)
print("PHASE 4: Entity-Document Links")
print("=" * 70)

# Links for EFTA01266380
links_380 = []
link_specs_380 = [
    ("Jeffrey Epstein", "subject", "Grantor of the trust"),
    ("Jes Staley", "subject", "Trustee — signed November 18, 2014, notarized in New York"),
    ("Darren Indyke", "subject", "Trustee + $5M beneficiary + loan forgiveness"),
    ("David Mitchell", "subject", "Trustee — signed November 2014, notarized in New York"),
    ("Karyna Shuliak", "mentioned", "$10M bequest + Palm Beach property + loan forgiveness"),
    ("Eva Andersson-Dubin", "mentioned", "Successor trustee + contingent beneficiary"),
    ("Richard D. Kahn", "mentioned", "$2M bequest (original amount, raised to $5M in A&R)"),
    ("Lesley Groff", "mentioned", "$1M bequest"),
    ("Mark Epstein", "mentioned", "Loan forgiveness"),
]

# Only add entities we found
for name, role, notes in link_specs_380:
    if name in entity_ids:
        links_380.append({
            "entity_id": entity_ids[name],
            "role": role,
            "notes": notes,
        })
    else:
        print(f"  SKIP: {name} (not found in DB)")

# Add Jean Luc Brunel if found
if "Jean Luc Brunel" in entity_ids:
    links_380.append({
        "entity_id": entity_ids["Jean Luc Brunel"],
        "role": "mentioned",
        "notes": "$5M bequest (#6) + loan forgiveness — openly named in original (redacted in A&R)",
    })

# Add Lawrence Visoski if found
if "Lawrence Visoski" in entity_ids:
    links_380.append({
        "entity_id": entity_ids["Lawrence Visoski"],
        "role": "mentioned",
        "notes": "$1M bequest + loan forgiveness (Epstein's pilot)",
    })

if links_380:
    check(f"batch link {len(links_380)} entities to EFTA01266380", mcp_call(
        "batch_link_entities_to_document",
        {"bates_number": "EFTA01266380", "links": links_380},
        timeout=30,
    ))

# Links for EFTA01266427
links_427 = []
link_specs_427 = [
    ("Jeffrey Epstein", "subject", "Grantor — simplified amendment power"),
    ("Jes Staley", "subject", "Re-signs as trustee (~September 2015)"),
    ("Darren Indyke", "subject", "Re-signs as trustee; wife receives $3M for NJ real estate"),
    ("David Mitchell", "subject", "Re-signs as trustee"),
    ("Richard D. Kahn", "mentioned", "Bequest explicitly confirmed at $5M"),
]

for name, role, notes in link_specs_427:
    if name in entity_ids:
        links_427.append({
            "entity_id": entity_ids[name],
            "role": role,
            "notes": notes,
        })

if links_427:
    check(f"batch link {len(links_427)} entities to EFTA01266427", mcp_call(
        "batch_link_entities_to_document",
        {"bates_number": "EFTA01266427", "links": links_427},
        timeout=30,
    ))


# ── Phase 5: Events ──────────────────────────────────────────────────

print("\n" + "=" * 70)
print("PHASE 5: Create Events")
print("=" * 70)

# Event 1: Original trust execution
r1 = check("event: Original trust executed (Nov 2014)", mcp_call("create_event", {
    "title": "Original Epstein 2014 Trust executed — Indyke, Staley, Mitchell named trustees",
    "date": "2014-11-18",
    "date_precision": "day",
    "event_type": "legal",
    "description": "Jeffrey E. Epstein executes the original 'Jeffrey E. Epstein 2014 Trust' in USVI. Trustees: Darren K. Indyke, James E. Staley, David Mitchell. Notarized in USVI (Erika Kellerhals). Trustees sign in New York (Habibe Avdiu for Indyke/Staley, Douglas Arnaudin for Mitchell). 22 cash bequests. Properties via USVI shell companies. This establishes Staley's formal fiduciary role with Epstein — 13 months before Barclays CEO appointment.",
    "source_document_id": "EFTA01266380",
}, timeout=30))

event1_id = None
if isinstance(r1, dict):
    data = r1.get("data", r1)
    if isinstance(data, dict):
        event1_id = data.get("id")

# Link event 1 to entities
if event1_id:
    for name in ["Jeffrey Epstein", "Jes Staley", "Darren Indyke", "David Mitchell"]:
        if name in entity_ids:
            check(f"  link event1 → {name}", mcp_call("link_entity_to_event", {
                "entity_id": entity_ids[name],
                "event_id": event1_id,
                "role": "participant",
            }))

# Event 2: First amendment
r2 = check("event: First amendment (~Sep 2015)", mcp_call("create_event", {
    "title": "First amendment to Epstein trust — amendment power simplified, employment cliff added",
    "date": "2015-09-01",
    "date_precision": "month",
    "event_type": "legal",
    "description": "First Amendment to the A&R of the Epstein 2014 Trust. Simplifies amendment power from 'all trustees must sign' to 'deliver to one trustee.' Adds Section 2.5 employment cliff — employee-beneficiaries must work for estate 1 year post-death or forfeit bequests. Adds 5 new bequests (A.33-37), Lyn & Jojo LLC transfer to Fontanillas, $3M to Indyke's wife for NJ real estate deal.",
    "source_document_id": "EFTA01266427",
}, timeout=30))

event2_id = None
if isinstance(r2, dict):
    data = r2.get("data", r2)
    if isinstance(data, dict):
        event2_id = data.get("id")

if event2_id:
    for name in ["Jeffrey Epstein", "Jes Staley", "Darren Indyke", "David Mitchell"]:
        if name in entity_ids:
            check(f"  link event2 → {name}", mcp_call("link_entity_to_event", {
                "entity_id": entity_ids[name],
                "event_id": event2_id,
                "role": "participant",
            }))


# ── Phase 6: Suspect Watchlist ────────────────────────────────────────

print("\n" + "=" * 70)
print("PHASE 6: Suspect Watchlist Additions")
print("=" * 70)

suspects = [
    {
        "name": "Janusz Banasiak",
        "category": "staff",
        "priority": "low",
        "notes": "$58,500 bequest in first amendment (EFTA01266427, A.35). Likely household staff.",
    },
    {
        "name": "Bella Klein",
        "category": "staff",
        "priority": "low",
        "notes": "$250,000 bequest in original trust (EFTA01266380, A.17).",
    },
    {
        "name": "David Rogers",
        "category": "staff",
        "priority": "low",
        "notes": "$250,000 bequest in original trust (EFTA01266380, A.18).",
    },
    {
        "name": "Steve Chavez",
        "category": "staff",
        "priority": "low",
        "notes": "$66,000 bequest in original trust (EFTA01266380, A.19).",
    },
    {
        "name": "Cynthia Cano",
        "category": "staff",
        "priority": "low",
        "notes": "$35,000 bequest in original trust (EFTA01266380, A.21).",
    },
    {
        "name": "Carlos Delgado",
        "category": "staff",
        "priority": "low",
        "notes": "$42,000 bequest in original trust (EFTA01266380, A.22).",
    },
    {
        "name": "Robert Gold",
        "category": "associate",
        "priority": "low",
        "notes": "Loan forgiveness in original trust (EFTA01266380, A.23.f).",
    },
    {
        "name": "Robert Goodman",
        "category": "associate",
        "priority": "low",
        "notes": "Loan forgiveness in original trust (EFTA01266380, A.23.g).",
    },
    {
        "name": "Emad Hanna",
        "category": "associate",
        "priority": "low",
        "notes": "Loan forgiveness in original trust (EFTA01266380, A.23.h).",
    },
    {
        "name": "David Lampert",
        "category": "associate",
        "priority": "low",
        "notes": "Loan forgiveness in original trust (EFTA01266380, A.23.j).",
    },
    {
        "name": "Alberto Pinto",
        "category": "associate",
        "priority": "low",
        "notes": "Loan forgiveness in original trust (EFTA01266380, A.23.m). French interior designer.",
    },
]

# Check if Jean Luc Brunel is already in entities — if not, add to suspects
if "Jean Luc Brunel" not in entity_ids:
    suspects.append({
        "name": "Jean Luc Brunel",
        "category": "associate",
        "priority": "high",
        "notes": "$5M bequest + loan forgiveness in original trust (EFTA01266380). Known co-conspirator. Arrested France Dec 2020, died in custody Feb 2022.",
    })

for s in suspects:
    check(f"suspect: {s['name']}", mcp_call("create_suspect", s))


# ── Phase 7: Jean Luc Brunel → Epstein connection ────────────────────

print("\n" + "=" * 70)
print("PHASE 7: Connections (if needed)")
print("=" * 70)

if "Jean Luc Brunel" in entity_ids and "Jeffrey Epstein" in entity_ids:
    # Check if connection already exists
    r = mcp_call("find_connections", {"entity_id": entity_ids["Jean Luc Brunel"]})
    existing = r.get("data", [])
    epstein_connected = False
    if isinstance(existing, list):
        for conn in existing:
            a = conn.get("entity_a", "")
            b = conn.get("entity_b", "")
            if entity_ids["Jeffrey Epstein"] in (a, b):
                epstein_connected = True
                break

    if not epstein_connected:
        check("connection: Brunel ↔ Epstein", mcp_call("create_connection", {
            "source_entity_id": entity_ids["Jean Luc Brunel"],
            "target_entity_id": entity_ids["Jeffrey Epstein"],
            "relationship_type": "connected_to",
            "strength": 95,
            "description": "$5M trust beneficiary + loan forgiveness (EFTA01266380). Known co-conspirator in trafficking operation. Arrested France Dec 2020, died in custody Feb 2022.",
        }))
    else:
        print("  SKIP: Brunel ↔ Epstein connection already exists")
else:
    print("  SKIP: Brunel not in entities table (added to suspects instead)")


# ── Summary ───────────────────────────────────────────────────────────

print("\n" + "=" * 70)
print(f"DONE: {passes} passed, {fails} failed")
print("=" * 70)

if fails > 0:
    print("\n⚠ Some operations failed — review output above.")
    sys.exit(1)
else:
    print("\n✓ All operations succeeded.")
