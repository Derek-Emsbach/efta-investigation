#!/usr/bin/env python3
"""
EFTA01266403 Database Updates via MCP
Locks Epstein 2014 Trust analysis findings into Supabase.
Run: python3 scripts/mcp_update_01266403.py
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


def lookup_person(name: str) -> dict | None:
    """Lookup entity by name, return {id, name, tier, type} or None."""
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


def get_document(bates: str) -> dict | None:
    """Get document by bates number."""
    result = mcp_call("get_document", {"bates_number": bates})
    if not result.get("success"):
        return None
    return result.get("data", {}).get("document", result.get("data", {}))


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: LOOKUPS
# ═══════════════════════════════════════════════════════════════════════════════

def phase1_lookups():
    print("\n" + "=" * 70)
    print("PHASE 1: LOOKUPS")
    print("=" * 70)

    doc = get_document("EFTA01266403")
    if not doc:
        print("  ✗ EFTA01266403 not found! Halting.")
        sys.exit(1)
    doc_id = doc.get("id")
    print(f"  ✓ DOC_ID = {doc_id}")
    print(f"    Title: {doc.get('title', '(none)')[:60]}")

    MUST_EXIST = [
        "Jeffrey Epstein", "Jes Staley", "Darren Indyke",
        "Glenn Dubin", "Lesley Groff",
    ]
    OPTIONAL = ["Mark Epstein", "Lawrence Visoski"]

    ids = {"doc_id": doc_id}
    for name in MUST_EXIST:
        print(f"  → {name}...", end=" ", flush=True)
        p = lookup_person(name)
        if not p:
            print(f"✗ NOT FOUND — halting.")
            sys.exit(1)
        key = name.split()[-1].lower()
        if p.get("type") == "suspect":
            print(f"⚠ SUSPECT (not entity) — {p['id'][:8]}...")
            ids[key] = p["id"]
            ids[f"{key}_type"] = "suspect"
        else:
            print(f"✓ {p['id'][:8]}... (T{p.get('tier', '?')})")
            ids[key] = p["id"]

    for name in OPTIONAL:
        print(f"  → {name}...", end=" ", flush=True)
        p = lookup_person(name)
        key = name.split()[-1].lower()
        if p:
            if p.get("type") == "suspect":
                print(f"⚠ suspect — {p['id'][:8]}... (will skip links)")
                ids[key] = None  # Can't use suspect IDs for FK
            else:
                print(f"✓ {p['id'][:8]}... (T{p.get('tier', '?')})")
                ids[key] = p["id"]
        else:
            print("✗ not found (will skip)")
            ids[key] = None

    return ids


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: UPDATE DOCUMENT
# ═══════════════════════════════════════════════════════════════════════════════

def phase2_update_document(doc_id: str):
    print("\n" + "=" * 70)
    print("PHASE 2: UPDATE DOCUMENT RECORD")
    print("=" * 70)

    result = mcp_call("update_document", {
        "document_id": doc_id,
        "title": "Amendment and Restatement of the Jeffrey E. Epstein 2014 Trust",
        "document_type": "trust_document",
        "date": "2015-05-01",
        "classification": "high",
        "severity": "critical",
        "summary": (
            "Revocable inter vivos trust governed by USVI law. Grantor: Jeffrey E. Epstein. "
            "Trustees: Darren K. Indyke (personal attorney), James E. Staley (future Barclays CEO), "
            "David Mitchell. Each trustee receives $250,000/year compensation. "
            "Primary beneficiary: Celina Edith Dubin (Glenn Dubin's daughter) — receives all four "
            "major Epstein properties (NYC townhouse via Maple Inc., Little St. James via Nautilus Inc., "
            "Zorro Ranch via Cypress Inc., Paris apartment via SCI JEP) plus $20M in operating expense "
            "funds plus 100% of residuary estate. Contingent beneficiary: Eva Andersson-Dubin (Glenn's "
            "wife), then MIT. Karyna Shuliak receives Palm Beach property via Laurel Inc. + $10M bequest. "
            "Cash bequests total ~$85M to 22 named individuals (7 redacted females at $5M each). "
            "Indyke receives $5M bequest + full debt cancellation. Richard Kahn (accountant) receives "
            "$2M + full debt cancellation. Lesley Groff receives $1M. Loan forgiveness for 20+ "
            "individuals including Mark Epstein. Eva Andersson-Dubin is also first successor trustee. "
            "Schedule A (trust property) not included in document. Staley signed under oath in New York, "
            "May 2015 — 7 months before becoming Barclays CEO. No resignation document found in "
            "1.38M-document corpus."
        ),
        "review_notes": (
            "CRITICAL trust document. Reveals: (1) Staley's formal fiduciary relationship + $250K/yr "
            "compensation from Epstein; (2) Celina Dubin as primary beneficiary of entire estate — "
            "evidence of deep Dubin-Epstein financial entanglement beyond social acquaintance; "
            "(3) Shell company structure for all properties (each held by separate USVI corporation); "
            "(4) Eva Andersson-Dubin as successor trustee + contingent beneficiary; "
            "(5) 7 redacted female beneficiaries at $5M each. Schedule A (trust property) missing from "
            "production. Related docs: EFTA01266380 (original Nov 2014), EFTA01266427 (first amendment)."
        ),
    })

    if result.get("success"):
        print("  ✓ Document updated")
    else:
        print(f"  ✗ Failed: {result.get('error', result.get('message', result))}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3: CREATE 5 NEW ENTITIES
# ═══════════════════════════════════════════════════════════════════════════════

NEW_ENTITIES = [
    {
        "name": "David Mitchell",
        "tier": 6,
        "category": "financial",
        "bio": (
            "Third trustee of the Jeffrey E. Epstein 2014 Trust alongside Darren Indyke and "
            "Jes Staley. Signed as trustee May 2015, notarized in New York."
        ),
        "evidence_summary": (
            "Named as trustee in EFTA01266403 (Epstein 2014 Trust Amendment, May 1, 2015). "
            "Entitled to $250,000/year trustee compensation. Signed under oath. "
            "Notarized in New York. Co-trustee with Indyke and Staley."
        ),
        "aliases": ["David Mite ell"],
    },
    {
        "name": "Celina Edith Dubin",
        "tier": 4,
        "category": "associate",
        "bio": (
            "Daughter of Glenn Dubin and Eva Andersson-Dubin. Primary beneficiary of the "
            "Jeffrey E. Epstein 2014 Trust — receives all four major Epstein properties "
            "(NYC, Little St. James, Zorro Ranch, Paris) plus $20M in operating funds plus "
            "100% of residuary estate."
        ),
        "evidence_summary": (
            "Named as primary beneficiary in EFTA01266403 (Epstein 2014 Trust). Receives: "
            "9 East 71st St NYC (via Maple Inc.), Little St. James Island (via Nautilus Inc.), "
            "Zorro Ranch NM (via Cypress Inc.), 22 Avenue Foch Paris (via SCI JEP), $20M "
            "operating funds, 100% residuary estate. Father Glenn Dubin is Tier 1 (EFTA02731082: "
            "Maxwell directed victim to Dubin). The bequest of essentially the entire Epstein "
            "fortune to the daughter of an alleged abuser raises serious questions about the "
            "nature of the Epstein-Dubin relationship."
        ),
        "aliases": ["Celina Dubin"],
    },
    {
        "name": "Eva Andersson-Dubin",
        "tier": 4,
        "category": "associate",
        "bio": (
            "Swedish-born physician. Wife of Glenn Dubin. Named as first successor trustee "
            "and contingent beneficiary of the entire Epstein 2014 Trust."
        ),
        "evidence_summary": (
            "Named as first successor trustee (Section 7.1) and contingent residuary beneficiary "
            "(Section 2.4.B) in EFTA01266403 (Epstein 2014 Trust). Also receives property trust "
            "remainders upon Celina's death (Section 3.1D). Referenced in EFTA02731082 p57: "
            "'Eva Dubin present during a directed massage.' Combined with husband Glenn's Tier 1 "
            "status, the Dubin family's role in the Epstein network was financial, fiduciary, and "
            "— per the prosecution memo — potentially participatory."
        ),
        "aliases": ["Eva Andersson Dubin", "Eva Dubin"],
    },
    {
        "name": "Karyna Shuliak",
        "tier": 4,
        "category": "associate",
        "bio": (
            "Epstein girlfriend. Receives $10M bequest and Palm Beach property "
            "(358 El Brillo Way via Laurel Inc.) plus $1M operating expenses in the 2014 Trust."
        ),
        "evidence_summary": (
            "Named in EFTA01266403 (Epstein 2014 Trust): $10M cash bequest (Section 2.3.A.3) "
            "plus 358 El Brillo Way, Palm Beach (Section 2.3.A.31) via Laurel Inc. (USVI "
            "corporation). Also receives loan forgiveness (Section 2.3.A.23). Reported elsewhere "
            "as Epstein's girlfriend at time of arrest in 2019."
        ),
        "aliases": [],
    },
    {
        "name": "Richard D. Kahn",
        "tier": 6,
        "category": "financial",
        "bio": (
            "Epstein's accountant. Received $2M trust bequest plus full cancellation of all "
            "debts to Epstein and his entities. Referenced in EFTA02731082 as the person Epstein "
            "directed to wire $250,000 to an assistant days after the Miami Herald series."
        ),
        "evidence_summary": (
            "Named in EFTA01266403 (Epstein 2014 Trust): $2M bequest (Section 2.3.A.13), full "
            "debt cancellation including spouse Lisa Kahn and entity Coatue Enterprises LLC "
            "(Section 2.3.A.25). Referenced in EFTA02731082 p48 as 'accountant Rich Kahn' "
            "directed to wire $250,000 to assistant after Miami Herald series. Deeply embedded "
            "in Epstein financial infrastructure."
        ),
        "aliases": ["Richard Kahn", "Rich Kahn"],
    },
]


def phase3_create_entities():
    print("\n" + "=" * 70)
    print("PHASE 3: CREATE 5 NEW ENTITIES")
    print("=" * 70)

    new_ids = {}
    for ent in NEW_ENTITIES:
        name = ent["name"]
        print(f"  → Creating {name}...", end=" ", flush=True)
        result = mcp_call("create_entity", ent)
        if result.get("success"):
            eid = result.get("id", result.get("data", {}).get("id", "?"))
            print(f"✓ {str(eid)[:8]}...")
            key = name.split()[-1].lower()
            if name == "Eva Andersson-Dubin":
                key = "eva"
            elif name == "Celina Edith Dubin":
                key = "celina"
            elif name == "David Mitchell":
                key = "mitchell"
            elif name == "Karyna Shuliak":
                key = "shuliak"
            elif name == "Richard D. Kahn":
                key = "kahn"
            new_ids[key] = eid
        else:
            err = result.get("error", result.get("message", str(result)[:100]))
            print(f"✗ {err}")
            new_ids[name.split()[-1].lower()] = None

    return new_ids


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4: UPDATE EXISTING ENTITIES
# ═══════════════════════════════════════════════════════════════════════════════

def phase4_update_entities(ids: dict):
    print("\n" + "=" * 70)
    print("PHASE 4: UPDATE EXISTING ENTITIES")
    print("=" * 70)

    updates = [
        {
            "entity_id": ids["dubin"],
            "name": "Glenn Dubin",
            "evidence_summary": (
                "EFTA01266403: Daughter Celina Edith Dubin is primary beneficiary of the entire "
                "Epstein 2014 Trust — all four major properties (NYC, Little St. James, Zorro Ranch, "
                "Paris) plus $20M operating funds plus 100% residuary estate. Wife Eva Andersson-Dubin "
                "is successor trustee and contingent beneficiary. The testamentary bequest of a "
                "~$500M+ estate to the Dubin family demonstrates a relationship far deeper than "
                "social acquaintance."
            ),
        },
        {
            "entity_id": ids["indyke"],
            "name": "Darren Indyke",
            "evidence_summary": (
                "EFTA01266403: Named trustee of Epstein 2014 Trust with $250,000/year compensation. "
                "$5M cash bequest (Section 2.3.A.7). Full cancellation of all personal and spousal "
                "debt to Epstein and his entities including Southern Financial LLC and Harlequin Dane "
                "LLC (Section 2.3.A.24). Spouse Michelle Fern Saipher also covered by debt cancellation. "
                "This is the deepest financial entanglement of any non-family member in the trust."
            ),
        },
        {
            "entity_id": ids["staley"],
            "name": "Jes Staley",
            "evidence_summary": (
                "EFTA01266403: Signed as trustee of Epstein 2014 Trust under oath in New York, "
                "May 2015. Entitled to $250,000/year trustee compensation. Broad fiduciary powers "
                "over all Epstein trust assets. Became Barclays CEO in December 2015 — 7 months "
                "after signing. No resignation document found in 1.38M-document EFTA corpus. "
                "UK FCA/PRA regulations require disclosure of material fiduciary relationships."
            ),
        },
    ]

    for upd in updates:
        name = upd.pop("name")
        print(f"  → Updating {name}...", end=" ", flush=True)
        result = mcp_call("update_entity", upd)
        if result.get("success"):
            print("✓ evidence_summary merged")
        else:
            err = result.get("error", result.get("message", str(result)[:100]))
            print(f"✗ {err}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5: ENTITY-DOCUMENT LINKS
# ═══════════════════════════════════════════════════════════════════════════════

def phase5_entity_doc_links(ids: dict, new_ids: dict):
    print("\n" + "=" * 70)
    print("PHASE 5: ENTITY-DOCUMENT LINKS")
    print("=" * 70)

    links = [
        {"entity_id": ids["epstein"], "role": "subject", "notes": "Grantor of the trust"},
        {"entity_id": ids["staley"], "role": "subject", "notes": "Trustee, $250K/yr compensation, signed under oath"},
        {"entity_id": ids["indyke"], "role": "subject", "notes": "Trustee + $5M beneficiary + all debt cancelled"},
        {"entity_id": ids["groff"], "role": "mentioned", "notes": "$1M bequest"},
        {"entity_id": ids["dubin"], "role": "mentioned", "notes": "Father of primary beneficiary Celina Dubin"},
    ]

    # New entities
    if new_ids.get("mitchell"):
        links.append({"entity_id": new_ids["mitchell"], "role": "subject", "notes": "Third trustee, signed under oath"})
    if new_ids.get("celina"):
        links.append({"entity_id": new_ids["celina"], "role": "mentioned", "notes": "Primary beneficiary of all properties + residuary"})
    if new_ids.get("eva"):
        links.append({"entity_id": new_ids["eva"], "role": "mentioned", "notes": "First successor trustee + contingent beneficiary"})
    if new_ids.get("shuliak"):
        links.append({"entity_id": new_ids["shuliak"], "role": "mentioned", "notes": "$10M bequest + Palm Beach property"})
    if new_ids.get("kahn"):
        links.append({"entity_id": new_ids["kahn"], "role": "mentioned", "notes": "$2M bequest + all debt cancelled"})

    # Optional entities
    if ids.get("epstein_mark"):
        links.append({"entity_id": ids["epstein_mark"], "role": "mentioned", "notes": "Loan forgiveness"})
    if ids.get("visoski"):
        links.append({"entity_id": ids["visoski"], "role": "mentioned", "notes": "$1M bequest + loan forgiveness"})

    print(f"  → Batch linking {len(links)} entities to EFTA01266403...", end=" ", flush=True)
    result = mcp_call("batch_link_entities_to_document", {
        "document_id": ids["doc_id"],
        "links": links,
    })
    if result.get("success"):
        print(f"✓ {len(links)} links created")
    else:
        err = result.get("error", result.get("message", str(result)[:100]))
        print(f"✗ {err}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 6: EVENTS + ENTITY LINKS
# ═══════════════════════════════════════════════════════════════════════════════

def phase6_events(ids: dict, new_ids: dict):
    print("\n" + "=" * 70)
    print("PHASE 6: CREATE EVENTS + LINK ENTITIES")
    print("=" * 70)

    events = [
        {
            "event": {
                "title": "Epstein 2014 Trust amended and restated with Indyke, Staley, Mitchell as trustees",
                "date": "2015-05-01",
                "date_precision": "day",
                "event_type": "legal",
                "description": (
                    "Jeffrey E. Epstein executes Amendment and Restatement of the 2014 Trust in USVI. "
                    "Trustees: Darren K. Indyke, James E. Staley, David Mitchell. Trust is revocable, "
                    "governed by USVI law. Primary beneficiary: Celina Edith Dubin. Each trustee "
                    "compensated $250,000/year. Original trust dated November 18, 2014 (EFTA01266380)."
                ),
                "source_document_id": ids["doc_id"],
            },
            "entity_ids": [
                ids["epstein"], ids["staley"], ids["indyke"],
                new_ids.get("mitchell"),
            ],
        },
        {
            "event": {
                "title": "Staley signs as trustee of Epstein 2014 Trust under oath in New York",
                "date": "2015-05-01",
                "date_precision": "month",
                "event_type": "legal",
                "description": (
                    "James E. Staley signs the Amendment and Restatement of the Epstein 2014 Trust "
                    "as trustee, notarized in New York by Imbie Avdiu (Richmond County). Accepts "
                    "$250,000/year compensation and broad fiduciary powers over Epstein's assets. "
                    "Seven months later (December 2015) Staley becomes Barclays CEO. No resignation "
                    "from trust found in EFTA corpus."
                ),
                "source_document_id": ids["doc_id"],
            },
            "entity_ids": [ids["staley"]],
        },
    ]

    for i, ev in enumerate(events):
        title_short = ev["event"]["title"][:50]
        print(f"\n  Event {i+1}: {title_short}...")

        # Create event
        print(f"    → Creating event...", end=" ", flush=True)
        result = mcp_call("create_event", ev["event"])
        if not result.get("success"):
            err = result.get("error", result.get("message", str(result)[:100]))
            print(f"✗ {err}")
            continue
        event_id = result.get("id", result.get("data", {}).get("id"))
        print(f"✓ {str(event_id)[:8]}...")

        # Link entities
        entity_ids = [eid for eid in ev["entity_ids"] if eid]
        if entity_ids:
            print(f"    → Linking {len(entity_ids)} entities...", end=" ", flush=True)
            link_result = mcp_call("link_entity_to_event", {
                "event_id": event_id,
                "entity_ids": entity_ids,
            })
            if link_result.get("success"):
                print("✓")
            else:
                err = link_result.get("error", link_result.get("message", str(link_result)[:100]))
                print(f"✗ {err}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 7: CONNECTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def phase7_connections(ids: dict, new_ids: dict):
    print("\n" + "=" * 70)
    print("PHASE 7: CREATE CONNECTIONS")
    print("=" * 70)

    # Check existing connections
    print("  Checking existing connections...")
    for name, eid in [("Celina Dubin", new_ids.get("celina")),
                      ("David Mitchell", new_ids.get("mitchell")),
                      ("Richard Kahn", new_ids.get("kahn"))]:
        if eid:
            result = mcp_call("find_connections", {"entity_id": eid, "limit": 5})
            count = result.get("count", len(result.get("data", [])))
            print(f"    {name}: {count} existing connections")

    connections = [
        {
            "source_entity_id": new_ids.get("celina"),
            "target_entity_id": ids["epstein"],
            "relationship_type": "connected_to",
            "strength": 95,
            "evidence_strength": "documented",
            "description": "Primary beneficiary of Epstein 2014 Trust — all 4 properties + $20M operating + 100% residuary (EFTA01266403). Testamentary, not operational.",
        },
        {
            "source_entity_id": new_ids.get("celina"),
            "target_entity_id": ids["dubin"],
            "relationship_type": "family_of",
            "strength": 95,
            "evidence_strength": "documented",
            "description": "Father-daughter. Familial, not operational. Glenn Dubin is Tier 1.",
        },
        {
            "source_entity_id": new_ids.get("eva"),
            "target_entity_id": ids["epstein"],
            "relationship_type": "connected_to",
            "strength": 90,
            "evidence_strength": "documented",
            "description": "Successor trustee + contingent beneficiary of entire Epstein 2014 Trust (EFTA01266403). Also present during directed massage (EFTA02731082 p57).",
        },
        {
            "source_entity_id": new_ids.get("eva"),
            "target_entity_id": ids["dubin"],
            "relationship_type": "family_of",
            "strength": 95,
            "evidence_strength": "documented",
            "description": "Married. Familial, not operational. Glenn Dubin is Tier 1.",
        },
        {
            "source_entity_id": new_ids.get("mitchell"),
            "target_entity_id": ids["epstein"],
            "relationship_type": "connected_to",
            "strength": 90,
            "evidence_strength": "documented",
            "description": "Co-trustee of Epstein 2014 Trust, signed under oath May 2015 (EFTA01266403).",
        },
        {
            "source_entity_id": new_ids.get("mitchell"),
            "target_entity_id": ids["indyke"],
            "relationship_type": "connected_to",
            "strength": 85,
            "evidence_strength": "documented",
            "description": "Co-trustees of Epstein 2014 Trust (EFTA01266403).",
        },
        {
            "source_entity_id": new_ids.get("mitchell"),
            "target_entity_id": ids["staley"],
            "relationship_type": "connected_to",
            "strength": 85,
            "evidence_strength": "documented",
            "description": "Co-trustees of Epstein 2014 Trust (EFTA01266403).",
        },
        {
            "source_entity_id": new_ids.get("kahn"),
            "target_entity_id": ids["epstein"],
            "relationship_type": "connected_to",
            "strength": 90,
            "evidence_strength": "documented",
            "description": "Epstein's accountant. $2M bequest + all debt cancelled (EFTA01266403). Wired $250K witness payment after Miami Herald series (EFTA02731082).",
        },
        {
            "source_entity_id": new_ids.get("shuliak"),
            "target_entity_id": ids["epstein"],
            "relationship_type": "connected_to",
            "strength": 90,
            "evidence_strength": "documented",
            "description": "$10M bequest + Palm Beach property via Laurel Inc. (EFTA01266403). Reported as Epstein's girlfriend at time of arrest.",
        },
    ]

    created = 0
    skipped = 0
    for conn in connections:
        src = conn["source_entity_id"]
        tgt = conn["target_entity_id"]
        if not src or not tgt:
            print(f"  → SKIP (missing entity ID): {conn['relationship_type']}")
            skipped += 1
            continue
        desc_short = conn["description"][:50]
        print(f"  → {conn['relationship_type']} (str={conn['strength']}): {desc_short}...", end=" ", flush=True)
        result = mcp_call("create_connection", conn)
        if result.get("success"):
            print("✓")
            created += 1
        else:
            err = result.get("error", result.get("message", str(result)[:100]))
            print(f"✗ {err}")

    print(f"\n  Created: {created}, Skipped: {skipped}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 8: SUSPECT WATCHLIST
# ═══════════════════════════════════════════════════════════════════════════════

SUSPECTS = [
    {"name": "Luciano A. Fontanilla, Jr.", "category": "staff", "priority": "P3",
     "notes": "Epstein 2014 Trust (EFTA01266403): $2M bequest + loan forgiveness. Staff."},
    {"name": "Rosalyn V. Fontanilla", "category": "staff", "priority": "P4",
     "notes": "Epstein 2014 Trust (EFTA01266403): $2M shared bequest + loan forgiveness."},
    {"name": "Michelle Fern Saipher", "category": "associate", "priority": "P4",
     "notes": "Indyke's spouse. All debt to Epstein entities cancelled (EFTA01266403 Section 2.3.A.24)."},
    {"name": "Lisa Kahn", "category": "associate", "priority": "P4",
     "notes": "Richard Kahn's spouse. All debt to Epstein entities cancelled (EFTA01266403 Section 2.3.A.25)."},
    {"name": "Gaddo Cardini", "category": "associate", "priority": "P4",
     "notes": "Epstein 2014 Trust (EFTA01266403): Loan forgiveness."},
    {"name": "Adam Bly", "category": "associate", "priority": "P3",
     "notes": "Epstein 2014 Trust (EFTA01266403): Loan forgiveness. Science publisher, known Epstein associate."},
    {"name": "Steven Hanson", "category": "associate", "priority": "P4",
     "notes": "Named successor trustee #2 of Epstein 2014 Trust (EFTA01266403 Section 7.1)."},
    {"name": "Joseph Pagano", "category": "associate", "priority": "P4",
     "notes": "Named successor trustee #3 of Epstein 2014 Trust (EFTA01266403 Section 7.1)."},
    {"name": "Steven Victor", "category": "associate", "priority": "P4",
     "notes": "Epstein 2014 Trust (EFTA01266403): Loan forgiveness."},
    {"name": "Ann Rodriguez", "category": "staff", "priority": "P4",
     "notes": "Epstein 2014 Trust (EFTA01266403): $500K bequest."},
    {"name": "Valdson Viera Contrin", "category": "staff", "priority": "P4",
     "notes": "Epstein 2014 Trust (EFTA01266403): $500K bequest."},
]


def phase8_suspects():
    print("\n" + "=" * 70)
    print("PHASE 8: ADD SUSPECTS TO WATCHLIST")
    print("=" * 70)

    created = 0
    for s in SUSPECTS:
        print(f"  → {s['name']} ({s['priority']})...", end=" ", flush=True)
        result = mcp_call("create_suspect", s)
        if result.get("success"):
            sid = result.get("id", result.get("data", {}).get("id", "?"))
            print(f"✓ {str(sid)[:8]}...")
            created += 1
        else:
            err = result.get("error", result.get("message", str(result)[:100]))
            print(f"✗ {err}")

    print(f"\n  Created: {created}/{len(SUSPECTS)}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 9: VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def phase9_verify(ids: dict, new_ids: dict):
    print("\n" + "=" * 70)
    print("PHASE 9: VERIFICATION")
    print("=" * 70)

    # Check document
    print("\n  → Verifying document...")
    doc = get_document("EFTA01266403")
    if doc:
        print(f"    Title: {doc.get('title', '(none)')[:60]}")
        print(f"    Severity: {doc.get('severity', '(none)')}")
        print(f"    Summary: {str(doc.get('summary', ''))[:80]}...")
    else:
        print("    ✗ Document not found!")

    # Check new entities
    for name, key in [("David Mitchell", "mitchell"), ("Celina Dubin", "celina"),
                      ("Eva Andersson-Dubin", "eva"), ("Richard Kahn", "kahn"),
                      ("Karyna Shuliak", "shuliak")]:
        eid = new_ids.get(key)
        if eid:
            print(f"\n  → Verifying {name} ({str(eid)[:8]}...)...")
            result = mcp_call("get_entity", {"entity_id": eid})
            if result.get("success"):
                data = result.get("data", {})
                ent = data.get("entity", data)
                print(f"    Tier: {ent.get('tier', '?')}, Category: {ent.get('category', '?')}")
            else:
                print(f"    ✗ {result.get('error', result.get('message', ''))}")

    # Check connections for Celina and Mitchell
    for name, key in [("Celina Dubin", "celina"), ("David Mitchell", "mitchell")]:
        eid = new_ids.get(key)
        if eid:
            print(f"\n  → Connections for {name}...")
            result = mcp_call("find_connections", {"entity_id": eid, "limit": 10})
            conns = result.get("data", [])
            print(f"    {len(conns)} connections found")
            for c in conns:
                ctype = c.get("relationship_type", "?")
                other = c.get("entity_a_name", c.get("entity_b_name", "?"))
                print(f"      - {ctype}: {other}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("EFTA01266403 — Epstein 2014 Trust — Database Updates")
    print("=" * 55)

    ids = phase1_lookups()
    phase2_update_document(ids["doc_id"])
    new_ids = phase3_create_entities()
    phase4_update_entities(ids)
    phase5_entity_doc_links(ids, new_ids)
    phase6_events(ids, new_ids)
    phase7_connections(ids, new_ids)
    phase8_suspects()
    phase9_verify(ids, new_ids)

    print("\n" + "=" * 70)
    print("DONE — All phases complete.")
    print("=" * 70)
