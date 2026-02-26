# EFTA01266380 Deep Read — Original Jeffrey E. Epstein 2014 Trust

## Context

We just completed a full analysis of EFTA01266403 (the May 2015 Amendment and Restatement of the Epstein 2014 Trust). That document named three trustees: Darren K. Indyke, James E. Staley, and David Mitchell. Staley was compensated $250K/year and signed under oath.

EFTA01266380 is the **original** November 2014 trust — before the May 2015 amendment. The critical question: **Was Staley a trustee in the original, or was he added in the amendment?**

If Staley was NOT in the original:
- His addition in May 2015 was a deliberate choice
- He became Barclays CEO in December 2015 — 7 months later
- This raises questions about UK regulatory disclosure (FCA/PRA)
- It may also explain the timing: was Staley added *because* he was about to become CEO of a major bank?

If Staley WAS in the original:
- The trust relationship predates his Barclays appointment by over a year
- The May 2015 amendment changed something else
- Still raises FCA disclosure questions, but the timeline is less suspicious

## Also Look For

We also found EFTA01266427 in corpus searches — described as the "first amendment" to the trust. If time permits, read that too. The amendment chain is:
1. EFTA01266380 — Original trust (November 2014)
2. EFTA01266427 — First amendment (date unknown)
3. EFTA01266403 — Amendment and Restatement (May 2015) — already fully analyzed

## Tools

- **`corpus_get_document_text`** — Pull full text. Read in chunks of 8 pages max to avoid 30K truncation.
- **`corpus_search`** — For follow-up searches if needed.

## Reading Strategy

### EFTA01266380 (Original Trust)

Check page count first, then read in 8-page chunks.

**Priority reads:**
1. **Page 0-1**: Title page and opening — WHO ARE THE TRUSTEES?
2. **Beneficiary sections**: Compare against the May 2015 version — was Celina Dubin already the primary beneficiary?
3. **Trustee provisions**: Compensation, powers — same as May 2015 or different?
4. **Schedule A**: Was it included in the original? (Missing from the May 2015 version)
5. **Signatures**: Who signed the original?

### EFTA01266427 (First Amendment) — if time permits

Same approach. Focus on: what changed, when, and was Staley involved?

## What to Extract

For each document, compare against EFTA01266403 (May 2015):

| Element | EFTA01266403 (May 2015) | EFTA01266380 (Original) | EFTA01266427 (1st Amendment) |
|---------|------------------------|------------------------|------------------------------|
| Trustees | Indyke, Staley, Mitchell | ? | ? |
| Compensation | $250K/year each | ? | ? |
| Primary beneficiary | Celina Edith Dubin | ? | ? |
| Successor trustee | Eva Andersson-Dubin | ? | ? |
| Properties | NYC (Maple), USVI (Nautilus), NM (Cypress), Paris (Laurel) | ? | ? |
| Cash bequests | ~$85M to 22 individuals | ? | ? |
| Schedule A | Missing | ? | ? |
| Signatures | Epstein, Indyke, Staley, Mitchell (notarized) | ? | ? |

## Output

Produce: `EFTA01266380_Analysis.md`

Key sections:
1. **Document Overview** — date, parties, page count
2. **Trustee Comparison** — who was trustee in the original vs. the amendment?
3. **Beneficiary Comparison** — same or different?
4. **What Changed** — specific differences between original and May 2015 version
5. **Key Quotes** — verbatim text of critical provisions
6. **The Staley Question** — was he added or original? What does this mean?
7. **Database Updates Needed** — document record, links, events, connections

If EFTA01266427 is also read, include a three-way comparison table.

## Important Notes

- The single most important finding is on page 0-1: the trustee names. Read that first before anything else.
- If the original trust has different beneficiaries than the May 2015 version, the changes tell us something about how Epstein's relationships evolved.
- If Schedule A exists in the original but not the amendment, assets may have been deliberately removed from the record.
- Watch for any entity names that don't appear in the May 2015 version — people removed from the trust are as interesting as people added.
