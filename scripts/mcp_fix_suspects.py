#!/usr/bin/env python3
"""
Fix: Promote 3 suspects to entities, then re-run failed operations.
Wexner, Dubin, and Indyke exist in suspect_watchlist but not entities table.
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


def mcp_call(tool: str, args: dict) -> dict:
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
        with urllib.request.urlopen(req, timeout=30) as resp:
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


# Known IDs from Phase 1
DOC_ID = "13e67221-2dd5-436c-8afb-976b8cce78bd"
EPSTEIN_ID = "c8e78fb9-afb3-48e2-9ee2-2e122ed2e2c8"  # from lookup truncated
MAXWELL_ID = "0486c2d0-"  # need full IDs

# Suspect IDs from Phase 1
WEXNER_SUSPECT_ID = None
DUBIN_SUSPECT_ID = None
INDYKE_SUSPECT_ID = None


def get_full_ids():
    """Re-run lookups to get full UUIDs."""
    print("=" * 70)
    print("STEP 0: RE-LOOKUP FOR FULL IDs")
    print("=" * 70)

    ids = {}
    names = [
        "Jeffrey Epstein", "Ghislaine Maxwell", "Bill Clinton",
        "Leslie Wexner", "Glenn Dubin", "Darren Indyke",
        "Jean-Luc Brunel", "Prince Andrew", "Alan Dershowitz",
        "Harvey Weinstein", "Leslie Groff",
    ]
    suspects = {}

    for name in names:
        result = mcp_call("lookup_person", {"name": name})
        if not result.get("success"):
            print(f"  ✗ {name}: lookup failed")
            continue

        data = result.get("data", {})
        entities = data.get("entity_matches", [])
        suspect_matches = data.get("suspect_matches", [])

        if entities:
            e = entities[0]
            ids[name] = e["id"]
            print(f"  ✓ {name}: {e['id'][:12]}... (entity, T{e.get('tier', '?')})")
        elif suspect_matches:
            s = suspect_matches[0]
            suspects[name] = s["id"]
            entity_id = s.get("entity_id")
            if entity_id:
                ids[name] = entity_id
                print(f"  ✓ {name}: {entity_id[:12]}... (promoted suspect)")
            else:
                ids[name] = None
                print(f"  ⚠ {name}: {s['id'][:12]}... (SUSPECT, needs promotion)")
        else:
            ids[name] = None
            print(f"  ○ {name}: not found")

    return ids, suspects


def promote_suspects(ids, suspects):
    """Promote Wexner, Dubin, Indyke from suspect_watchlist to entities."""
    print("\n" + "=" * 70)
    print("STEP 1: PROMOTE SUSPECTS TO ENTITIES")
    print("=" * 70)

    PROMOTIONS = [
        {
            "name": "Leslie Wexner",
            "tier": 4,
            "category": "associated",
            "bio": "Billionaire founder of L Brands (Victoria's Secret, Bath & Body Works). Epstein's primary financial patron — stole 'several hundred million dollars' from Wexner per SDNY prosecution memo. $100M settlement Jan 2008. Wexner severed ties after discovering theft.",
        },
        {
            "name": "Glenn Dubin",
            "tier": 1,
            "category": "alleged_abuser",
            "bio": "Hedge fund billionaire (Highbridge Capital Management). Maxwell directed victim to engage in sex acts with him (EFTA02731082 p57). Eva Dubin present during directed massage. $53.9M Highbridge Capital investment with Epstein.",
        },
        {
            "name": "Darren Indyke",
            "tier": 6,
            "category": "attorney",
            "bio": "Epstein's personal attorney. Told assistant not to talk to police. Brought computer to jail for 'video sex' (EFTA02731082 pp41,45). Facilitated obstruction.",
        },
    ]

    for promo in PROMOTIONS:
        name = promo["name"]
        suspect_id = suspects.get(name)
        if not suspect_id:
            # Check if already an entity
            if ids.get(name):
                print(f"  ✓ {name}: already an entity ({ids[name][:12]}...)")
                continue
            print(f"  ✗ {name}: no suspect ID found, skipping")
            continue

        print(f"\n  → Promoting {name} (suspect {suspect_id[:12]}...)...")
        result = mcp_call("promote_suspect", {
            "suspect_id": suspect_id,
            "tier": promo["tier"],
            "entity_type": "person",
            "category": promo["category"],
            "bio": promo["bio"],
        })

        if result.get("success"):
            new_entity_id = result.get("id") or result.get("data", {}).get("entity_id")
            ids[name] = new_entity_id
            print(f"    ✓ Promoted → entity {new_entity_id}")
        else:
            msg = result.get("message", result.get("error", str(result)))
            print(f"    ✗ Promotion failed: {msg}")
            # If already promoted, try to get entity_id from the error
            if "already" in str(msg).lower() or "in_db" in str(msg).lower():
                # Try direct entity search
                result2 = mcp_call("lookup_person", {"name": name})
                if result2.get("success"):
                    entities = result2.get("data", {}).get("entity_matches", [])
                    if entities:
                        ids[name] = entities[0]["id"]
                        print(f"    → Found existing entity: {ids[name][:12]}...")

    return ids


def update_dubin(dubin_id):
    """Update Dubin entity with evidence summary."""
    print("\n" + "=" * 70)
    print("STEP 2: UPDATE DUBIN EVIDENCE SUMMARY")
    print("=" * 70)

    if not dubin_id:
        print("  ✗ No Dubin entity ID, skipping")
        return

    evidence = (
        "EFTA02731082 p57: Maxwell told victim 'she had to do to Glen what she did for Epstein.' "
        "Eva Dubin present during a directed massage. This is prosecution memo evidence (Grand Jury "
        "6(e) material) of Maxwell directing sexual contact between a victim and Dubin — not mere "
        "association. Combined with DS9 financial partnership ($53.9M Highbridge Capital investment, "
        "$3.8M Jeepers/DB Zwirn partnership) and Giuffre testimony, evidence supports Tier 1."
    )

    # Get existing entity to check current evidence_summary
    existing = mcp_call("get_entity", {"entity_id": dubin_id})
    existing_summary = ""
    if existing.get("success"):
        entity_data = existing.get("data", {}).get("entity", existing.get("data", {}))
        meta = entity_data.get("metadata", {})
        if isinstance(meta, dict):
            existing_summary = meta.get("evidence_summary", "")
        print(f"  Current tier: {entity_data.get('tier')}")
        if existing_summary:
            print(f"  Has evidence_summary: {len(existing_summary)} chars")

    # Merge
    if existing_summary and evidence not in existing_summary:
        merged = existing_summary + "\n\n" + evidence
    else:
        merged = evidence

    result = mcp_call("update_entity", {
        "entity_id": dubin_id,
        "tier": 1,
        "category": "alleged_abuser",
        "evidence_summary": merged,
        "add_aliases": ["Glen Dubin", "G. Dubin"],
    })

    if result.get("success"):
        print("  ✓ Dubin updated: tier=1, evidence_summary set")
    else:
        msg = result.get("message", result.get("error", str(result)))
        print(f"  ✗ Update failed: {msg}")


def rerun_entity_links(doc_id, ids):
    """Re-run batch entity-document links with correct entity IDs."""
    print("\n" + "=" * 70)
    print("STEP 3: ENTITY-DOCUMENT LINKS (re-run)")
    print("=" * 70)

    LINKS = [
        ("Ghislaine Maxwell", "subject",
         "Co-conspirator, recruiter, participant throughout memo. Memo recommends separate prosecution memo for charges (fn62 p72)."),
        ("Jean-Luc Brunel", "mentioned",
         "Close associate, brought ~15yo girl to USVI, controlled victim's visa via modeling agency, invoked Fifth Amendment (pp13,14,31,35,40,43,44,47,64)."),
        ("Prince Andrew", "mentioned",
         "Victim claims Maxwell directed her to have sex with him. SDNY notes corroboration (photo + Maxwell admission) but also credibility concerns (pp7,57,59,60,65)."),
        ("Alan Dershowitz", "mentioned",
         "Mentioned by 'lent out' victim. Reporter Churcher suggested including him: 'We all suspect Alan is a pedo' (pp57,59,60)."),
        ("Bill Clinton", "mentioned",
         "Africa trip on Epstein's jet with Maxwell and 4 young women. Secret Service doctor found it 'odd' (pp28,37)."),
        ("Harvey Weinstein", "mentioned",
         "Victim directed to massage him at Paris residence. Told her to remove shirt. She refused (pp14,58)."),
        ("Leslie Wexner", "mentioned",
         "Epstein stole 'several hundred million dollars' from him — explains 'virtually all of Epstein's wealth.' $100M settlement Jan 2008 (pp64,65)."),
        ("Leslie Groff", "subject",
         "NYC-based scheduler 2001-2019. Invoked Fifth Amendment. Section IV.D evaluates charging her (redacted). Never charged."),
        ("Glenn Dubin", "mentioned",
         "Maxwell directed victim: 'She had to do to Glen what she did for Epstein.' Eva Dubin present during directed massage (p57)."),
        ("Darren Indyke", "mentioned",
         "Epstein's attorney. Told assistant not to talk to police (p41). Brought computer to jail for 'video sex' (p45)."),
    ]

    links_payload = []
    skipped = []
    for name, role, notes in LINKS:
        uid = ids.get(name)
        if uid:
            links_payload.append({"entity_id": uid, "role": role, "notes": notes})
        else:
            skipped.append(name)

    if skipped:
        print(f"  ○ Skipping (no UUID): {', '.join(skipped)}")

    print(f"  → Linking {len(links_payload)} entities...")
    result = mcp_call("batch_link_entities_to_document", {
        "document_id": doc_id,
        "links": links_payload,
    })

    if result.get("success"):
        count = result.get("count", len(links_payload))
        print(f"  ✓ {count} entity-document links created/updated")
    else:
        msg = result.get("error", result.get("message", str(result)))
        print(f"  ✗ Failed: {msg}")
        # Try individual links as fallback
        if "foreign key" in str(msg).lower():
            print("  → Trying individual links...")
            ok = 0
            for link in links_payload:
                r = mcp_call("link_entity_to_document", {
                    "entity_id": link["entity_id"],
                    "document_id": doc_id,
                    "role": link["role"],
                    "notes": link["notes"],
                })
                name = [n for n, role, notes in LINKS if ids.get(n) == link["entity_id"]]
                name = name[0] if name else "?"
                if r.get("success"):
                    print(f"    ✓ {name}")
                    ok += 1
                else:
                    print(f"    ✗ {name}: {r.get('error', r.get('message', ''))[:80]}")
            print(f"  Summary: {ok}/{len(links_payload)} individual links succeeded")


def fix_event_links(ids):
    """Re-link entities to events that failed."""
    print("\n" + "=" * 70)
    print("STEP 4: FIX EVENT-ENTITY LINKS")
    print("=" * 70)

    # Events 3, 4, 7 failed because they included Wexner/Dubin suspect IDs
    FIXES = [
        {
            "event_id": "f0f7f081-158e-48f2-bc30-c4a672b4e4cd",
            "title": "Wexner discovers theft",
            "entities": ["Leslie Wexner", "Jeffrey Epstein"],
        },
        {
            "event_id": "d7fa27d1-b7b0-4502-9be0-8f6c8bc9f6b7",
            "title": "Epstein returns $100M to Wexner",
            "entities": ["Leslie Wexner", "Jeffrey Epstein"],
        },
        {
            "event_id": "0a13e8ef-fdb9-4923-9732-53a4e7c25eaa",
            "title": "Maxwell directs victim to Dubin",
            "entities": ["Glenn Dubin", "Ghislaine Maxwell", "Jeffrey Epstein"],
        },
    ]

    for fix in FIXES:
        entity_ids = [ids[n] for n in fix["entities"] if ids.get(n)]
        if not entity_ids:
            print(f"  ✗ {fix['title']}: no valid entity IDs")
            continue

        print(f"  → {fix['title']}: linking {len(entity_ids)} entities...")
        result = mcp_call("link_entity_to_event", {
            "event_id": fix["event_id"],
            "entity_ids": entity_ids,
        })
        if result.get("success"):
            print(f"    ✓ Linked")
        else:
            msg = result.get("error", result.get("message", str(result)))
            print(f"    ✗ {msg[:100]}")


def fix_connections(doc_id, ids):
    """Create connections that failed due to suspect IDs."""
    print("\n" + "=" * 70)
    print("STEP 5: FIX CONNECTIONS")
    print("=" * 70)

    CONNECTIONS = [
        {
            "source": "Glenn Dubin", "target": "Ghislaine Maxwell",
            "type": "connected_to", "strength": 85, "evidence": "documented",
            "desc": "Maxwell directed victim to engage in sex acts with Dubin (EFTA02731082 p57). 'She had to do to Glen what she did for Epstein.'",
        },
        {
            "source": "Glenn Dubin", "target": "Jeffrey Epstein",
            "type": "connected_to", "strength": 90, "evidence": "documented",
            "desc": "$53.9M Highbridge Capital investment + Maxwell directed victim to 'do to Glen what she did for Epstein' (EFTA02731082 p57). Financial and sexual exploitation partnership.",
        },
        {
            "source": "Leslie Wexner", "target": "Jeffrey Epstein",
            "type": "connected_to", "strength": 95, "evidence": "documented",
            "desc": "Epstein stole 'several hundred million dollars' from Wexner; $100M settlement Jan 2008; source of 'virtually all of Epstein's wealth' (EFTA02731082 pp64-65).",
        },
        {
            "source": "Darren Indyke", "target": "Jeffrey Epstein",
            "type": "attorney_for", "strength": 90, "evidence": "documented",
            "desc": "Epstein's personal attorney; told assistant not to talk to police; brought computer to jail for 'video sex' (EFTA02731082 pp41,45).",
        },
    ]

    created = 0
    for conn in CONNECTIONS:
        src_id = ids.get(conn["source"])
        tgt_id = ids.get(conn["target"])
        label = f"{conn['source']} → {conn['target']}"

        if not src_id or not tgt_id:
            print(f"  ○ Skip {label}: missing UUID")
            continue

        result = mcp_call("create_connection", {
            "source_entity_id": src_id,
            "target_entity_id": tgt_id,
            "relationship_type": conn["type"],
            "description": conn["desc"],
            "strength": conn["strength"],
            "evidence_strength": conn["evidence"],
            "source_document_ids": [doc_id],
        })

        if result.get("success"):
            print(f"  ✓ {label} ({conn['type']}, strength={conn['strength']})")
            created += 1
        else:
            msg = result.get("error", result.get("message", str(result)))
            if "unique" in msg.lower() or "duplicate" in msg.lower():
                print(f"  ○ Already exists: {label}")
            else:
                print(f"  ✗ {label}: {msg[:100]}")

    print(f"\n  Summary: {created} connections created")


def verify(doc_id, ids):
    """Final verification."""
    print("\n" + "=" * 70)
    print("VERIFICATION")
    print("=" * 70)

    # Document
    doc = mcp_call("get_document", {"bates_number": "EFTA02731082"})
    if doc.get("success"):
        d = doc.get("data", {}).get("document", doc.get("data", {}))
        print(f"\n  Document:")
        print(f"    Title: {d.get('title', '?')[:70]}...")
        print(f"    Severity: {d.get('severity')}")
        print(f"    Summary: {len(d.get('summary', ''))} chars")

    # Dubin
    dubin_id = ids.get("Glenn Dubin")
    if dubin_id:
        entity = mcp_call("get_entity", {"entity_id": dubin_id})
        if entity.get("success"):
            e = entity.get("data", {}).get("entity", entity.get("data", {}))
            print(f"\n  Dubin:")
            print(f"    Tier: {e.get('tier')}")
            meta = e.get("metadata", {})
            ev = meta.get("evidence_summary", "") if isinstance(meta, dict) else ""
            print(f"    Evidence summary: {len(ev)} chars")

        conns = mcp_call("find_connections", {"entity_id": dubin_id})
        if conns.get("success"):
            conn_list = conns.get("data", [])
            print(f"    Connections: {len(conn_list)}")

    # Events
    events = mcp_call("search_events", {"query": "prosecution memo"})
    if events.get("success"):
        print(f"\n  Events:")
        print(f"    'prosecution memo': {events.get('count', 0)} results")

    events2 = mcp_call("search_events", {"query": "Wexner"})
    if events2.get("success"):
        print(f"    'Wexner': {events2.get('count', 0)} results")

    print("\n" + "=" * 70)
    print("DONE")
    print("=" * 70)


def main():
    print("EFTA02731082 — Fix Suspect → Entity Promotions + Re-run Failed Ops")
    print()

    # Re-lookup to get full IDs
    ids, suspects = get_full_ids()

    # Promote suspects
    ids = promote_suspects(ids, suspects)

    # Update Dubin
    update_dubin(ids.get("Glenn Dubin"))

    # Re-run entity-doc links
    rerun_entity_links(DOC_ID, ids)

    # Fix event links
    fix_event_links(ids)

    # Fix connections
    fix_connections(DOC_ID, ids)

    # Verify
    verify(DOC_ID, ids)


if __name__ == "__main__":
    main()
