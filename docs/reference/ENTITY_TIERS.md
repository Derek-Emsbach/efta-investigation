# Entity Tier Classification System

## Overview

Every entity (person, organization, property) is assigned one of six evidence tiers. Tiers reflect the **strength and nature of documented evidence**, NOT guilt. Tier assignments are based solely on primary source documentation and can change as new evidence emerges.

**CRITICAL: Presence in the database does NOT establish criminal conduct.**

## Tier Definitions

### TIER 1: Direct Evidence
**Color:** Deep Red (#DC2626)
**Criteria:** Forensically authenticated direct evidence of involvement: convicted in court, formally charged, or named as abuser in forensically authenticated victim journals. The label reflects evidence strength, not prosecution status — an entity may be Tier 1 without ever being charged if direct evidence (e.g., authenticated journal entries) exists.
**Examples:** Jeffrey Epstein (convicted, deceased), Ghislaine Maxwell (convicted), Leon Black (named in authenticated journals, uncharged)
**Evidence standard:** Court records, formal charges, forensically verified victim testimony

### TIER 2: Immunized
**Color:** Amber (#F59E0B)
**Criteria:** Identified in the 2007 Non-Prosecution Agreement as co-conspirators who received blanket immunity. FBI evidence documents their operational roles. Never charged due to immunity provision.
**Examples:** Sarah Kellen, Nadia Marcinkova, Adriana Ross, Lesley Groff
**Evidence standard:** NPA document, FBI investigative files

### TIER 3: Circumstantial
**Color:** Orange (#F97316)
**Criteria:** Documentary evidence of conduct raising serious questions: sexual allegations from victims, communications suggesting awareness of criminal activity, behavioral patterns consistent with participation. No direct evidence — circumstantial indicators that warrant scrutiny but do not prove criminal conduct.
**Includes:** The 21 partially identified "Mr." names from victim journals
**Evidence standard:** Victim allegations, suspicious communications, behavioral patterns

### TIER 4: Associated
**Color:** Gray (#6B7280)
**Criteria:** Documented contact with Epstein (emails, meetings, flights, payments) but no evidence of awareness of or participation in criminal activity. Contact may reflect Epstein's social strategy rather than complicity.
**Evidence standard:** Flight logs, emails, event attendance, financial transactions without criminal context

### TIER 5: Victim / Witness
**Color:** Teal (#14B8A6)
**Criteria:** Identified victims of the operation or witnesses who provided testimony/statements. Includes victim-turned-recruiters who were themselves minors when recruited.
**Privacy rule:** Names used ONLY where the individual has publicly self-identified or been officially named in public court proceedings. Entity records have `is_public` flag — if false, display as "Victim [number]" or "Witness [number]".
**Evidence standard:** Court records, self-identification, FBI 302 statements

### TIER 6: Peripheral
**Color:** Slate (#64748B)
**Criteria:** Individuals in the broader ecosystem: household staff, pilots, estate executors, investigating officers, prosecutors, defense attorneys. Operational relevance without evidence of criminal participation (unless separately tiered).
**Evidence standard:** Employment records, investigation records, court filings

## Display Rules

### Entity Profile Page
- Tier badge always displayed prominently next to entity name
- Tier justification text visible (why this tier was assigned)
- "Change history" showing if tier was ever updated and why

### Entity Lists/Tables
- Tier badge in its own column
- Color-coded for quick scanning
- Filterable by tier

### Network Graph
- Node color = tier color
- Node border = tier color at full opacity
- Victim nodes (Tier 5) have special treatment — no outgoing connection lines unless relevant

### Evidence Requirements by Tier
- **Tier 1-2:** MUST have primary source citation (EFTA number or court document)
- **Tier 3:** MUST have at least one primary source or two corroborating secondary sources
- **Tier 4:** Requires documented contact evidence
- **Tier 5-6:** Requires identification in investigation records

## Tier Migration Rules

Entities can move between tiers as evidence emerges:
- Tier 4 → Tier 3: New victim allegation or suspicious communication discovered
- Tier 3 → Tier 1: Formal charges filed or forensically verified victim testimony
- Tier 3 → Tier 4: Evidence reassessed as insufficient for suspicion
- Never: Tier 5 → any other tier (victims remain victims)
- Never: Decrease tier without documenting why
