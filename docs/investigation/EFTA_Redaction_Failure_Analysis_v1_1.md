# EFTA Investigation — Redaction Failure & Disclosure Asymmetry Analysis

**Version 1.1** · Compiled 31 July 2026
*Supersedes the redaction-failure sections of Redaction Analysis Framework v1.0*
*Companion to: Network Registry v1.0, Network Hierarchy v1.0*

---

## EXECUTIVE FINDING — read before using anything below

The working hypothesis behind this line of inquiry was that names of powerful people could be
recovered from DOJ's EFTA releases through technical redaction failure. **That hypothesis is
substantially wrong, and the truth is more damaging to DOJ than the hypothesis was.**

**1. DOJ's redaction pipeline was technically sound.** The PDF Association's forensic study of the
DOJ tranche found redactions correctly burned into image pixel data, EXIF/IPTC/XMP explicitly
stripped, no XMP streams and no embedded files. Orphaned metadata was recoverable in compressed
object streams, but it leaked *pipeline provenance* — OmniPage CSDK 21.1, Processing-CLI, pypdf in
215 files — **not identities**.

**2. The famous copy-paste defeat was not DOJ's.** It traces to a defectively redacted 2021 filing
from the **U.S. Virgin Islands Attorney General's office**, sitting on a territorial docket, which
DOJ then republished wholesale into its "Epstein Library" (CNN, 23 Dec 2025). DOJ's failure was
republication without re-review — a real failure, but a different one.

**3. Almost no prominent name became public through redaction failure.** Wexner, Groff and Brunel
were **deliberately un-redacted** by DOJ on 10 Feb 2026 under Massie/Khanna pressure. Rep. Khanna's
six names were read on the **House floor** under Speech or Debate protection. Neither event is a
leak. Secondary coverage routinely collapses this distinction; this investigation must not.

**4. The actual catastrophe ran in the opposite direction — against victims.** Roughly **9,500
documents** carried unredacted PII for approximately **100 survivors**: one email listing 32
underage victims with 31 names visible; one minor's name appearing 20 times in a single document;
uncensored nude images including of minors; Social Security numbers, bank account numbers, dates of
birth, phone numbers; entirely unredacted FBI 302s and police reports.

**5. The asymmetry is documented, quotable, and squarely within Category D.** DAG Blanche's stated
rule was to redact every woman except Maxwell and to redact no men. NPR nonetheless found DOJ
black-boxing Trump's face in a Bannon exchange. Rep. Raskin, after reviewing unredacted files,
described "tons of completely unnecessary redactions" and names withheld "for mysterious or baffling
or inscrutable reasons," and called the victim exposure "either spectacular incompetence… or a
deliberate threat to other survivors."

**Methodological consequence.** The productive line of attack is **not** attempting to defeat
redactions. It is **differential analysis of inconsistent disclosure** — NPR's finding that the same
case PowerPoint was published **six times with different redactions each time** means the union of
those versions defeats every redaction in it, using nothing but public documents. That technique is
lawful, replicable, and does not touch victim identity.

**Standing constraint for this investigation.** Third-party "un-redaction" sites surfaced repeatedly
during this research and were **not used**. They are unverified and appear to republish victim PII
that is now the subject of a Privacy Act class action against DOJ. Nothing in this investigation
should cite them, and no victim name recovered through DOJ's failure should be republished by us —
the failure is the finding; the name is not ours to spread.

---

# SECTION 1: CATALOG OF DOCUMENTED REDACTION-FAILURE INCIDENTS

## 1.1 — House Oversight Committee release, 12 November 2025
**Document set:** ~20,000 files released by the House Oversight Committee from the Epstein estate subpoena production.
**Mechanism:** Survivor identities simply not redacted prior to publication.
**Exposed:** Survivor names. Attorneys Bradley Edwards and Brittany Henderson stated in a court letter that one DOJ document contained "at least 28 unredacted survivor names, some involving minors."
**Allegation (not established fact):** Edwards and Henderson asserted DOJ appeared to be "intentionally" failing to redact, based on comparing unredacted documents in their possession with DOJ-provided redacted versions, concluding "the DOJ has a very short list" of protected victims.
**Judicial response:** Judge Richard Berman ordered DOJ to describe the materials and explain its privacy-protection process by 1 December 2025.
**Source:** HuffPost, via AOL — https://www.aol.com/articles/epstein-survivors-believe-doj-intentionally-100005844.html

## 1.2 — USVI civil racketeering docket posted to DOJ "Epstein Library," ~19–22 December 2025
**This is the single best-documented technical redaction failure of the entire production.**
**Document:** Amended complaint (Feb 2021) in the U.S. Virgin Islands attorney general's 2020 civil racketeering suit against Epstein's estate.
**Mechanism:** Black rectangles drawn as an overlay layer over live, selectable vector text. Highlight → copy → paste into any text editor returned the hidden text verbatim.
**Critical provenance finding:** CNN established the defective redactions were applied by the **U.S. Virgin Islands attorney general's office**, not DOJ, and had been sitting on a public territorial docket since 2021. DOJ's contribution was republishing the entire flawed docket to its new "Epstein Library" page under EFTA. This distinction matters: it is a *republication* failure by DOJ, not a DOJ redaction-tooling failure.
**Exposed:** Allegations that estate executor/Epstein attorney **Darren Indyke** signed Foundation account checks exceeding $400,000 payable to "young female models and actresses" (2015–2019), including over $380,000 to a former Russian model in monthly installments; allegations regarding an immigration lawyer's involvement in forced marriages arranged among Epstein's victims; allegations that Epstein threatened victims and instructed others to destroy evidence.
**Who demonstrated it:** Political commentators Ed and Brian Krassenstein publicly demonstrated the copy-paste technique on X on 22 December 2025, the same day DOJ released 11,034 documents. It spread across Reddit, X and TikTok by 22 December.
**Response:** Indyke's attorney Daniel Weiner: "Not a single woman has ever accused Mr. Indyke of committing sexual abuse or witnessing sexual abuse."
**Sources:**
- CNN, 23 Dec 2025 (provenance) — https://www.cnn.com/2025/12/23/politics/epstein-redactions-glitch-virgin-islands (CNN blocks automated fetch; syndicated full text: https://www.wral.com/story/botched-epstein-redactions-trace-back-to-virgin-islands-2020-civil-racketeering-case-against-estate/22291041/)
- Mediaite, 23 Dec 2025 — https://www.mediaite.com/media/news/doj-redactions-of-some-epstein-files-easily-revealed-with-copy-and-paste/
- The Daily Beast — https://www.thedailybeast.com/internet-sleuths-reveal-hack-to-undo-epstein-file-redactions/
- Forbes (Davey Winder), 26 Dec 2025 — https://www.forbes.com/sites/daveywinder/2025/12/26/epstein-files-hacked---all-you-need-to-know/

## 1.3 — Initial DOJ EFTA release, 19–21 December 2025: mass wholesale redaction
**Finding:** CBS News review found **at least 550 pages entirely blacked out** in the initial release — three consecutive documents totaling 255 fully redacted pages, plus a 119-page grand jury document wholly obscured.
**Note:** This is over-redaction, not a failure of redaction. Included because it is the counterpart complaint driving the asymmetry argument in Section 3.
**DOJ position:** Deputy AG Todd Blanche: "The only redactions being applied to the documents are those required by law — full stop."
**Source:** CBS News, 21 Dec 2025 — https://www.cbsnews.com/news/epstein-files-redaction-over-500-pages-entirely-blacked-out/

## 1.4 — DOJ EFTA release of ~3 million pages, 30–31 January 2026: mass victim exposure
**The largest documented failure by volume.**
**Mechanisms observed (see Section 2 for taxonomy):** fragmented names across documents; unredacted FBI 302 forms; nude images with faces visible; financial identifiers in the clear.
**Exposed:**
- Nude photographs of victims, including underage girls, uncensored
- Names and faces of sexual abuse victims
- Bank account numbers and Social Security numbers in full view
- Dates of birth, phone numbers, email addresses, nicknames, family names
- Police reports released entirely unredacted with multiple victim names
- Survivor Annie Farmer's date of birth and phone number wrongly revealed (Farmer is a public advocate who has spoken on the record; noting this because she herself disclosed it publicly)
**Scale:** Edwards and Henderson reported "thousands of redaction failures on behalf of nearly 100 individual survivors" within 48 hours. One minor's name appeared **20 times in a single document**, with only 3 of 17 errors corrected on first pass. One email listed **32 underage victims with only one name redacted and 31 left visible.**
**DOJ's own figure:** DOJ characterized affected material as 0.1% of released pages — which NPR noted equates to **over 3,000 pages**. Blanche separately used a figure of ".001 percent."
**Consequence:** Survivors reported death threats and harassment. One survivor reported receiving death threats after 51 entries exposed banking information.
**Sources:**
- CNN, 2 Feb 2026 — https://www.cnn.com/2026/02/02/politics/epstein-victims-demand-takedown-epstein-files (syndicated: https://www.aol.com/articles/epstein-victims-lawyers-ask-judges-155451355.html)
- Associated Press, 4 Feb 2026 — https://www.ksat.com/news/politics/2026/02/04/epstein-files-rife-with-uncensored-nudes-and-victims-names-despite-redaction-efforts/
- Boston Globe, 4 Feb 2026 — https://www.bostonglobe.com/2026/02/04/nation/epstein-files-redaction-errors/
- ABC News, ~2 Feb 2026 — https://abcnews.com/US/latest-release-epstein-files-includes-survivors-names-despite/story?id=129713987
- NPR, 3 Feb 2026 — https://www.npr.org/2026/02/03/nx-s1-5696975/what-to-know-epstein-files-latest
- NPR, 6 Feb 2026 — https://www.npr.org/2026/02/06/nx-s1-5702692/epstein-files-doj-trump-clinton-oversight
- PBS NewsHour — https://www.pbs.org/newshour/politics/government-says-its-fixing-thousands-of-documents-in-epstein-related-files-that-may-have-had-victim-information

## 1.5 — DOJ withdrawal and re-release, February 2026
**Yes — DOJ did withdraw and re-release documents after redaction errors.**
- DOJ withdrew "several thousand documents and media" from its website.
- U.S. Attorney Jay Clayton wrote that flagged documents would be "promptly pulled down" and reposted "ideally within 24 to 36 hours."
- DOJ stated in a 6 February 2026 letter to SDNY judges that it was "working around the clock to run additional searches for documents that may require additional redaction," and that "victims and victim counsel have identified new victims and new identifiers…which are then routed into additional searches."
- DOJ established a reporting inbox: EFTA@usdoj.gov.
- DOJ, 2 Feb 2026: "All documents requested by victims or counsel to be removed by yesterday evening have been removed for further redaction."
- DOJ attributed failures to "technical or human errors."
- Hundreds of DOJ lawyers (200+ per CBS) were pulled from regular duties; at least one New York judge complained the effort delayed other court matters.
**Sources:** PBS NewsHour (above); AP (above); CNN 2 Feb 2026 (above).

## 1.6 — Judicial and collateral proceedings arising from the failures
- **Judge Richard M. Berman** (SDNY, Epstein case) and **Judge Paul Engelmayer** (SDNY, Maxwell-related) received the victims' counsel letter of 1 February 2026 seeking a forced takedown of the DOJ Epstein files website and appointment of an independent monitor. Berman scheduled a conference; a later hearing was canceled after counsel cited progress.
- **Judge Valerie E. Caproni** rejected a mistrial motion in an unrelated sex-trafficking trial that was linked to leaked/exposed documents.
**Source:** PBS NewsHour — https://www.pbs.org/newshour/politics/government-says-its-fixing-thousands-of-documents-in-epstein-related-files-that-may-have-had-victim-information

## 1.7 — Class action: Jane Does v. DOJ and Google, filed 26 March 2026
**Court:** U.S. District Court, Northern District of California.
**Plaintiffs:** Jane Does, putative class of ~100 Epstein survivors.
**Claims:** Privacy Act violations against DOJ for wrongful disclosure and republication; against Google, California anti-doxxing statute, unfair competition, invasion of privacy, negligent infliction of emotional distress, and injunctive relief against republication.
**Exposure alleged:** names, phone numbers, email addresses, physical addresses, images — disclosed via EFTA releases from 19 December 2025 through 30 January 2026.
**Complaint quote:** "Even after the government acknowledged the disclosure violated the rights of the survivors and withdrew the information, online entities like Google continuously republish it, refusing victim's pleas to take it down."
**Sources:**
- Courthouse News — https://www.courthousenews.com/epstein-sexual-assault-survivors-file-class-action-to-stop-spread-of-personal-information/
- CNN, 27 Mar 2026 — https://www.cnn.com/2026/03/27/us/epstein-survivors-sue-doj-google-hnk
- The Hill — https://thehill.com/regulation/court-battles/5804358-epstein-survivors-sue-justice-google/
- NBC News — https://www.nbcnews.com/politics/justice-department/epstein-survivors-sue-trump-administration-google-release-private-info-rcna265408

## 1.8 — REDACT Act introduced, 14 July 2026 (most recent status)
Rep. Pramila Jayapal and Sen. Cory Booker introduced legislation creating a private right of action for survivors.
**Congressional findings on the failure scale:** DOJ released **approximately 9,500 documents containing unredacted personal information for nearly 100 survivors**; one document identified **31 child victims with only a single redaction**; as of February 2026 DOJ had retracted these documents after survivors faced harassment and retraumatization.
**Remedy:** court orders compelling removal; statutory or compensatory damages with a **$50,000 minimum**; attorney's fees and costs.
**Source:** https://jayapal.house.gov/2026/07/14/jayapal-booker-introduce-redact-act-to-protect-epstein-survivors-and-strengthen-accountability-for-doj-privacy-violations/

---

# SECTION 2: TAXONOMY OF TECHNICAL FAILURE MECHANISMS

## Mechanism A — Overlay redaction over live text layer (copy-paste defeat)
**Confirmed.** Black rectangles rendered as PDF objects above intact, selectable text. Defeated by highlight-copy-paste with no tooling.
**Evidence:** USVI amended complaint (§1.2). Forbes: the DOJ "apparently added black boxes as overlay layers on top of the original content. Since PDFs render content in multiple layers, the underlying text remained intact and selectable."
**Scope caveat — important:** Parade/AOL reporting established this was **not system-wide**: "only certain documents contained redactions that could be reversed because of how those specific PDFs were produced or filed." The primary confirmed instance traces to a territorial court filing, not DOJ's own redaction pipeline.
**Source:** Forbes 26 Dec 2025; Parade/AOL 24 Dec 2025 — https://www.aol.com/articles/redaction-issue-epstein-files-sparked-193528755.html

## Mechanism B — Redaction annotations removable by direct PDF manipulation
**Reported.** PBS reported redactions "overrideable by double-clicking" and "text crossed out but still readable," alongside "exposed credit card numbers, Social Security numbers, email addresses under thin cross-outs."
**Source:** PBS NewsHour (URL above)

## Mechanism C — Cross-document inconsistency (same content redacted in one copy, visible in another)
**Confirmed and systemic.** The strongest structural evidence:
- NPR found **the same PowerPoint presentation on the Epstein and Maxwell cases appears six times, with different information blocked out in each version.** Union of the six versions defeats every redaction in it.
- PBS: "Names unredacted in some document versions while redacted in others."
- CNN's 13-redactions analysis noted a modeling agency affiliation appearing redacted in some document versions but not others.
**Source:** NPR 3 Feb 2026; PBS; CNN 9 Feb 2026 — https://www.cnn.com/2026/02/09/politics/redacted-text-jeffrey-epstein-files

## Mechanism D — Name fragmentation across documents
**Confirmed.** First and last names redacted separately in different documents, so recombination across the corpus reconstructs the full identity. Explicitly described in NPR's 6 Feb 2026 reporting as a mechanism by which victim names became identifiable.
**Source:** NPR 6 Feb 2026

## Mechanism E — Redaction of one instance while other instances of the same name remain
**Confirmed, high volume.** Annie Farmer: "If you see some of these documents where there will be a list of 50 names and one is redacted, you know, there's just no explanation for how it could have been done so poorly." Concrete instances: 32 underage victims listed with 1 redacted and 31 visible; one minor's name appearing 20 times in a single document.
**Source:** NPR 6 Feb 2026; CNN 2 Feb 2026

## Mechanism F — Image redaction failure (partial obscuring)
**Confirmed.** Distinct from text failure:
- Nudity obscured but identifiable faces left visible
- Faces obscured but identifying context (dressing rooms, surroundings) left visible
- **Sequence failure:** a set of 100+ images of one woman almost entirely blacked out — except the final image, which showed her entire face
**Source:** AP 4 Feb 2026; Boston Globe 4 Feb 2026

## Mechanism G — Document-type gaps (unprocessed form types)
**Confirmed.** FBI "302" interview forms released with unredacted full names. Police reports released entirely unredacted. DOJ separately cited "technical limitations in processing handwritten documents for personally identifiable information" as grounds for withholding handwritten interview notes — i.e., its pipeline could not reliably redact handwriting.
**Source:** CNN 2 Feb 2026; AP 4 Feb 2026; ABC News 2 Jul 2026 — https://abcnews.com/Politics/doj-declines-turn-additional-epstein-files-redactions/story?id=134430675

## Mechanism H — Orphaned metadata in compressed object streams
**Confirmed by forensic analysis, but NOT identity-exposing.** The PDF Association's forensic case study found hidden document-information dictionaries embedded in compressed object streams, unreferenced by the final incremental-update trailer — thus "invisible to PDF software" but forensically recoverable. Recovered fields: CreationDate/ModDate, Creator "OmniPage CSDK 21.1", Producer "Processing-CLI". Producer "pypdf" appeared in 215 PDFs.
**This leaked processing-pipeline provenance, not names.**
**Source:** PDF Association — https://pdfa.org/a-case-study-in-pdf-forensics-the-epstein-pdfs/

## Mechanism I — Inconsistent/absent OCR creating recoverable text
**Confirmed as a residual risk, not a demonstrated exposure.** The PDF Association found OCR applied inconsistently, with "largely inaccurate OCR-ed text, indicating that NLP, ML, or even language-aware dictionary-based algorithms were not used," creating "opportunities for re-processing with modern OCR tools to potentially recover additional text" — while noting the burned-in redactions themselves remain effective.

## ⚠ Mechanism NOT confirmed — and a direct contradiction worth flagging
The **PDF Association's forensic study of the DOJ tranche found the opposite of the copy-paste failure**: black-box redactions were "correctly applied directly into the image pixel data," not as "separate PDF rectangle objects simply floating above sensitive information." It further found photographic content was systematically sanitized — JPEG→FLATE bitmaps, downscaled to 96 DPI, reduced to 256-color indexed palettes, with **EXIF, IPTC, XMP and COM tags explicitly removed**, eliminating camera identification, GPS and timestamps. No XMP metadata streams at all; no encryption, JavaScript, forms, or embedded files.
**Reconciliation:** DOJ's *own* image-based redaction pipeline was technically sound. The catastrophic failures were (1) republication of third-party filings that were defectively redacted before DOJ ever touched them, and (2) **process failures — names simply never flagged for redaction** — not cryptographic or layer-level tooling failures. This is the single most important analytical finding in this research: the dominant failure mode was **human/process, not technical**.

## Mechanisms searched for but NOT found in reporting
- Email header metadata retained while body redacted — **no reporting found**
- Names surviving in file names, Bates indices, or exhibit lists — **no reporting found** (PDF Association documented Bates numbering applied via incremental update in unembedded Helvetica, but reported no name leakage through it)
- Searchable OCR text under image redactions actually exposing an identity — **no confirmed instance found**

---

# SECTION 3: WHAT CONGRESS, JOURNALISTS AND VICTIM ADVOCATES SAID

## 3.1 Victims' counsel
**Brittany Henderson:** "The failure here is not merely technical. It is a failure to safeguard human beings who were promised protection by our government." (AP, 4 Feb 2026)

**Edwards & Henderson, joint filing:** "Within the past 48 hours, the undersigned alone has reported thousands of redaction failures on behalf of nearly 100 individual survivors." (CNN, 2 Feb 2026)

**Edwards & Henderson:** "There is no conceivable degree of institutional incompetence sufficient to explain the scale, consistency, and persistence of the failures." (PBS)

**Brad Edwards:** "We are getting constant calls for victims because their names…have all just been released for public consumption…It's literally 1000s of mistakes." And: "The easy job would be for the DOJ to type in all the victims' names, hit redact like they promised to do, then release them." (ABC News)

## 3.2 Survivors
**Annie Farmer:** "At this point, I'm feeling really most of all angry about the way that this unfolded. The fact that it's been done in such a beyond careless way, where people have been endangered because of it, is really horrifying." (AP/Boston Globe, 4 Feb 2026)

**Annie Farmer:** "If you see some of these documents where there will be a list of 50 names and one is redacted, you know, there's just no explanation for how it could have been done so poorly." (NPR, 6 Feb 2026)

**Danielle Bensky:** described DOJ's handling as "egregious." (NPR, 6 Feb 2026)

**Liz Stein:** "Victims' rights do not end where government negligence begins." (Jayapal press release, 14 Jul 2026)

## 3.3 Members of Congress — on OVER-redaction and asymmetry
**Rep. Jamie Raskin** (after reviewing unredacted files at DOJ, 9 Feb 2026):
- "They violated that precept by releasing the names of a lot of victims, which is either spectacular incompetence and sloppiness on their part, or, as a lot of the survivors believe, a deliberate threat to other survivors…"
- "I saw the names of lots of people, who were redacted for mysterious or baffling or inscrutable reasons."
- "there were tons of completely unnecessary redactions in addition to the failure to redact the names of victims"
Source: The Hill — https://thehill.com/homenews/house/5730137-raskin-unredacted-epstein-files/ ; Guardian/Yahoo — https://www.yahoo.com/news/articles/jamie-raskin-accuses-doj-cover-231219998.html ; ABC News — https://abcnews.com/Politics/lawmakers-reviewed-unredacted-epstein-files-blast-doj-blacked/story?id=130032378

**Rep. Ro Khanna** (EFTA co-author): "Just because someone is female doesn't necessarily mean they're survivors." And: "These six are just what we found in two hours of a review… They have been protecting some of these men." (ABC News; TIME)

**Rep. Thomas Massie** (EFTA co-author): on the December release, it "grossly fails to comply with both the spirit and the letter of the law." On the February review: "There are six men, some of them with their photographs, that have been redacted." Massie questioned the redaction of a "well-known retired CEO." (CBS News; TIME)

**Rep. Lauren Boebert:** stated she does not believe all individuals referenced are victims. (ABC News)

**Speaker Mike Johnson:** said he is "convinced" DOJ is complying with requirements. (ABC News)

**Sen. Chuck Schumer:** "Simply releasing a mountain of blacked out pages violates the spirit of transparency and the letter of the law." (CBS News, 21 Dec 2025)

**Rep. Nancy Mace**, 16 Feb 2026, demanding the unredacted co-conspirator memorandum: "Victims deserve justice, and the American people deserve the truth. The Epstein Files Transparency Act was passed to end the cover-ups, not continue them." — https://mace.house.gov/media/press-releases/rep-nancy-mace-demands-unredacted-epstein-co-conspirator-memorandum-southern

## 3.4 DOJ's stated redaction policy — and the documented asymmetry
**Deputy AG Todd Blanche's stated policy:** "We redacted every woman depicted in any image or video, with the exception of Ms. Maxwell. We did not redact images of any men unless it was impossible to redact the woman without also redacting the man."

**NPR documented a contradiction to this policy:** in a text exchange between Steve Bannon and Epstein, **Trump's face in a news article was obscured with a black box** — a male redaction inconsistent with Blanche's stated rule.
**Source:** NPR, 3 Feb 2026 — https://www.npr.org/2026/02/03/nx-s1-5696975/what-to-know-epstein-files-latest

**Blanche on Wexner:** "The document you cite has numerous victim names. We have just unredacted Les Wexner's name from this document, but his name already appears in the files thousands of times." (NBC News, 11 Feb 2026)

**Blanche, December:** "The only redactions being applied to the documents are those required by law — full stop." (CBS News)

**Structural asymmetry — the core critique:** the sex-based blanket rule meant (a) non-victim women were redacted as though victims, while (b) actual victim names leaked through process failures, and (c) men were presumptively visible except where reporting shows they were not. Raskin, Khanna, Massie and Boebert each attacked a different facet of this.

## 3.5 Prior-era allegation (context, pre-EFTA)
**Bloomberg, 1 August 2025** reported that during a March 2025 review deploying nearly 1,000 FBI agents, FOIA officers applied redactions blacking out Trump's name and others, invoking FOIA privacy exemptions on the theory Trump was a private citizen when the investigation began — shortly before DOJ/FBI's 6 July 2025 joint statement finding "no basis" to release further documents. **A top DOJ official denied any effort to redact mentions of Trump.** This is a contested allegation, not an established fact.
Sources: https://www.aol.com/news/fbi-redacted-trump-name-epstein-183138096.html ; denial: https://www.aol.com/articles/top-doj-official-denies-effort-131259624.html

---

# SECTION 4: STILL-REDACTED HIGH-VALUE TARGETS — STATUS AS OF LATE JULY 2026

## 4.1 FBI co-conspirator chart / list — PARTIALLY RESOLVED
**Document:** 15 August 2019 FBI Criminal Investigative Division internal document listing **eight alleged co-conspirators**, four names originally unredacted.
**Status:** On 10 February 2026, after Massie and Khanna complained EFTA was being violated, DOJ **deliberately un-redacted 16 additional names**, including three from this document: **Les Wexner, Lesley Groff, and Jean-Luc Brunel** (deceased).
**Remaining:** **Four names on the document remain redacted.** A separate August 2019 document indicates some of these individuals may be victims who cooperated with investigators.
**Mechanism of disclosure: DELIBERATE DOJ UN-REDACTION UNDER POLITICAL PRESSURE — NOT a redaction failure.**
**Sources:** NBC News, 11 Feb 2026 — https://www.nbcnews.com/politics/justice-department/doj-names-3-people-fbi-once-called-jeffrey-epstein-co-conspirators-rcna258335 ; TIME — https://time.com/7373333/epstein-files-redactions-massie-khanna-trump/ ; CNN, 10 Feb 2026 — https://www.cnn.com/2026/02/10/politics/epstein-files-unredacted-names

**Separate organizational chart:** CNN's 13-redactions analysis identified three redacted employees on an org chart (one noted as "direct point of contact for scheduling massage appointments") plus a redacted "girlfriend" described as a suspected recruiter. **These remain redacted.**

## 4.2 Draft 2007 indictment co-conspirators — STILL REDACTED, UNDER JUDICIAL REVIEW
**Status:** The draft 2007 indictment names five co-conspirators; **Maxwell is named, four of five remain redacted.** As of late July 2026 this document is before **Judge Emmet Sullivan for in camera review.**
**Source:** Forbes, 27 Jul 2026 — https://www.forbes.com/sites/alisondurkee/2026/07/27/could-more-epstein-files-be-released-soon-redacted-docs-will-be-reviewed-by-judge-this-week/

## 4.3 SDNY co-conspirator memorandum — STILL REDACTED
**Document:** 19 December 2019 memo, "Investigation into Potential Co-Conspirators of Jeffrey Epstein," **EFTA02731082**, addressed to then-U.S. Attorney Geoffrey S. Berman.
**Status:** Heavily redacted. Rep. Nancy Mace demanded an unredacted copy from U.S. Attorney Jay Clayton on 16 February 2026. **DOJ's response: SDNY applied the redactions before transmission and DOJ does not hold an unredacted version.**
**Source:** https://mace.house.gov/media/press-releases/rep-nancy-mace-demands-unredacted-epstein-co-conspirator-memorandum-southern

## 4.4 Litigation status of remaining redactions — ACTIVE AS OF 30 JULY 2026
**Judge Emmet Sullivan** found DOJ **violated the Epstein Files Transparency Act** and ordered it to unredact or justify withholding.
- 26 June 2026: Sullivan orders DOJ to unredact or explain.
- 2 July 2026: DOJ declines to turn over additional material — redacted email senders/recipients, the draft 2007 indictment, handwritten interview notes — citing victim protection, material that "can appear disturbing" without context, and technical limits on processing handwriting. DOJ sought a 60-day extension.
- Late July 2026: DOJ ordered to submit unredacted files to Sullivan for in camera review. Under review: redacted emails discussing women, FBI interview notes on allegations against President Trump, non-English documents, and the draft indictment. Sullivan may order immediate release or permit a 7–60 day delay.
- The administration contends a redaction-log summary already provided to Congress satisfies transparency requirements.
**Sources:** Forbes 26 Jun 2026 — https://www.forbes.com/sites/siladityaray/2026/06/26/federal-judge-orders-doj-to-unredact-some-details-from-epstein-files/ ; ABC News 2 Jul 2026 — https://abcnews.com/Politics/doj-declines-turn-additional-epstein-files-redactions/story?id=134430675 ; Forbes 27 Jul 2026 (URL above); Axios — https://www.axios.com/2026/06/26/epstein-files-doj-lawsuit-judge-release-unredacted-july-order ; CBS — https://www.cbsnews.com/news/judge-orders-doj-unredact-more-epstein-files-or-explain-why-blanche/

## 4.5 The 1953 Trust beneficiaries — PARTIALLY REDACTED
**Document:** The 1953 Trust, signed 8 August 2019 (two days before Epstein's death), finalized later that month. Lists **43 bequests totaling more than $330 million**; estate valued around $630 million.
**Status:** Reported by **Business Insider**. Karyna Shuliak, Darren Indyke and Richard Kahn are each first in line for residual funds, "followed by **seven people whose names are redacted**."
**How it became public:** included in the 3M+ page EFTA production; originally subpoenaed by SDNY during the Maxwell investigation. **Deliberate release with redactions intact — not a redaction failure.**
**Source:** Business Insider via AOL — https://www.aol.com/articles/document-lists-43-people-inherit-194705850.html

## 4.6 "Additional HT Subject" (OQ-02) — NO REPORTING FOUND
**I could not verify any public reporting on this.** Multiple targeted searches for "Additional HT Subject," "human trafficking subject" + redacted + EFTA, and the specific EFTA number returned nothing on point. If this term appears in the project's Dataset 12 analysis, it appears to be an **internal project finding not yet picked up by any outlet.** See Section 5.

## 4.7 2007 NPA "including but not limited to" unnamed co-conspirators — NO NEW REPORTING FOUND
The NPA named four assistants and extended immunity to "any potential co-conspirators of Epstein," including but not limited to those four. **I found no 2025–2026 reporting identifying additional individuals under that clause.** Related but distinct: Maxwell has alleged 29 people who reached secret settlements were not indicted by DOJ — an *allegation by a convicted party*, not documentary confirmation.

---

# SECTION 5: WHAT I COULD NOT VERIFY

Stated plainly. Each of these was searched for and not found; absence of reporting is not evidence of absence of the underlying fact.

1. **"Additional HT Subject" (OQ-02).** No media reporting located. Appears to be an internal project term.
2. **2007 NPA unnamed co-conspirators.** No reporting identifying anyone newly under the "including but not limited to" clause.
3. **Email header metadata retained while bodies redacted.** No reporting found describing this mechanism in these productions.
4. **Names leaking via file names, Bates numbers, or exhibit indices.** No reporting found. The PDF Association documented Bates methodology but reported no leakage through it.
5. **A confirmed instance of OCR text under an image redaction exposing an identity.** The PDF Association flagged this as a theoretical residual risk only; no confirmed exposure.
6. **Giuffre v. Maxwell (2024 unsealing) redaction failure.** No reporting found of a *technical* failure. The January 2024 unsealing was a deliberate judicial act by Judge Preska. Do not conflate.
7. **Any powerful/non-victim figure whose name became public specifically BECAUSE of a redaction failure — other than the USVI filing.** This is the single most important negative finding, addressing research question 4 directly. See below.
8. **Whether the four still-redacted names on the FBI co-conspirator chart are co-conspirators or cooperating victims.** NBC reported a separate document *suggests* some may be victims. Unresolved.
9. **The true scale of victim exposure.** Figures conflict irreconcilably: DOJ says 0.1% of pages; Blanche said ".001 percent"; the REDACT Act cites ~9,500 documents. These cannot all be right, and no outlet reconciled them.
10. **The Bloomberg allegation that FBI deliberately redacted Trump's name in March 2025.** Contested — a top DOJ official denied it. Unresolved.
11. **CNN's 13-redactions piece could not be fetched directly** (robots.txt); content was obtained via AOL syndication. Detail may be lossy.

## ⚠ CRITICAL FINDING ON RESEARCH QUESTION 4 — read this carefully

**Almost every prominent name that entered public view during this period did so through DELIBERATE disclosure, not redaction failure.** This distinction is routinely collapsed in secondary commentary and must not be collapsed in this investigation.

**(A) Names public because of a documented redaction failure:**
- **Darren Indyke** — via copy-paste defeat of overlay redaction in the USVI amended complaint. *And note even here:* the redaction was applied by the USVI attorney general's office in 2021, not DOJ; DOJ's failure was republication. Also implicated in the same recovered text: **Richard Kahn** (co-executor) and an unnamed immigration lawyer.
- **Victim/survivor identities at scale** — recorded here as a fact of failure only. Names deliberately withheld from this document.
- That is the complete verified list. It is very short.

**(B) Names public through DELIBERATE disclosure — NOT failure:**
- **Les Wexner, Lesley Groff, Jean-Luc Brunel** — DOJ un-redacted them on 10 Feb 2026 under pressure from Massie and Khanna.
- **Salvatore Nuara, Zurab Mikeladze, Leonic Leonov, Nicola Caputo, Sultan Ahmed Bin Sulayem, Leslie Wexner** — read onto the House floor by Rep. Ro Khanna on 10 February 2026, under Speech or Debate Clause protection. This was a **congressional disclosure**, not a leak and not a redaction error. *(Note: outlets caution that being named does not indicate criminal involvement; Wexner's counsel has stated prosecutors indicated he was "neither a coconspirator nor a target in any respect.")*

**(C) Rumor and speculation — explicitly NOT established:**
- A **fake Epstein letter** went viral. DOJ confirmed it was not authentic: "This fake letter serves as a reminder that just because a document is released by the Department of Justice does not make the allegations or claims within the document factual."
- Widespread TikTok/X claims of having "unredacted the Epstein files" were largely unverified. Parade/AOL established the copy-paste vulnerability was document-specific, not system-wide.
- Third-party sites (epstein-data.com, epsteingpt.org, epsteinexposed.com) publish "un-redaction" guides and claimed recovered content. **These were deliberately not used as sources.** They are unverified, they may republish victim identifying information, and using them would risk exactly the harm the courts and the REDACT Act are trying to stop.

---

## Appendix: Source index
| Outlet | Date | URL |
|---|---|---|
| CNN | 23 Dec 2025 | https://www.cnn.com/2025/12/23/politics/epstein-redactions-glitch-virgin-islands |
| CBS News | 21 Dec 2025 | https://www.cbsnews.com/news/epstein-files-redaction-over-500-pages-entirely-blacked-out/ |
| Mediaite | 23 Dec 2025 | https://www.mediaite.com/media/news/doj-redactions-of-some-epstein-files-easily-revealed-with-copy-and-paste/ |
| Daily Beast | Dec 2025 | https://www.thedailybeast.com/internet-sleuths-reveal-hack-to-undo-epstein-file-redactions/ |
| Forbes (Winder) | 26 Dec 2025 | https://www.forbes.com/sites/daveywinder/2025/12/26/epstein-files-hacked---all-you-need-to-know/ |
| Parade/AOL | 24 Dec 2025 | https://www.aol.com/articles/redaction-issue-epstein-files-sparked-193528755.html |
| CNN | 2 Feb 2026 | https://www.cnn.com/2026/02/02/politics/epstein-victims-demand-takedown-epstein-files |
| NPR | 3 Feb 2026 | https://www.npr.org/2026/02/03/nx-s1-5696975/what-to-know-epstein-files-latest |
| AP / KSAT | 4 Feb 2026 | https://www.ksat.com/news/politics/2026/02/04/epstein-files-rife-with-uncensored-nudes-and-victims-names-despite-redaction-efforts/ |
| Boston Globe | 4 Feb 2026 | https://www.bostonglobe.com/2026/02/04/nation/epstein-files-redaction-errors/ |
| NPR | 6 Feb 2026 | https://www.npr.org/2026/02/06/nx-s1-5702692/epstein-files-doj-trump-clinton-oversight |
| CNN | 9 Feb 2026 | https://www.cnn.com/2026/02/09/politics/redacted-text-jeffrey-epstein-files |
| ABC News | 10 Feb 2026 | https://abcnews.com/Politics/lawmakers-reviewed-unredacted-epstein-files-blast-doj-blacked/story?id=130032378 |
| NBC News | 11 Feb 2026 | https://www.nbcnews.com/politics/justice-department/doj-names-3-people-fbi-once-called-jeffrey-epstein-co-conspirators-rcna258335 |
| TIME | Feb 2026 | https://time.com/7373333/epstein-files-redactions-massie-khanna-trump/ |
| Mace (House) | 16 Feb 2026 | https://mace.house.gov/media/press-releases/rep-nancy-mace-demands-unredacted-epstein-co-conspirator-memorandum-southern |
| Courthouse News | 27 Mar 2026 | https://www.courthousenews.com/epstein-sexual-assault-survivors-file-class-action-to-stop-spread-of-personal-information/ |
| Forbes | 26 Jun 2026 | https://www.forbes.com/sites/siladityaray/2026/06/26/federal-judge-orders-doj-to-unredact-some-details-from-epstein-files/ |
| ABC News | 2 Jul 2026 | https://abcnews.com/Politics/doj-declines-turn-additional-epstein-files-redactions/story?id=134430675 |
| Jayapal (House) | 14 Jul 2026 | https://jayapal.house.gov/2026/07/14/jayapal-booker-introduce-redact-act-to-protect-epstein-survivors-and-strengthen-accountability-for-doj-privacy-violations/ |
| Forbes | 27 Jul 2026 | https://www.forbes.com/sites/alisondurkee/2026/07/27/could-more-epstein-files-be-released-soon-redacted-docs-will-be-reviewed-by-judge-this-week/ |
| PDF Association | n.d. | https://pdfa.org/a-case-study-in-pdf-forensics-the-epstein-pdfs/ |
| PBS NewsHour | Feb 2026 | https://www.pbs.org/newshour/politics/government-says-its-fixing-thousands-of-documents-in-epstein-related-files-that-may-have-had-victim-information |
