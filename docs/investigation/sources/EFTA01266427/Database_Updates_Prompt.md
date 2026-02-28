# EFTA01266427 — Database Updates

## Context

Full analysis of the First Amendment to the Epstein 2014 Trust is at `Analysis.md` in this directory. The three-way trust comparison is at `../EFTA01266380/Analysis.md`. This document specifies the database changes needed to lock EFTA01266427 findings into Supabase.

## 1. Update or Create Document Record

EFTA01266427 may already exist in the `documents` table (it was part of the bulk import). Update with full analysis metadata:

```
bates_number: "EFTA01266427"
title: "First Amendment to the Amendment and Restatement of the Jeffrey E. Epstein 2014 Trust"
document_type: "trust_document"
original_date: "2015-09-01" (month precision — exact day illegible)
page_count: 6
summary: "6-page amendment to the A&R (EFTA01266403). Key changes: (1) Amendment power simplified — Epstein can now amend unilaterally by delivering to one trustee (was: all trustees must sign), making Indyke sole gatekeeper. (2) New Section 2.5 employment cliff — employee-beneficiaries must work for estate 1 year post-death or forfeit bequests; 'misconduct' forfeiture trigger controlled by trustees. (3) Two golden handcuffs bequests (A.36-37) — $200K each for 2 years of continued service, names redacted. (4) $3M to Michelle Fern Saipher (Indyke's wife) for FT Real Estate/KCAC LLC real estate purchase at 2 Kean Court, Livingston NJ — conditioned on remaining married to Indyke. (5) Lyn & Jojo LLC transfer reveals Indyke as nominee property holder. (6) Kahn bequest confirmed at $5M. (7) Three new staff bequests (A.33-35) including Janusz Banasiak at $58.5K. All three trustees re-signed in September 2015."
review_notes: "CRITICAL — completes the trust chain. The employment cliff (Section 2.5) is functionally a witness-loyalty mechanism: employee-beneficiaries forfeit bequests if they leave within 1 year of death. Combined with no-contest clause (§8.5), creates strong financial incentives against cooperation with authorities. 'Misconduct' forfeiture trigger is interpreted by trustees — principally Indyke, who also told employees not to talk to police (EFTA02731082, p. 41). Staley signed this amendment ~3 months before becoming Barclays CEO."
classification: "high"
```

## 2. Entity-Document Links

Link these existing entities to EFTA01266427:

| Entity | Role | Notes |
|--------|------|-------|
| Jeffrey Epstein | subject | Grantor, signed in USVI |
| Jes Staley | subject | Re-signed as trustee, ~3 months before Barclays CEO |
| Darren Indyke | subject | Re-signed; wife receives $3M; nominee holder for Lyn & Jojo LLC |
| David Mitchell | subject | Re-signed as trustee |
| Richard D. Kahn | mentioned | Bequest confirmed at $5M |

## 3. New Events

### Event A: First Amendment Signed

```
title: "First Amendment to Epstein 2014 Trust — employment cliff and amendment power change"
date: "2015-09-01"
date_precision: "month"
event_type: "legal"
description: "First Amendment to the A&R of the Epstein 2014 Trust signed by all three trustees. Simplifies amendment power from 'all trustees must sign' to 'deliver to one trustee' (concentrating control in Indyke). Adds Section 2.5 employment cliff — employee-beneficiaries must work for estate 1 year post-death or forfeit bequests. Adds A.36-37 golden handcuffs ($200K each, 2-year service). $3M to Indyke's wife (Michelle Fern Saipher) for NJ real estate. Lyn & Jojo LLC transfer to Fontanillas reveals Indyke as nominee. Epstein signed in USVI; trustees signed in New York (notary: Habibe Avdiu)."
source_documents: ["EFTA01266427"]
```

Link to entities: Jeffrey Epstein, Jes Staley, Darren Indyke, David Mitchell

## 4. Document Metadata Update for EFTA01266380

Also update EFTA01266380 (original trust) if not already done:

```
bates_number: "EFTA01266380"
title: "The Jeffrey E. Epstein 2014 Trust"
document_type: "trust_document"
original_date: "2014-11-18"
summary: "Original Epstein 2014 Trust. Grantor: Jeffrey E. Epstein. Trustees: Darren K. Indyke, James E. Staley, David Mitchell ($250K/yr each). 22 bequests totaling ~$52M (7 redacted females at $5M each). Karyna Shuliak: $10M. Indyke: $5M. Jean Luc Brunel: $5M (openly named). Richard Kahn: $2M (later raised to $5M). Properties held via USVI shell companies. Primary beneficiary redacted (later revealed as Celina Dubin). Contingent: Eva Andersson-Dubin. Successor trustees: Eva, Steven Hanson, Joseph Pagano. USVI governing law. Amendments required ALL trustees to sign."
classification: "high"
```
