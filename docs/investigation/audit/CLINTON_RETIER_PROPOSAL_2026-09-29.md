# Proposal: Re-tier "Bill Clinton" (entity 46f154b9)

**Status:** APPROVED by Derek on 2026-10-02 and APPLIED (tier 4, new tier_justification, hold kept). Citations still pending.
**Date:** 2026-09-29
**Current record:** T1, `unclassified_pending_review`, unpublished. The 2026-07-31 audit hold (`hold-unsubstantiated-attribution`) is still active.

## Why T1 fails

The T1 basis is "named in a victim journal." That claim fails for three reasons:

1. **There is no citation.** "Clinton" appears nowhere in EFTA02731420, EFTA02731465 or EFTA00155037. The 2026-09-24 run reviewed the full text of all three. The one candidate passage (EFTA02731465 p.2 / EFTA00155037 p.12) is an unnamed allusion ("the old president," "Chelsea"). Meanwhile the diarist names other people directly on the pages around it.
2. **The attribution is wrong.** The journal belongs to the Doe v. Black plaintiff (1:23-cv-06418 / 1:22-cv-10019), not to Virginia Giuffre.
3. **The journal is not authenticated.** LaPorte could not date the entries, Rakoff denied the authentication claim on 2024-07-31, and the Clarke redaction order (ECF 388) covers third-party names.

The record also asserts **NPA immunity**. The audit flagged that as unsupported, because the co-conspirator clause was SDFL-limited and named four women.

## What the record actually has

The tier_justification lists: "26+ flights on Epstein aircraft," "unnamed official on 2002 Africa trip," "contact directory listing," and "property visits documented." **None of these carries a Bates cite in the record.** The 100 `entity_documents` links are bulk `mentioned` tags with no page references or quotes.

## Proposed disposition

**T4 (Social/Professional Contact), provisional.** Keep the hold. Unpublished.

- Strike: "Named in Giuffre victim journals," "forensically authenticated," "NPA blanket immunity."
- Keep, **only once each has a Bates cite attached**: the flight count, the 2002 Africa trip, and the contact-book listing.
- Keep the journal allusion as `candidate_lead_unconfirmed` metadata (already present). Do not treat it as tier evidence.

**T3 would need** a primary-source allegation or evidence of awareness, with a page cite. The first source to check is Giuffre v. Maxwell (15-cv-7433) deposition material unsealed in January 2024, which is not yet in the corpus index. Any hearsay there, such as statements attributed to Epstein about Clinton, must be recorded as hearsay, not as conduct.

## Draft tier_justification (to apply on approval)

> T4 (provisional; publication hold). Documented social and travel contact with Epstein: [flight count — cite], [2002 Africa trip — cite], [contact-book entry — cite]. A prior T1 classification was based on a claim that he is named in a victim journal. Full-text review (2026-09-24) found no such naming. The journal in question belongs to the Doe v. Black plaintiff, not Giuffre, and has not been forensically authenticated. It contains only an unnamed allusion, which is held as an unconfirmed lead. No primary-source allegation of criminal conduct is cited in this record. Re-tier upward only on a page-cited allegation.

## Approval

- [x] Derek approves T4 provisional + text above (2026-10-02; applied without bracket placeholders, citations marked pending)
- [x] Citations attached for flights / Africa trip / contact book (2026-10-07 daily-investigation run): flight count -> EFTA01297437 p.12 (press, secondary); 2002 Africa trip -> EFTA01649149 p.1 / dup EFTA01649143 (FBI CID doc, primary); contact-book entry -> EFTA01082182 p.22 / dups EFTA00599855, EFTA01122242 (press quoting court papers, secondary). `tier_justification` rewritten with all three cites; 3 `entity_documents` links added (role: mentioned). Tier (4), category, `is_public` (false), `profile_published` (false), and the publication hold were NOT touched.
