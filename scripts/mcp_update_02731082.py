#!/usr/bin/env python3
"""
EFTA02731082 Database Updates via MCP
Locks prosecution memo analysis findings into Supabase.
Run: python3 scripts/mcp_update_02731082.py
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
    except Exception as e:
        return {"error": str(e)}

    # Parse SSE: find last data: line with JSON-RPC result
    for line in reversed(body.strip().split("\n")):
        if line.startswith("data:"):
            try:
                rpc = json.loads(line[5:].strip())
                if "result" in rpc and "content" in rpc["result"]:
                    text = rpc["result"]["content"][0].get("text", "")
                    # Try to parse the text as JSON
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        # Text might have a JSON prefix followed by raw text
                        # Try to find the JSON object at the start
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
    """Lookup entity by name, return {id, name, tier} or None."""
    result = mcp_call("lookup_person", {"name": name})
    if not result.get("success"):
        return None
    data = result.get("data", {})
    # Check entity_matches first
    entities = data.get("entity_matches", [])
    if entities:
        e = entities[0]
        return {"id": e["id"], "name": e["name"], "tier": e.get("tier")}
    # Check suspect_matches
    suspects = data.get("suspect_matches", [])
    if suspects:
        s = suspects[0]
        return {"id": s.get("entity_id") or s["id"], "name": s["name"], "type": "suspect", "suspect_id": s["id"]}
    return None


def get_document(bates: str) -> dict | None:
    """Get document by bates number, return {id, title, ...} or None."""
    result = mcp_call("get_document", {"bates_number": bates})
    if not result.get("success"):
        return None
    doc = result.get("data", {}).get("document", result.get("data", {}))
    return doc


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: LOOKUPS
# ═══════════════════════════════════════════════════════════════════════════════

def phase1_lookups():
    print("\n" + "=" * 70)
    print("PHASE 1: LOOKUPS")
    print("=" * 70)

    # Document lookup
    print("\n→ Looking up EFTA02731082...")
    doc = get_document("EFTA02731082")
    if not doc:
        print("  ✗ EFTA02731082 not found! Halting.")
        sys.exit(1)
    doc_id = doc.get("id")
    print(f"  ✓ DOC_ID = {doc_id}")
    print(f"    Current title: {doc.get('title', '(none)')}")
    print(f"    Current severity: {doc.get('severity', '(none)')}")

    # Entity lookups
    MUST_EXIST = [
        "Jeffrey Epstein", "Jes Staley", "Leon Black", "Ghislaine Maxwell",
        "Jean-Luc Brunel", "Prince Andrew", "Alan Dershowitz", "Bill Clinton",
        "Harvey Weinstein", "Leslie Wexner", "Leslie Groff",
    ]
    MAY_EXIST = ["Glenn Dubin", "Darren Indyke"]

    uuids = {}
    print("\n→ Looking up entities...")
    for name in MUST_EXIST + MAY_EXIST:
        result = lookup_person(name)
        required = name in MUST_EXIST
        if result:
            uid = result["id"]
            uuids[name] = uid
            tier_info = f" (T{result['tier']})" if result.get("tier") else ""
            stype = f" [{result['type']}]" if result.get("type") == "suspect" else ""
            print(f"  ✓ {name}: {uid[:8]}...{tier_info}{stype}")
        elif required:
            print(f"  ✗ {name}: NOT FOUND — HALTING (required entity)")
            sys.exit(1)
        else:
            uuids[name] = None
            print(f"  ○ {name}: not found (optional, will handle)")

    return doc_id, uuids


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: UPDATE DOCUMENT RECORD
# ═══════════════════════════════════════════════════════════════════════════════

def phase2_update_document(doc_id: str):
    print("\n" + "=" * 70)
    print("PHASE 2: UPDATE DOCUMENT RECORD")
    print("=" * 70)

    summary = (
        "Sealed Grand Jury 6(e) prosecution memo from SDNY AUSAs to U.S. Attorney Geoffrey Berman. "
        "Evaluates charging Epstein co-conspirators after his death. Documents 24 minor victims (ages 13-17), "
        "14 adult victims, 3 subject interviews, 4 non-victim witnesses — all interviewed Jul-Dec 2019. "
        "Key findings: (1) Staley raped victim during directed massage at Epstein's NYC residence ~2011-2012, "
        "corroborated by JPMorgan-produced messages (p32, fn61 p67); (2) Black sexually assaulted victim in "
        "separate incident (p32); (3) Weinstein attempted assault during directed massage at Paris residence (p14); "
        "(4) Maxwell directed victim to have sex with Prince Andrew and Glen Dubin (p57); (5) Clinton traveled "
        "on Epstein's jet to Africa with Maxwell and 4 young women (pp28,37); (6) Epstein stole 'several hundred "
        "million dollars' from Wexner — explaining 'virtually all of Epstein's wealth' (pp64-65); (7) Groff "
        "scheduled NYC massages 2001-2019, invoked Fifth Amendment; (8) Indyke told assistant not to talk to "
        "police (p41); (9) Epstein directed destruction of computers and contact directories during FL "
        "investigation (pp40-41). Charging analysis (pp68-85) is 95-98% redacted — institutional decisions "
        "completely hidden while victim trauma fully exposed. Memo recommends Maxwell charges (fn62 p72). "
        "Evaluates 5 subjects: 3 redacted + Groff + Maxwell. Original SDNY bates range: EFTA00022461-EFTA00022546."
    )

    review_notes = (
        "CRITICAL document. Full analysis complete. Redaction pattern: pp0-67 ~15-25% redacted (victim names); "
        "pp68-85 ~95-98% redacted (entire charging analysis/recommendations). Category C institutional protection "
        "— public sees all victim trauma, none of the government's decisions. Original bates numbering visible "
        "in footers."
    )

    result = mcp_call("update_document", {
        "document_id": doc_id,
        "title": "SDNY Co-Conspirator Prosecution Memo — Investigation into Potential Co-Conspirators of Jeffrey Epstein",
        "document_type": "prosecution_memo",
        "date": "2019-12-19",
        "classification": "high",
        "severity": "extreme_critical",
        "summary": summary,
        "review_notes": review_notes,
    })

    if result.get("success"):
        print("  ✓ Document record updated")
    else:
        print(f"  ✗ Update failed: {result}")
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3: GLENN DUBIN — CREATE OR UPDATE
# ═══════════════════════════════════════════════════════════════════════════════

DUBIN_EVIDENCE = (
    "EFTA02731082 p57: Maxwell told victim 'she had to do to Glen what she did for Epstein.' "
    "Eva Dubin present during a directed massage. This is prosecution memo evidence (Grand Jury "
    "6(e) material) of Maxwell directing sexual contact between a victim and Dubin — not mere "
    "association. Combined with DS9 financial partnership ($53.9M Highbridge Capital investment, "
    "$3.8M Jeepers/DB Zwirn partnership) and Giuffre testimony, evidence supports Tier 1."
)


def phase3_dubin(uuids: dict) -> str | None:
    print("\n" + "=" * 70)
    print("PHASE 3: GLENN DUBIN — CREATE OR UPDATE")
    print("=" * 70)

    dubin_id = uuids.get("Glenn Dubin")

    if dubin_id:
        print(f"  → Dubin exists: {dubin_id[:8]}...")
        # Read existing entity to check for existing evidence_summary
        existing = mcp_call("get_entity", {"entity_id": dubin_id})
        existing_summary = ""
        if existing.get("success"):
            entity_data = existing.get("data", {}).get("entity", existing.get("data", {}))
            meta = entity_data.get("metadata", {})
            if isinstance(meta, dict):
                existing_summary = meta.get("evidence_summary", "")
            current_tier = entity_data.get("tier")
            print(f"    Current tier: {current_tier}")
            if existing_summary:
                print(f"    Has existing evidence_summary ({len(existing_summary)} chars)")

        # Merge evidence summaries
        if existing_summary and DUBIN_EVIDENCE not in existing_summary:
            merged = existing_summary + "\n\n" + DUBIN_EVIDENCE
        else:
            merged = DUBIN_EVIDENCE

        result = mcp_call("update_entity", {
            "entity_id": dubin_id,
            "tier": 1,
            "category": "alleged_abuser",
            "evidence_summary": merged,
            "add_aliases": ["Glen Dubin", "G. Dubin"],
        })
        if result.get("success"):
            print("  ✓ Dubin updated to Tier 1")
        else:
            print(f"  ✗ Update failed: {result}")
        return dubin_id

    else:
        print("  → Dubin not found, creating new entity...")
        result = mcp_call("create_entity", {
            "name": "Glenn Dubin",
            "tier": 1,
            "entity_type": "person",
            "category": "alleged_abuser",
            "bio": "Hedge fund billionaire (Highbridge Capital Management). Maxwell directed victim to engage in sex acts with him. Eva Dubin present during directed massage. $53.9M Highbridge Capital investment with Epstein.",
            "evidence_summary": DUBIN_EVIDENCE,
            "aliases": ["Glen Dubin", "G. Dubin"],
        })
        if result.get("success"):
            new_id = result.get("id") or result.get("data", {}).get("id")
            print(f"  ✓ Dubin created: {new_id}")
            uuids["Glenn Dubin"] = new_id
            return new_id
        else:
            # Check if blocked by duplicate guard
            msg = result.get("message", str(result))
            print(f"  ✗ Create failed: {msg}")
            # If duplicate found, extract the ID
            if "already exists" in msg.lower() or "similar" in msg.lower():
                matches = result.get("data", {}).get("matches", [])
                if matches:
                    existing_id = matches[0].get("id")
                    print(f"  → Found existing match: {existing_id}, updating instead...")
                    uuids["Glenn Dubin"] = existing_id
                    return phase3_dubin(uuids)  # Retry as update
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4: ENTITY-DOCUMENT LINKS
# ═══════════════════════════════════════════════════════════════════════════════

def phase4_entity_links(doc_id: str, uuids: dict):
    print("\n" + "=" * 70)
    print("PHASE 4: ENTITY-DOCUMENT LINKS")
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
        uid = uuids.get(name)
        if uid:
            links_payload.append({"entity_id": uid, "role": role, "notes": notes})
        else:
            skipped.append(name)

    if skipped:
        print(f"  ○ Skipping (no UUID): {', '.join(skipped)}")

    print(f"  → Linking {len(links_payload)} entities to document...")
    result = mcp_call("batch_link_entities_to_document", {
        "document_id": doc_id,
        "links": links_payload,
    })

    if result.get("success"):
        count = result.get("count", len(links_payload))
        print(f"  ✓ {count} entity-document links created/updated")
    else:
        print(f"  ✗ Batch link failed: {result}")
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5: CREATE EVENTS + LINK ENTITIES
# ═══════════════════════════════════════════════════════════════════════════════

def phase5_events(doc_id: str, uuids: dict):
    print("\n" + "=" * 70)
    print("PHASE 5: CREATE 7 EVENTS + LINK ENTITIES")
    print("=" * 70)

    EVENTS = [
        {
            "title": "SDNY co-conspirator prosecution memo delivered to U.S. Attorney Berman",
            "date": "2019-12-19",
            "date_precision": "day",
            "event_type": "legal",
            "description": (
                "86-page sealed prosecution memo evaluating charges against Epstein co-conspirators "
                "delivered to Geoffrey Berman. Documents 24 minor victims, 14 adult victims. Recommends "
                "separate Maxwell prosecution memo. Charging analysis for 3 redacted subjects + Groff "
                "completely redacted in EFTA release."
            ),
            "entities": ["Jeffrey Epstein"],
        },
        {
            "title": "Clinton travels on Epstein's jet to Africa with Maxwell and 4 young women",
            "date": "2002-01-01",
            "date_precision": "year",
            "event_type": "travel",
            "description": (
                "Adult Victim 1 traveled with Epstein and Maxwell on Epstein's private jet to Africa "
                "'with President Clinton.' Secret Service physician Dr. Gregory Bledsoe found it 'odd' "
                "that Epstein brought 4 young women on the trip. Victim raped approximately a dozen "
                "times over 3-year period."
            ),
            "entities": ["Bill Clinton", "Jeffrey Epstein", "Ghislaine Maxwell"],
        },
        {
            "title": "Wexner discovers Epstein stole 'several hundred million dollars'",
            "date": "2007-01-01",
            "date_precision": "year",
            "event_type": "financial",
            "description": (
                "Leslie Wexner discovered Epstein had stolen 'several hundred million dollars' from him, "
                "explaining 'virtually all of Epstein's wealth' according to SDNY prosecutors. Led to "
                "severance of ties. Wexner retained counsel for recovery."
            ),
            "entities": ["Leslie Wexner", "Jeffrey Epstein"],
        },
        {
            "title": "Epstein returns $100M to Wexner in settlement",
            "date": "2008-01-01",
            "date_precision": "month",
            "event_type": "financial",
            "description": (
                "Epstein paid Wexner approximately $100 million in January 2008 as part of settlement "
                "for the theft of 'several hundred million dollars.' This suggests the actual stolen "
                "amount was substantially larger than $100M."
            ),
            "entities": ["Leslie Wexner", "Jeffrey Epstein"],
        },
        {
            "title": "Epstein directs destruction of computers and contact directories",
            "date": "2005-06-01",
            "date_precision": "approximate",
            "event_type": "institutional",
            "description": (
                "During Florida criminal investigation, Epstein directed assistant to collect all contact "
                "books and computers from Palm Beach and give them to a man at the residence. Then directed "
                "shredding of Virgin Islands directories at Maxwell's NYC house. Computer-based masseuse "
                "scheduling directory never recovered by law enforcement (fn47 p49). Documented obstruction."
            ),
            "entities": ["Jeffrey Epstein", "Ghislaine Maxwell"],
        },
        {
            "title": "Epstein pays $250,000 to assistant days after Miami Herald series",
            "date": "2018-12-01",
            "date_precision": "month",
            "event_type": "financial",
            "description": (
                "Within days of the Miami Herald 'Perversion of Justice' series publication (November 2018), "
                "Epstein directed accountant Rich Kahn to wire $250,000 to [redacted assistant]. Assistant "
                "claims payment was unrelated to articles. Epstein instructed her not to tell anyone about it. "
                "SDNY probed this but assessment is in the redacted charging section."
            ),
            "entities": ["Jeffrey Epstein"],
        },
        {
            "title": "Maxwell directs victim to engage in sex acts with Glenn Dubin",
            "date": "2001-01-01",
            "date_precision": "approximate",
            "event_type": "personal",
            "description": (
                "Maxwell told victim 'she had to do to Glen what she did for Epstein.' Eva Dubin was "
                "present during a separate directed massage. Documented in SDNY prosecution memo Grand "
                "Jury 6(e) material."
            ),
            "entities": ["Glenn Dubin", "Ghislaine Maxwell", "Jeffrey Epstein"],
        },
    ]

    created_events = []
    for i, evt in enumerate(EVENTS, 1):
        print(f"\n  → Event {i}/7: {evt['title'][:60]}...")
        result = mcp_call("create_event", {
            "title": evt["title"],
            "date": evt["date"],
            "date_precision": evt["date_precision"],
            "event_type": evt["event_type"],
            "description": evt["description"],
            "source_document_id": doc_id,
        })

        if result.get("success"):
            event_id = result.get("id") or result.get("data", {}).get("id")
            print(f"    ✓ Created: {event_id}")

            # Link entities
            entity_ids = [uuids[n] for n in evt["entities"] if uuids.get(n)]
            if entity_ids:
                link_result = mcp_call("link_entity_to_event", {
                    "event_id": event_id,
                    "entity_ids": entity_ids,
                })
                if link_result.get("success"):
                    print(f"    ✓ Linked {len(entity_ids)} entities")
                else:
                    print(f"    ✗ Entity link failed: {link_result}")
            created_events.append(event_id)
        else:
            print(f"    ✗ Create failed: {result}")

    print(f"\n  Summary: {len(created_events)}/7 events created")
    return created_events


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 6: CONNECTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def phase6_connections(doc_id: str, uuids: dict):
    print("\n" + "=" * 70)
    print("PHASE 6: CONNECTIONS")
    print("=" * 70)

    dubin_id = uuids.get("Glenn Dubin")
    epstein_id = uuids.get("Jeffrey Epstein")
    maxwell_id = uuids.get("Ghislaine Maxwell")
    wexner_id = uuids.get("Leslie Wexner")
    clinton_id = uuids.get("Bill Clinton")
    indyke_id = uuids.get("Darren Indyke")

    # Check existing connections
    print("\n  → Checking existing connections...")
    existing_connections = {}
    for name, uid in [("Wexner", wexner_id), ("Clinton", clinton_id), ("Dubin", dubin_id)]:
        if uid:
            result = mcp_call("find_connections", {"entity_id": uid})
            conns = result.get("data", []) if result.get("success") else []
            existing_connections[name] = conns
            print(f"    {name}: {len(conns)} existing connections")

    def has_connection(conns, target_id, rel_type=None):
        """Check if a connection to target already exists."""
        for c in conns:
            a, b = c.get("entity_a"), c.get("entity_b")
            if target_id in (a, b):
                if rel_type is None or c.get("relationship_type") == rel_type:
                    return c
        return None

    CONNECTIONS = [
        {
            "source": dubin_id, "source_name": "Dubin",
            "target": maxwell_id, "target_name": "Maxwell",
            "type": "connected_to", "strength": 85, "evidence": "documented",
            "desc": "Maxwell directed victim to engage in sex acts with Dubin (EFTA02731082 p57). 'She had to do to Glen what she did for Epstein.'",
        },
        {
            "source": dubin_id, "source_name": "Dubin",
            "target": epstein_id, "target_name": "Epstein",
            "type": "connected_to", "strength": 90, "evidence": "documented",
            "desc": "$53.9M Highbridge Capital investment + Maxwell directed victim to 'do to Glen what she did for Epstein' (EFTA02731082 p57). Financial and sexual exploitation partnership.",
        },
        {
            "source": wexner_id, "source_name": "Wexner",
            "target": epstein_id, "target_name": "Epstein",
            "type": "connected_to", "strength": 95, "evidence": "documented",
            "desc": "Epstein stole 'several hundred million dollars' from Wexner; $100M settlement Jan 2008; source of 'virtually all of Epstein's wealth' (EFTA02731082 pp64-65).",
        },
        {
            "source": indyke_id, "source_name": "Indyke",
            "target": epstein_id, "target_name": "Epstein",
            "type": "attorney_for", "strength": 90, "evidence": "documented",
            "desc": "Epstein's personal attorney; told assistant not to talk to police; brought computer to jail for 'video sex' (EFTA02731082 pp41,45).",
        },
        {
            "source": clinton_id, "source_name": "Clinton",
            "target": epstein_id, "target_name": "Epstein",
            "type": "connected_to", "strength": 70, "evidence": "documented",
            "desc": "Africa trip on Epstein's jet with Maxwell and 4 young women (EFTA02731082 pp28,37); previously documented flight logs.",
        },
    ]

    created = 0
    updated = 0
    skipped = 0
    for conn in CONNECTIONS:
        src, tgt = conn["source"], conn["target"]
        label = f"{conn['source_name']} → {conn['target_name']}"

        if not src or not tgt:
            print(f"  ○ Skip {label}: missing UUID")
            skipped += 1
            continue

        # Check if connection already exists
        existing = has_connection(
            existing_connections.get(conn["source_name"], []),
            tgt, conn["type"]
        )

        if existing:
            # Update existing connection
            conn_id = existing["id"]
            result = mcp_call("update_connection", {
                "connection_id": conn_id,
                "description": conn["desc"],
                "strength": conn["strength"],
                "evidence_strength": conn["evidence"],
            })
            if result.get("success"):
                print(f"  ↻ Updated {label} ({conn['type']})")
                updated += 1
            else:
                print(f"  ✗ Update failed for {label}: {result}")
        else:
            # Create new connection
            result = mcp_call("create_connection", {
                "source_entity_id": src,
                "target_entity_id": tgt,
                "relationship_type": conn["type"],
                "description": conn["desc"],
                "strength": conn["strength"],
                "evidence_strength": conn["evidence"],
                "source_document_ids": [doc_id],
            })
            if result.get("success"):
                print(f"  ✓ Created {label} ({conn['type']}, strength={conn['strength']})")
                created += 1
            else:
                msg = str(result.get("message", result))
                if "unique" in msg.lower() or "duplicate" in msg.lower():
                    print(f"  ○ Already exists: {label}")
                else:
                    print(f"  ✗ Create failed for {label}: {msg}")

    print(f"\n  Summary: {created} created, {updated} updated, {skipped} skipped")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 7: VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def phase7_verify(doc_id: str, uuids: dict):
    print("\n" + "=" * 70)
    print("PHASE 7: VERIFICATION")
    print("=" * 70)

    # Verify document update
    print("\n  → Verifying document update...")
    doc = mcp_call("get_document", {"bates_number": "EFTA02731082"})
    if doc.get("success"):
        d = doc.get("data", {}).get("document", doc.get("data", {}))
        print(f"    Title: {d.get('title', '?')[:70]}...")
        print(f"    Severity: {d.get('severity', '?')}")
        print(f"    Classification: {d.get('classification', '?')}")
        print(f"    Summary: {len(d.get('summary', ''))} chars")
    else:
        print(f"    ✗ Could not verify: {doc}")

    # Verify Dubin
    dubin_id = uuids.get("Glenn Dubin")
    if dubin_id:
        print("\n  → Verifying Dubin entity...")
        entity = mcp_call("get_entity", {"entity_id": dubin_id})
        if entity.get("success"):
            e = entity.get("data", {}).get("entity", entity.get("data", {}))
            print(f"    Name: {e.get('name', '?')}")
            print(f"    Tier: {e.get('tier', '?')}")
            meta = e.get("metadata", {})
            ev_sum = meta.get("evidence_summary", "") if isinstance(meta, dict) else ""
            print(f"    Evidence summary: {len(ev_sum)} chars")

        print("\n  → Verifying Dubin connections...")
        conns = mcp_call("find_connections", {"entity_id": dubin_id})
        if conns.get("success"):
            conn_list = conns.get("data", [])
            print(f"    Connections: {len(conn_list)}")
            for c in conn_list:
                print(f"      - {c.get('relationship_type', '?')} (strength={c.get('strength', '?')})")

    # Quick event check
    print("\n  → Verifying events...")
    events = mcp_call("search_events", {"query": "prosecution memo"})
    if events.get("success"):
        count = events.get("count", 0)
        print(f"    'prosecution memo' search: {count} results")

    events2 = mcp_call("search_events", {"query": "Wexner"})
    if events2.get("success"):
        count = events2.get("count", 0)
        print(f"    'Wexner' search: {count} results")

    print("\n" + "=" * 70)
    print("COMPLETE")
    print("=" * 70)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("EFTA02731082 Database Updates via MCP")
    print("Source: docs/investigation/EFTA02731082_Database_Updates_Prompt.md")

    # Phase 1
    doc_id, uuids = phase1_lookups()

    # Phase 2
    phase2_update_document(doc_id)

    # Phase 3
    phase3_dubin(uuids)

    # Phase 4
    phase4_entity_links(doc_id, uuids)

    # Phase 5
    phase5_events(doc_id, uuids)

    # Phase 6
    phase6_connections(doc_id, uuids)

    # Phase 7
    phase7_verify(doc_id, uuids)


if __name__ == "__main__":
    main()
