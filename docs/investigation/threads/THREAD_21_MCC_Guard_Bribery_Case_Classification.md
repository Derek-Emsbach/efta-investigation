---
type: investigation_thread
thread_id: "21"
thread_name: "The Contraband Case the FBI Filed as an Epstein Case"
version: "1.1"
date: "2026-10-15 (updated 2026-10-23: expanded negative search on Adams case disposition, see Open Questions §1)"
classification: "UNRESTRICTED — PUBLIC ANALYSIS (internal research doc — not yet reviewed for publication)"
sensitivity: contains_speculation_markers
primary_entities:
  - name: "Robert Adams (Robert C. Adams)"
    tier: "unassigned — recommended T3 or T6, see Entity Pipeline Candidates below"
  - name: "Keith Outlaw"
    tier: "unassigned — recommended T6 (inmate/peripheral) pending further review"
source_documents:
  - efta: "EFTA01655720"
    title: "FBI internal email, subject 'Epstein cases' — lists 6 case numbers including 90C-NY-3154599"
  - efta: "EFTA01684155"
    title: "8/23/2019 FBI case update, C-19: 90C-NY-3154599 — MCC contraband introduction narrative"
  - efta: "EFTA01684602"
    title: "FBI case-index pages (149, 180, 181) describing 90C-NY-3154599 as 'a contraband at MCC case in which EPSTEIN is referenced'"
  - efta: "EFTA00173321"
    title: "9/28/2020 FBI Branch D weekly major-matters report (UNCLASSIFIED//FOUO) — full narrative of the Adams bribery/blackmail allegation, states Adams was on duty the night of Epstein's suicide"
  - efta: "EFTA00025524"
    title: "9/18/2020 internal SDNY US Attorney's Office email ('the week ahead') — confirms the Adams prosecution 'spun out of' the Epstein-death investigation"
key_finding: "Open question OQ-08 ('why does case number 190C-NY-3154599 appear in later evidence report pages?') resolves to a real FBI case number — 90C-NY-3154599, not '190C' (the leading '1' in the open-question log does not match any case-number format anywhere else in the corpus and appears to be a transcription artifact from whoever first logged OQ-08, not a real prefix). The case itself is a 08/14/2019 MCC drug-smuggling incident. The FBI's own internal case list filed it as one of six official 'Epstein cases.' Pursuing it further surfaced something OQ-08's original framing gave no hint of: the case's own target, BOP correctional officer Robert Adams, was indicted in September 2020 for bribery and blackmail — coercing a contraband-smuggling visitor into sex in exchange for not reporting her — and SDNY's own internal email states this prosecution exists only because Adams was investigated 'in connection with' Epstein's death, since he 'was working in the SAMS unit the night of Epstein's suicide.' That link appears nowhere in the public DOJ press release or any news coverage of the Adams case — it is corpus-only."
---

# Thread 21: The Contraband Case the FBI Filed as an Epstein Case

> **Key Finding:** OQ-08 asked why an unexplained case number ("190C-NY-3154599") kept appearing in later evidence report pages. The real number is 90C-NY-3154599 — a 2019 MCC drug-smuggling case the FBI's own internal records classify as one of six official "Epstein cases." Chasing it down surfaced an unreported link: the case's target, BOP guard Robert Adams, was later indicted for bribing/blackmailing a visitor into sex — and SDNY's own internal email admits that prosecution only exists because Adams was first investigated over his role the night Epstein died. The public record never makes that connection.

---

## Tier System Legend

| Tier | Definition |
|------|------------|
| 1 | Convicted or Charged |
| 2 | Named Co-Conspirator (NPA Immunity) |
| 3 | Suspicious/Concerning Conduct |
| 4 | Social/Professional Contact |
| 5 | Victims/Witnesses |
| 6 | Staff/Operations/Legal/Law Enforcement |

---

## 1. Resolving OQ-08: the case number itself

`docs/investigation/OPEN_QUESTIONS.md` has carried OQ-08 since the Dataset 12 intake as a bare, unresolved curiosity: *"Why does case 190C-NY-3154599 appear? Unknown case number in later evidence pages."* No session had attempted it before this one.

A corpus-wide search for the literal string "190C" returns nothing resembling a case number at all — every hit is either noise from a repeating PGP/OTR fingerprint block that happens to contain the digits "190C" (dozens of Austin Zuberi email-signature blocks across Dataset 11, all unrelated), or a single Accurint background-check report fragment ("BRIELLE NJ 08730->>>190C<<< MONMOUTH COUNTY"). None of these is a case number, and the search tool itself rejects a hyphenated "190C-NY" query (an FTS5 tokenizer limitation already flagged by the 2026-10-03 session, not a corpus gap).

Searching the bare digits "3154599" instead immediately surfaces the real number, in five independent documents, consistently rendered as **90C-NY-3154599** — never "190C." This matches the FBI case-number format used throughout the corpus for every other number in the same family (`50D-NY-3027571`, `72-MM-113327`, `31E-MM-108062`, `90A-NY-3151227`, `9A-NY-3144791`), all two-or-three-character alpha-prefix / office-code / six-digit-serial. "190C" has no parallel anywhere in the corpus and was almost certainly a transcription slip when OQ-08 was first logged — the leading "1" does not belong to the case number.

**Confirmed case identity**, EFTA01684155 p.1 (8/23/2019 FBI squad update):

> "C-19: 90C-NY-3154599: KEITH OUTLAW, ROBERT ADAMS — METROPOLITAN CORRECTIONAL CENTER; DRUG INTRODUCTION; SDNY ... On 08/14/2019, an unknown female visitor introduced several types of contraband into the Metropolitan Correctional Center (MCC). A thorough search was conducted of the female visitor that yielded in the discovery of 3 bundles wrapped in black electrical tape. The 3 bundles contained smaller plastic bags that contained brown leafy substance, green leafy substance, pills, a cellular device, and rolling paper. The female visitor ... stated that she was instructed to give it to inmate KEITH OUTLAW."

> **[DOCUMENTED FACT]** 90C-NY-3154599 is an official "Epstein case"
> EFTA01655720 p.1 — an FBI internal email (Cc: Ryan J. Christie, FBI NY), subject line literally "Epstein cases," lists six case numbers as a set: 50D-NY-3027571 (the primary SDNY trafficking case), 72-MM-113327, 31E-MM-108062 (FBI Miami file), 90A-NY-3151227, 9A-NY-3144791, and 90C-NY-3154599. EFTA01684602 p.149 independently confirms the classification: "90C-NY-3154599 is a contraband at MCC case in which EPSTEIN is referenced. 9A-NY-3144791 is a threat to victim case in which EPSTEIN is referenced." This resolves the "why does it appear in evidence report pages" half of OQ-08 directly — it appears because the Bureau itself bundled it administratively with the trafficking investigation, not because of any editorial or redaction choice on DOJ's part.

## 2. What the contraband case actually is — and who it led to

The contraband case on its own is unremarkable: a visitor smuggling drugs, a phone, and rolling papers to an inmate (Keith Outlaw), caught in a routine MCC search, with a follow-up SDNY search warrant on her Bronx residence four days after Epstein's death (EFTA01684155 p.1). Epstein is "referenced" in it only in the administrative sense that it was opened at MCC during the same window as the death investigation and swept into the same case family.

The investigation did not stop there. The visitor's own FBI/FPS/OIG interview disclosed a second, prior incident — and that second incident is the actual substance of this thread.

> **[DOCUMENTED FACT]** The visitor's prior-incident disclosure, in full
> EFTA00173321 p.5 (9/28/2020 FBI Branch D weekly major-matters report, UNCLASSIFIED//FOUO): "During this interview, HARRIS indicated that on a prior occasion, she [HARRIS] similarly attempted to enter MCC with contraband to provide to OUTLAW. However, in the process of entering MCC, the contraband was discovered by BOP Correctional Officer (CO) ROBERT C. ADAMS (ADAMS). Upon discovery, CO ADAMS told HARRIS that he [CO ADAMS] would not report HARRIS if HARRIS agreed to meet ADAMS at a hotel to engage in sex, which HARRIS did. **ADAMS was a guard on duty the night of Jeffrey Epstein's suicide at MCC.**"

The visitor is named in this FBI document as Shahada Harris. **No public source reviewed for this thread names her** — the DOJ press release and every news article found refer only to "the visitor" or "a visitor." Per this project's own Tier 5 rule (victim/witness names used only where already public) and the standing CLAUDE.md victim-privacy rule, **her name should not be published or used in any public-facing material** on the strength of this FBI document alone, the same standard applied to "Mariana Idzkowska" in Thread 20. She is named here, in this internal research thread, only because the document itself does — not as a recommendation to treat her identity as public.

> **[DOCUMENTED FACT]** SDNY's own staff connect the two investigations explicitly
> EFTA00025524 (9/18/2020, internal SDNY US Attorney's Office email, subject "RE: the week ahead"): "Robert Adams Arrest. At some point next week we expect to arrest Robert Adams, a guard at MCC who we indicted yesterday with bribery in connection with an incident last year when he caught a woman smuggling in contraband, and told her she wouldn't get in trouble if she went to a motel and had sex with him, which she did. The FBI is working on the details and exact timing of the arrest ... **(If the name sounds familiar, Adams was working in the SAMS unit the night of Epstein's suicide, and we interviewed him and got him appointed counsel in connection with that investigation; this charge spun out of that.)** We plan to do a press release."

This is the central finding of the thread: the Adams bribery/blackmail prosecution is not an independent referral. By SDNY's own internal account, it exists **because** Adams was first pulled into the Epstein-death investigation (interviewed, appointed counsel) as a guard on duty that night — and the sexual-coercion allegation surfaced as a byproduct of that process, not through any ordinary reporting channel. That causal link appears nowhere in the public record identified below.

## 3. Public record comparison — what DOJ told the public vs. what the corpus shows internally

The DOJ SDNY press release announcing the Adams indictment (unsealed 9/28/2020, the same day as EFTA00173321's internal report) names Robert Adams, 39, a BOP correctional officer assigned to the MCC visit area June–August 2019, and charges him with one count of bribery (max 15 years) and one count of blackmail (max 1 year), for conduct on or about July 5, 2019 — a visitor caught smuggling contraband, allegedly blackmailed into sex at a motel after Adams threatened to have her arrested and barred from the facility. Contemporary news coverage (Fox5NY, NBC New York, the Daily Beast — all September 2020) tracks the press release closely.

**None of these public sources mention Jeffrey Epstein, MCC's SAMS unit, or the night of Epstein's death.** The Epstein connection — both the formal "Epstein cases" classification and the internal admission that the prosecution "spun out of" the death investigation — exists only in the corpus's internal government documents (EFTA01655720, EFTA01684602, EFTA00173321, EFTA00025524), not in anything DOJ chose to disclose publicly about the Adams case itself.

Whether this is a meaningful omission (the kind of institutional under-disclosure this investigation tracks under the Protection Apparatus system) or simply a prosecutor's ordinary practice of not pulling an unrelated high-profile name into an unrelated indictment is a fair open question — flagged below, not resolved here. The fact itself, though, is a clean example of Category C-adjacent pattern: the public-facing account of a BOP-corruption prosecution is silent on a connection the government's own internal records state as fact.

## 4. A loose thread, not yet pulled: Keith Outlaw's housing records in the death-investigation discovery set

Two BOP housing/assignment-schedule documents (EFTA02730741 p.244, Dataset 12; EFTA01730634 p.103, Dataset 11) list "Keith Outlaw Housing Assignment" and "Keith Outlaw Communications Report" as items alongside "Robert Adams schedule and Assignments 6/1/19 to 8/19/2019" and a "Visitors Log" — all appearing in what reads as a discovery/exhibit index tied to the death investigation (the same index family referenced in an unrelated December 2019 "Hammad memo" email, EFTA00027880, which separately lists an attachment literally named "Epstein_Death_Investigation.msg").

This is **not confirmed** to mean Outlaw was housed near Epstein or was himself a witness of interest — it may simply reflect that any inmate connected to a guard (Adams) under death-investigation scrutiny would have his own records pulled as a matter of course, regardless of any Epstein-specific relevance. Flagged as an unresolved lead, not asserted as a finding.

## 5. Outcome status — not resolved by this session

A web search (standard + extended) for the disposition of *United States v. Robert Adams* (SDNY, indictment unsealed 9/28/2020) found no guilty plea, trial verdict, dismissal, or sentencing announcement as of this session — only the original 2020 indictment coverage. **Namesake caution:** a different "Martin Adams," a former BOP correctional officer at FCI Terminal Island, California, pleaded guilty in February 2025 to an unrelated deprivation-of-rights-under-color-of-law charge — confirmed via DOJ OIG's own press release to be a different person, different facility, different case. Do not conflate the two in any future session. A separate MCC corruption case from the same era (Perry Joyner, sentenced 43 months in 2022, bribery/smuggling/witness-intimidation) is also confirmed unrelated to Adams — different officer, same facility, overlapping timeframe, coincidental.

---

## Key Documents

| Bates | Title | Significance |
|-------|-------|---------------|
| EFTA01655720 | FBI internal email, "Epstein cases" list | Formally classifies 90C-NY-3154599 as an Epstein case |
| EFTA01684155 | 8/23/2019 FBI case update | Full contraband-incident narrative, names Outlaw |
| EFTA01684602 | FBI case-index pages 149/180/181 | States case exists "in which EPSTEIN is referenced" |
| EFTA00173321 | 9/28/2020 FBI Branch D weekly report | Full Harris/Adams bribery narrative; "Adams was a guard on duty the night of Jeffrey Epstein's suicide at MCC" |
| EFTA00025524 | 9/18/2020 internal SDNY email | "this charge spun out of" the Epstein-death investigation — the key causal admission |
| EFTA01660827 / EFTA01660828 | FBI color-of-law case-opening EC | Opens 282B-NY-3156749, the distinct civil-rights investigation into Adams specifically |
| EFTA00027880 | Dec. 2019 "Hammad memo" email | Lists Keith Outlaw housing/communications records among death-investigation discovery materials |

## Open Questions

1. [Priority: MEDIUM] Was the Adams indictment ever resolved (plea, trial, dismissal)? **Still not found as of 2026-10-23** (daily-investigation session, web-only — `device_bash`/corpus MCP server unavailable, see session note below). Ran a wider sweep this session specifically targeting MCC-officer bribery prosecutions from the same office/era, on the theory a plea or sentencing might surface under a case-family search even if "Robert Adams" alone doesn't: checked five other BOP-officer bribery press releases (Paul Hayes/FCC Victorville; Ashley Lovett/FCI Yazoo City; Victor Casado/MCC NY — a *different*, later-arrested MCC officer on honest-services-wire-fraud-adjacent charges, complaint only, no outcome shown; Perry Joyner/MCC NY, already ruled out in this thread, confirmed again — sentenced 43 months 7/25/2023; Mario Feliciano/MCC NY, newly surfaced, sentenced 5 months 4/11/2024 for conspiracy to commit honest services wire fraud) — **none is Robert Adams**, and none of their press releases names him either. `courtlistener.com` query-string search was blocked by that site's robots.txt from this tool; a direct PACER/RECAP docket lookup by case number remains the one avenue not yet tried. The original 9/28/2020 unsealed-indictment press release is still the most recent public mention of Adams found anywhere. Worth noting for context (not evidence of Adams's own case status): Victor Casado and Mario Feliciano, both MCC NY officers charged/sentenced in roughly the same window on honest-services-wire-fraud-flavored bribery charges, suggest this may have been part of a wider MCC corruption sweep rather than an isolated Adams prosecution — a possible angle for a future session if PACER access is ever available, but not pursued further here.
2. [Priority: LOW] Does Keith Outlaw's inclusion in death-investigation discovery materials reflect anything beyond routine administrative sweep (guard-linked-inmate records pulled as a matter of course)? Not established either way.
3. [Priority: LOW] Is the absence of the Epstein/SAMS-unit connection from DOJ's public Adams press release a deliberate choice or ordinary prosecutorial practice (not naming an unrelated high-profile case in an unrelated indictment)? No internal document found either way — flagged, not resolved.

## Entity Connections Suggested

(For human review — not created this session, consistent with the open-thread/no-DB-writes lane.)
- Robert Adams → Jeffrey Epstein / MCC: connection type `mcc_staff_present_night_of_death` or similar, evidence EFTA00173321, EFTA00025524
- Robert Adams → Keith Outlaw: connection type `case_subject` or `investigative_link`, evidence EFTA01684155

## Entity Pipeline Candidates (flagged, not created)

- **Robert Adams** (BOP correctional officer, MCC) — publicly named and charged (DOJ SDNY press release, 9/28/2020 indictment: bribery + blackmail). No privacy concern; recommend T6 (staff/law enforcement) at minimum, possibly T3 given the direct documented allegation and the case's formal "Epstein case" classification — Derek's call on tier given the project's tier-strength conventions. Clean next entity-pipeline pick.
- **Keith Outlaw** — inmate, named in FBI case records; recommend T6 (peripheral/operations) if entitized at all — thin standalone significance beyond this case.
- **Shahada Harris** — the coercion victim. **Do NOT entitize or name publicly.** Named only in an internal FBI document, not in any public source found. Same Tier 5 / victim-privacy standard already applied to "Mariana Idzkowska" (Thread 20) applies here.
