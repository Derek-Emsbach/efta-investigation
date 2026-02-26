# EFTA02731082 Prosecution Memo — Database Updates

## Context

We completed a full read of EFTA02731082, an 86-page SDNY co-conspirator prosecution memo dated December 19, 2019, addressed to U.S. Attorney Geoffrey Berman. The full analysis is at `docs/investigation/EFTA02731082_Analysis.md`. This session locks findings into Supabase via MCP tools.

EFTA02731082 already exists in the database (created during the Staley investigation session). It needs a metadata update plus extensive new entity links.

## 1. Update Existing Document Record

Use `update_document` (or whatever the update tool is called) for EFTA02731082. The existing record has basic Staley-focused metadata. Update with full document analysis:

```
bates_number: "EFTA02731082"
title: "SDNY Co-Conspirator Prosecution Memo — Investigation into Potential Co-Conspirators of Jeffrey Epstein"
document_type: "prosecution_memo"
original_date: "2019-12-19"
page_count: 86
summary: "Sealed Grand Jury 6(e) prosecution memo from SDNY AUSAs to U.S. Attorney Geoffrey Berman. Evaluates charging Epstein co-conspirators after his death. Documents 24 minor victims (ages 13-17), 14 adult victims, 3 subject interviews, 4 non-victim witnesses — all interviewed Jul-Dec 2019. Key findings: (1) Staley raped victim during directed massage at Epstein's NYC residence ~2011-2012, corroborated by JPMorgan-produced messages (p32, fn61 p67); (2) Black sexually assaulted victim in separate incident (p32); (3) Weinstein attempted assault during directed massage at Paris residence (p14); (4) Maxwell directed victim to have sex with Prince Andrew and Glen Dubin (p57); (5) Clinton traveled on Epstein's jet to Africa with Maxwell and 4 young women (pp28,37); (6) Epstein stole 'several hundred million dollars' from Wexner — explaining 'virtually all of Epstein's wealth' (pp64-65); (7) Groff scheduled NYC massages 2001-2019, invoked Fifth Amendment; (8) Indyke told assistant not to talk to police (p41); (9) Epstein directed destruction of computers and contact directories during FL investigation (pp40-41). Charging analysis (pp68-85) is 95-98% redacted — institutional decisions completely hidden while victim trauma fully exposed. Memo recommends Maxwell charges (fn62 p72). Evaluates 5 subjects: 3 redacted + Groff + Maxwell. Original SDNY bates range: EFTA00022461-EFTA00022546."
review_notes: "CRITICAL document. Full analysis complete. Redaction pattern: pp0-67 ~15-25% redacted (victim names); pp68-85 ~95-98% redacted (entire charging analysis/recommendations). Category C institutional protection — public sees all victim trauma, none of the government's decisions. Original bates numbering visible in footers."
classification: "high"
```

## 2. Entity Lookups

Before creating links, look up these entities. Use `lookup_person` for each. Record UUIDs or mark SKIP.

| Name | Expected | If missing |
|------|----------|-----------|
| Jeffrey Epstein | In DB | Critical |
| Jes Staley | In DB (32632113-0382-4f80-92f4-19284c1de9e9) | — |
| Leon Black | In DB | — |
| Ghislaine Maxwell | In DB | — |
| Jean-Luc Brunel | In DB | — |
| Prince Andrew | In DB | — |
| Alan Dershowitz | In DB | — |
| Bill Clinton | In DB | — |
| Harvey Weinstein | In DB | — |
| Leslie Wexner | In DB | — |
| Leslie Groff | In DB (T6) | — |
| Glenn Dubin | May exist (T3 from Session 18) | Create if missing |
| Darren Indyke | May be suspect | Skip connection if missing |
| Sarah Kellen | May be suspect | Skip connection if missing |

## 3. Create New Entity-Document Links

Use `link_entity_to_document` or `batch_link_entities_to_document`. EFTA02731082 already has links to Staley, Black, and Epstein from the previous session. Create links for newly identified entities.

| Entity | Role | Pages | Key Detail |
|--------|------|-------|------------|
| Ghislaine Maxwell | subject | throughout | Co-conspirator, recruiter, participant. Memo recommends separate prosecution memo for charges. |
| Jean-Luc Brunel | mentioned | 13,14,31,35,40,43,44,47,64 | Close associate, brought ~15yo girl to USVI, controlled victim's visa via modeling agency, invoked Fifth |
| Prince Andrew | mentioned | 7,57,59,60,65 | Victim claims Maxwell directed her to have sex with him. SDNY notes corroboration (photo + Maxwell admission) but also credibility concerns. |
| Alan Dershowitz | mentioned | 57,59,60 | Mentioned by "lent out" victim. Reporter Churcher suggested including him: "We all suspect Alan is a pedo." |
| Bill Clinton | mentioned | 28,37 | Africa trip on Epstein's jet with Maxwell and 4 young women. Secret Service doctor found it "odd." |
| Harvey Weinstein | mentioned | 14,58 | Victim directed to massage him at Paris residence. Told her to remove shirt. She refused. |
| Leslie Wexner | mentioned | 64,65 | Epstein stole "several hundred million dollars" from him — explains "virtually all of Epstein's wealth." $100M settlement Jan 2008. |
| Leslie Groff | subject | throughout | NYC scheduler 2001-2019. Invoked Fifth Amendment. Section IV.D evaluates charging her (redacted). Never charged. |
| Glenn Dubin | mentioned | 57 | Maxwell directed victim: "She had to do to Glen what she did for Epstein." Eva Dubin present during directed massage. |
| Darren Indyke | mentioned | 41,45 | Epstein's attorney. Told assistant not to talk to police. Brought computer to jail for "video sex." |

**Note:** Staley (subject), Black (mentioned), Epstein (mentioned) links already exist from previous session. Don't duplicate.

## 4. Update Glenn Dubin Entity

If Dubin exists in the database, update his record. If he's at Tier 3, this evidence supports a Tier 1 upgrade — Maxwell directed a victim to have sex with him. That's not circumstantial.

```
Use update_entity for Dubin:
evidence_summary: Add: "EFTA02731082 p57: Maxwell told victim 'she had to do to Glen what she did for Epstein.' Eva Dubin present during a directed massage. This is prosecution memo evidence (Grand Jury 6(e) material) of Maxwell directing sexual contact between a victim and Dubin — not mere association. Combined with DS9 financial partnership ($53.9M Highbridge Capital investment, $3.8M Jeepers/DB Zwirn partnership) and Giuffre testimony, evidence supports Tier 1."
```

If Dubin doesn't exist, create him:
```
name: "Glenn Dubin"
tier: 1
category: "alleged_abuser"
aliases: ["Glen Dubin", "G. Dubin"]
evidence_summary: [as above]
```

## 5. Create New Timeline Events

Use `create_event` then `link_entity_to_event` for each.

### Event 1: Prosecution Memo Delivered
```
title: "SDNY co-conspirator prosecution memo delivered to U.S. Attorney Berman"
date: "2019-12-19"
date_precision: "day"
event_type: "legal"
description: "86-page sealed prosecution memo evaluating charges against Epstein co-conspirators delivered to Geoffrey Berman. Documents 24 minor victims, 14 adult victims. Recommends separate Maxwell prosecution memo. Charging analysis for 3 redacted subjects + Groff completely redacted in EFTA release."
source_documents: ["EFTA02731082"]
```
Link to: Jeffrey Epstein

### Event 2: Clinton Africa Trip
```
title: "Clinton travels on Epstein's jet to Africa with Maxwell and 4 young women"
date: "2002-01-01"
date_precision: "year"
event_type: "travel"
description: "Adult Victim 1 traveled with Epstein and Maxwell on Epstein's private jet to Africa 'with President Clinton.' Secret Service physician Dr. Gregory Bledsoe found it 'odd' that Epstein brought 4 young women on the trip. Victim raped approximately a dozen times over 3-year period."
source_documents: ["EFTA02731082"]
```
Link to: Bill Clinton, Jeffrey Epstein, Ghislaine Maxwell

### Event 3: Wexner Discovers Theft
```
title: "Wexner discovers Epstein stole 'several hundred million dollars'"
date: "2007-01-01"
date_precision: "year"
event_type: "financial"
description: "Leslie Wexner discovered Epstein had stolen 'several hundred million dollars' from him, explaining 'virtually all of Epstein's wealth' according to SDNY prosecutors. Led to severance of ties. Wexner retained counsel for recovery."
source_documents: ["EFTA02731082"]
```
Link to: Leslie Wexner, Jeffrey Epstein

### Event 4: Wexner-Epstein $100M Settlement
```
title: "Epstein returns $100M to Wexner in settlement"
date: "2008-01-01"
date_precision: "month"
event_type: "financial"
description: "Epstein paid Wexner approximately $100 million in January 2008 as part of settlement for the theft of 'several hundred million dollars.' This suggests the actual stolen amount was substantially larger than $100M."
source_documents: ["EFTA02731082"]
```
Link to: Leslie Wexner, Jeffrey Epstein

### Event 5: Evidence Destruction
```
title: "Epstein directs destruction of computers and contact directories"
date: "2005-06-01"
date_precision: "approximate"
event_type: "institutional"
description: "During Florida criminal investigation, Epstein directed assistant to collect all contact books and computers from Palm Beach and give them to a man at the residence. Then directed shredding of Virgin Islands directories at Maxwell's NYC house. Computer-based masseuse scheduling directory never recovered by law enforcement (fn47 p49). Documented obstruction."
source_documents: ["EFTA02731082"]
```
Link to: Jeffrey Epstein, Ghislaine Maxwell

### Event 6: $250K Witness Payment
```
title: "Epstein pays $250,000 to assistant days after Miami Herald series"
date: "2018-12-01"
date_precision: "month"
event_type: "financial"
description: "Within days of the Miami Herald 'Perversion of Justice' series publication (November 2018), Epstein directed accountant Rich Kahn to wire $250,000 to [redacted assistant]. Assistant claims payment was unrelated to articles. Epstein instructed her not to tell anyone about it. SDNY probed this but assessment is in the redacted charging section."
source_documents: ["EFTA02731082"]
```
Link to: Jeffrey Epstein

### Event 7: Maxwell Directs Victim to Dubin
```
title: "Maxwell directs victim to engage in sex acts with Glenn Dubin"
date: "2001-01-01"
date_precision: "approximate"
event_type: "personal"
description: "Maxwell told victim 'she had to do to Glen what she did for Epstein.' Eva Dubin was present during a separate directed massage. Documented in SDNY prosecution memo Grand Jury 6(e) material."
source_documents: ["EFTA02731082"]
```
Link to: Glenn Dubin, Ghislaine Maxwell, Jeffrey Epstein

## 6. Create New Entity Connections

Use `find_connections` for each entity first to check for existing connections. Then `create_connection` for new ones.

| Source | Target | Type | Strength | Description | Source Docs |
|--------|--------|------|----------|-------------|-------------|
| Glenn Dubin | Ghislaine Maxwell | connected_to | 85 | Maxwell directed victim to engage in sex acts with Dubin (EFTA02731082 p57) |
| Glenn Dubin | Jeffrey Epstein | connected_to | 90 | $53.9M Highbridge investment + Maxwell directed victim to "do to Glen what she did for Epstein" |
| Leslie Wexner | Jeffrey Epstein | connected_to | 95 | Epstein stole "several hundred million dollars" from Wexner; $100M settlement Jan 2008; source of "virtually all of Epstein's wealth" (EFTA02731082 pp64-65) |
| Darren Indyke | Jeffrey Epstein | connected_to | 90 | Epstein's personal attorney; told assistant not to talk to police; brought computer to jail for "video sex" (EFTA02731082 pp41,45) |
| Bill Clinton | Jeffrey Epstein | connected_to | 70 | Africa trip on Epstein's jet with Maxwell and 4 young women (EFTA02731082 pp28,37); previously documented flight logs |

**Note:** Check existing connections first. Wexner↔Epstein and Clinton↔Epstein may already exist. If so, consider updating the description/strength rather than creating duplicates.

## 7. Verification

After all updates:
- `get_entity` for EFTA02731082 document — confirm updated metadata
- `search_documents` for "prosecution memo" — confirm it appears
- `find_connections` for Dubin — confirm new connections
- `find_connections` for Wexner — confirm updated/new connection
- `get_entity` for Dubin — confirm tier and evidence summary
- `search_events` — confirm 7 new events

## Notes

- The 3 redacted subjects in Section IV (the charging analysis) are almost certainly the 3 assistants profiled in Section II.D: two Palm Beach assistants and one girlfriend/sex slave. Their names are known from other documents (Sarah Kellen, Nadia Marcinkova, and one other). Don't speculate on identities in database records — note as "redacted subject" and cross-reference when confirmed.
- The "lent out" victim (Section II.E, pp. 54-60) is almost certainly Virginia Giuffre based on the details about Prince Andrew, Dershowitz, the memoir, and the Sharon Churcher connection. Don't identify her by name in database records per our Tier 5 protocol.
- Victim 9's statement that she recruited "approximately 100 underage girls" for Epstein (p. 18) is significant for understanding the scale of the operation but doesn't create specific database entries.
- The note about "no cameras found in bedrooms or massage rooms" (p. 66) is significant because it contradicts widespread media reporting about Epstein's surveillance/blackmail operation. Worth noting but the absence of evidence isn't evidence of absence — cameras may have been removed before the 2019 search.
