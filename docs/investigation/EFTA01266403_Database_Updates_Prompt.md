# EFTA01266403 Trust Document — Database Updates

## Context

We completed a full read of EFTA01266403, a 24-page "Amendment and Restatement of the Jeffrey E. Epstein 2014 Trust" dated May 1, 2015. Full analysis at `docs/investigation/EFTA01266403_Analysis.md`. This document locks findings into Supabase via MCP tools.

EFTA01266403 already exists in the database (created during the Staley investigation session). It needs a metadata update plus new entity links, connections, and events.

## 1. Update Existing Document Record

Use `update_document` for EFTA01266403:

```
bates_number: "EFTA01266403"
title: "Amendment and Restatement of the Jeffrey E. Epstein 2014 Trust"
document_type: "trust_document"
original_date: "2015-05-01"
summary: "Revocable inter vivos trust governed by USVI law. Grantor: Jeffrey E. Epstein. Trustees: Darren K. Indyke (personal attorney), James E. Staley (future Barclays CEO), David Mitchell. Each trustee receives $250,000/year compensation. Primary beneficiary: Celina Edith Dubin (Glenn Dubin's daughter) — receives all four major Epstein properties (NYC townhouse via Maple Inc., Little St. James via Nautilus Inc., Zorro Ranch via Cypress Inc., Paris apartment via SCI JEP) plus $20M in operating expense funds plus 100% of residuary estate. Contingent beneficiary: Eva Andersson-Dubin (Glenn's wife), then MIT. Karyna Shuliak receives Palm Beach property via Laurel Inc. + $10M bequest. Cash bequests total ~$85M to 22 named individuals (7 redacted females at $5M each). Indyke receives $5M bequest + full debt cancellation. Richard Kahn (accountant) receives $2M + full debt cancellation. Lesley Groff receives $1M. Loan forgiveness for 20+ individuals including Mark Epstein. Eva Andersson-Dubin is also first successor trustee. Schedule A (trust property) not included in document. Staley signed under oath in New York, May 2015 — 7 months before becoming Barclays CEO. No resignation document found in 1.38M-document corpus."
review_notes: "CRITICAL trust document. Reveals: (1) Staley's formal fiduciary relationship + $250K/yr compensation from Epstein; (2) Celina Dubin as primary beneficiary of entire estate — evidence of deep Dubin-Epstein financial entanglement beyond social acquaintance; (3) Shell company structure for all properties (each held by separate USVI corporation); (4) Eva Andersson-Dubin as successor trustee + contingent beneficiary; (5) 7 redacted female beneficiaries at $5M each. Schedule A (trust property) missing from production. Related docs: EFTA01266380 (original Nov 2014), EFTA01266427 (first amendment)."
classification: "high"
severity: "critical"
```

## 2. Entity Lookups

Use `lookup_person` for each. Record UUIDs or mark as CREATE/SKIP.

| Name | Expected | If missing |
|------|----------|-----------:|
| Jeffrey Epstein | In DB (Tier 1) | Critical — halt |
| Jes Staley | In DB (32632113...) | — |
| Darren Indyke | In DB (61620f6e..., Tier 6) | — |
| Ghislaine Maxwell | In DB | — |
| Glenn Dubin | In DB (c8b4057b..., Tier 1) | — |
| Lesley Groff | In DB (Tier 6) | — |
| Mark Epstein | May exist | Create as T4 if missing |
| Lawrence Visoski | May exist or suspect | Create as T6 if missing |

New entities to create (see Section 4):
- David Mitchell
- Celina Edith Dubin
- Eva Andersson-Dubin
- Karyna Shuliak
- Richard D. Kahn

## 3. Create New Entities

### 3A. David Mitchell

```
name: "David Mitchell"
tier: 6
category: "financial"
entity_type: "person"
bio: "Third trustee of the Jeffrey E. Epstein 2014 Trust alongside Darren Indyke and Jes Staley. Signed as trustee May 2015, notarized in New York. Identity beyond trust role unclear — email EFTA02089008 requests his office address."
aliases: ["David Mite ell"]  # OCR variant from signature page
metadata.evidence_summary: "Named as trustee in EFTA01266403 (Epstein 2014 Trust Amendment, May 1, 2015). Entitled to $250,000/year trustee compensation. Signed under oath. Notarized in New York. Co-trustee with Indyke and Staley."
```

### 3B. Celina Edith Dubin

```
name: "Celina Edith Dubin"
tier: 4
category: "associate"
entity_type: "person"
bio: "Daughter of Glenn Dubin and Eva Andersson-Dubin. Primary beneficiary of the Jeffrey E. Epstein 2014 Trust — receives all four major Epstein properties (NYC, Little St. James, Zorro Ranch, Paris) plus $20M in operating funds plus 100% of residuary estate."
aliases: ["Celina Dubin"]
metadata.evidence_summary: "Named as primary beneficiary in EFTA01266403 (Epstein 2014 Trust). Receives: 9 East 71st St NYC (via Maple Inc.), Little St. James Island (via Nautilus Inc.), Zorro Ranch NM (via Cypress Inc.), 22 Avenue Foch Paris (via SCI JEP), $20M operating funds, 100% residuary estate. Father Glenn Dubin is Tier 1 (EFTA02731082: Maxwell directed victim to Dubin). The bequest of essentially the entire Epstein fortune to the daughter of an alleged abuser raises serious questions about the nature of the Epstein-Dubin relationship."
```

### 3C. Eva Andersson-Dubin

```
name: "Eva Andersson-Dubin"
tier: 4
category: "associate"
entity_type: "person"
bio: "Swedish-born physician. Wife of Glenn Dubin. Named as first successor trustee and contingent beneficiary of the entire Epstein 2014 Trust. If daughter Celina predeceases Epstein, Eva receives 100% of the estate."
aliases: ["Eva Andersson Dubin", "Eva Dubin"]
metadata.evidence_summary: "Named as first successor trustee (Section 7.1) and contingent residuary beneficiary (Section 2.4.B) in EFTA01266403 (Epstein 2014 Trust). Also receives property trust remainders upon Celina's death (Section 3.1D). Referenced in EFTA02731082 p57: 'Eva Dubin present during a directed massage.' Combined with husband Glenn's Tier 1 status, the Dubin family's role in the Epstein network was financial, fiduciary, and — per the prosecution memo — potentially participatory."
```

### 3D. Karyna Shuliak

```
name: "Karyna Shuliak"
tier: 4
category: "associate"
entity_type: "person"
bio: "Epstein girlfriend. Receives $10M bequest and Palm Beach property (358 El Brillo Way via Laurel Inc.) plus $1M operating expenses in the 2014 Trust."
aliases: []
metadata.evidence_summary: "Named in EFTA01266403 (Epstein 2014 Trust): $10M cash bequest (Section 2.3.A.3) plus 358 El Brillo Way, Palm Beach (Section 2.3.A.31) via Laurel Inc. (USVI corporation). Also receives loan forgiveness (Section 2.3.A.23.r — listed as Karyna Shuliak). Reported elsewhere as Epstein's girlfriend at time of arrest in 2019."
```

### 3E. Richard D. Kahn

```
name: "Richard D. Kahn"
tier: 6
category: "financial"
entity_type: "person"
bio: "Epstein's accountant. Received $2M trust bequest plus full cancellation of all debts to Epstein and his entities. Referenced in EFTA02731082 as the person Epstein directed to wire $250,000 to an assistant days after the Miami Herald series."
aliases: ["Richard Kahn", "Rich Kahn"]
metadata.evidence_summary: "Named in EFTA01266403 (Epstein 2014 Trust): $2M bequest (Section 2.3.A.13), full debt cancellation including spouse Lisa Kahn and entity Coatue Enterprises LLC (Section 2.3.A.25). Referenced in EFTA02731082 p48 as 'accountant Rich Kahn' directed to wire $250,000 to assistant after Miami Herald series. Deeply embedded in Epstein financial infrastructure."
```

## 4. Entity-Document Links

Use `batch_link_entities_to_document` for EFTA01266403. Create links for all identified entities.

**Note:** Check what links already exist from the Staley investigation session before creating.

| Entity | Role | Key Detail |
|--------|------|-----------|
| Jeffrey Epstein | subject | Grantor of the trust |
| Jes Staley | subject | Named trustee, signed under oath, $250K/yr compensation |
| Darren Indyke | subject | Named trustee + $5M beneficiary + debt cancelled |
| David Mitchell | subject | Named trustee, signed under oath |
| Celina Edith Dubin | mentioned | Primary beneficiary of all major properties + residuary |
| Eva Andersson-Dubin | mentioned | First successor trustee + contingent beneficiary |
| Glenn Dubin | mentioned | Father of primary beneficiary (not named directly but Celina/Eva are Dubins) |
| Karyna Shuliak | mentioned | $10M bequest + Palm Beach property |
| Lesley Groff | mentioned | $1M bequest |
| Richard D. Kahn | mentioned | $2M bequest + debt cancelled |
| Mark Epstein | mentioned | Loan forgiveness |
| Lawrence Visoski | mentioned | $1M bequest + loan forgiveness (Epstein's pilot) |

## 5. Create New Timeline Events

### Event 1: Trust Amendment Executed
```
title: "Epstein 2014 Trust amended and restated with Indyke, Staley, Mitchell as trustees"
date: "2015-05-01"
date_precision: "day"
event_type: "legal"
description: "Jeffrey E. Epstein executes Amendment and Restatement of the 2014 Trust in USVI. Trustees: Darren K. Indyke (personal attorney), James E. Staley (future Barclays CEO), David Mitchell. Trust is revocable, governed by USVI law. Primary beneficiary: Celina Edith Dubin. Each trustee compensated $250,000/year. Trustees sign separately in New York. Original trust dated November 18, 2014 (EFTA01266380)."
source_documents: ["EFTA01266403"]
```
Link to: Jeffrey Epstein, Jes Staley, Darren Indyke, David Mitchell

### Event 2: Staley Signs as Trustee
```
title: "Staley signs as trustee of Epstein 2014 Trust under oath in New York"
date: "2015-05-01"
date_precision: "month"
event_type: "legal"
description: "James E. Staley signs the Amendment and Restatement of the Epstein 2014 Trust as trustee, notarized in New York by Imbie Avdiu (Richmond County). Accepts $250,000/year compensation and broad fiduciary powers over Epstein's assets. Seven months later (December 2015) Staley becomes Barclays CEO. No resignation from trust found in EFTA corpus."
source_documents: ["EFTA01266403"]
```
Link to: Jes Staley

## 6. Create New Entity Connections

Check existing connections first with `find_connections`.

| Source | Target | Type | Strength | Description |
|--------|--------|------|----------|-------------|
| Celina Dubin | Jeffrey Epstein | connected_to | 95 | Primary beneficiary of Epstein 2014 Trust — all 4 properties + residuary estate (EFTA01266403) |
| Celina Dubin | Glenn Dubin | connected_to | 100 | Daughter of Glenn Dubin |
| Eva Andersson-Dubin | Jeffrey Epstein | connected_to | 90 | Successor trustee + contingent beneficiary of entire estate; present during directed massage (EFTA02731082 p57) |
| Eva Andersson-Dubin | Glenn Dubin | connected_to | 100 | Wife of Glenn Dubin |
| David Mitchell | Jeffrey Epstein | connected_to | 90 | Co-trustee of Epstein 2014 Trust, signed under oath May 2015 |
| David Mitchell | Darren Indyke | connected_to | 85 | Co-trustees of Epstein 2014 Trust |
| David Mitchell | Jes Staley | connected_to | 85 | Co-trustees of Epstein 2014 Trust |
| Richard Kahn | Jeffrey Epstein | connected_to | 90 | Epstein's accountant; $2M bequest + all debt cancelled; wired $250K witness payment (EFTA02731082) |
| Karyna Shuliak | Jeffrey Epstein | connected_to | 90 | $10M bequest + Palm Beach property; girlfriend |

**Note:** Check if Indyke↔Epstein and Staley↔Epstein connections already exist. If so, update description/strength with trust evidence.

## 7. Suspect Watchlist Additions

Add to suspect watchlist for future investigation:

| Name | Category | Priority | Notes |
|------|----------|----------|-------|
| Luciano A. Fontanilla, Jr. | staff | medium | $2M bequest + loan forgiveness |
| Rosalyn V. Fontanilla | staff | low | $2M bequest (shared) + loan forgiveness |
| Michelle Fern Saipher | associate | low | Indyke's spouse, debt cancelled |
| Lisa Kahn | associate | low | Richard Kahn's spouse, debt cancelled |
| Gaddo Cardini | associate | low | Loan forgiveness |
| Adam Bly | associate | medium | Loan forgiveness — science publisher, known Epstein associate |
| Steven Hanson | associate | low | Named successor trustee #2 |
| Joseph Pagano | associate | low | Named successor trustee #3 |
| Steven Victor | associate | low | Loan forgiveness |
| Ann Rodriguez | staff | low | $500K bequest |
| Valdson Viera Contrin | staff | low | $500K bequest |

## 8. Verification

After all updates:
- `get_document("EFTA01266403")` — confirm updated metadata
- `get_entity` for David Mitchell, Celina Dubin, Eva Andersson-Dubin — confirm creation
- `find_connections` for Celina Dubin — confirm Epstein + Glenn Dubin connections
- `find_connections` for David Mitchell — confirm 3 connections (Epstein, Indyke, Staley)
- `search_events("Epstein 2014 Trust")` — confirm 2 new events

## Notes

- The 7 redacted female beneficiaries ($5M each) are likely known Epstein associates or former victims. We do not speculate on identities in database records.
- SLK DESIGNS, LLC (loan forgiveness) may be connected to Sarah Kellen — the initials SLK match Sarah Lauren Kellen. Do not assert this connection without confirmation.
- Schedule A is missing from the production. This means the actual trust property at the time of execution is unknown from this document alone.
- EFTA01266380 (original November 2014 trust) and EFTA01266427 (first amendment) should be read next to determine: (a) whether Staley was in the original or added in the amendment, (b) what changed after May 2015.
- The trust structure (each property in a separate USVI corporation) is a classic asset protection arrangement. Combined with USVI governing law and the situs transfer power, this trust was designed for maximum opacity and control.
