# Link Layer Audit — brief and script

**Not started. Blocked by session-level execution restrictions on 31 Jul 2026.**
Run `links_audit.mjs` yourself, or start a fresh session and hand it this brief.

---

## Why this is the biggest remaining risk

| Table | Rows | Ever audited |
|---|---|---|
| `entity_documents` | **92,181** | no |
| `events` | 274 | no |
| `entity_connections` | 261 | no |
| `evidence_items` | **4** | — |

Four evidence items against ninety-two thousand links.

Every one of those links asserts *"this entity appears in this document."*
**No document in the corpus has content** — `file_url` and `extracted_text` are
null across all 1,380,395 records. So whatever produced 92,181 links did it
without reading a page. The link layer is what powers "appears in N documents"
on every profile, and it is the numeric backbone of the whole platform.

The entity audit found **128 of 151 records defective**, with errors running
almost entirely in one direction — toward naming people. There is no reason to
expect a layer built by the same process, at 600× the volume, with no human
ever looking at it, to be better.

---

## What the script answers

`links_audit.mjs` (delivered alongside this) reports:

1. **How many links carry an `excerpt`** — a quote supporting the link. If this
   is at or near zero, the links are name-matches, not evidence, and every
   document count on every profile is unsupported.
2. **How many carry a `page_number`.** Same test, stricter.
3. **What `role_in_document` values exist** — "mentioned" everywhere means no
   semantic work was done; a real distribution (author / recipient / subject)
   suggests something parsed structure.
4. **Link counts per entity.** A person with 20,000 links against a corpus with
   no text is a red flag for surname collision — "Jane," "Ion," "Gerd," and the
   `Mr. X` aliases are the obvious blast radius.
5. **Orphan links** — links whose `entity_id` no longer resolves.

## What to do with the answers

- **`excerpt` count ≈ 0** → the link layer is not evidence. Stop displaying
  document counts on profiles until links can be regenerated from real text.
- **One entity holding a huge share of links** → almost certainly substring
  matching on a common surname. Sample 20 of that entity's links by hand.
- **Links to aliases** (`Mr. Mody`, `Mr. Sant`, etc.) → these names were
  declared FALSE by the victim. Any document linked to them is linked to a
  fiction, and the link must be dissolved rather than reassigned.

## The likely honest outcome

The link layer probably has to be **regenerated from scratch after documents
have real text**, not repaired. That is not a loss — it was never built from
evidence, so there is nothing to preserve. Deleting 92,181 unsupported
assertions is a correction, not a setback.

---

## Sequence I'd suggest

1. Run `efta_entity_audit_migration.sql` — 25 unsafe records are still live.
2. Run `efta_audit_addendum_victim_default.sql` — Ion, Shuliak, and a trigger
   that structurally prevents publishing a victim record without a recorded
   consent basis.
3. Run `links_audit.mjs`, read the excerpt count first.
4. Fix the stale project docs — v2.0 still reads "Mr. Goodlatte (possibly
   Rep. Bob Goodlatte, R-VA)" for a name the victim wrote was false.
5. Verify `efta-diff` (`python -m pytest tests/ -v`). Test 2 is the gate.
6. Then ingest DS12 — 154 documents, the smallest dataset, and the thing that
   unblocks citations, the diff tool, and any regeneration of the link layer.
