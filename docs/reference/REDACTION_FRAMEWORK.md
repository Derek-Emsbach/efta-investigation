# Redaction Analysis Framework

## Categories

### Category A: Victim Protection
**Legitimacy:** Legitimate
**Action:** Note and move on
**Description:** Redaction protecting victim identity, including names, addresses, contact information, identifying details of minor victims, and medical/psychological records.
**EFTA Basis:** Section 2(a) permits withholding to protect victim privacy

### Category B: Legal Privilege
**Legitimacy:** Provisionally legitimate — verify the claim holds
**Action:** Document and verify
**Description:** Attorney-client privilege, grand jury material (Rule 6(e)), ongoing investigation protection, national security classifications, law enforcement technique protection.
**EFTA Basis:** Section 2(a) permits withholding for specific legal privileges
**Red flags:** Overly broad privilege claims, privilege applied to non-privileged content within same document

### Category C: Institutional Protection
**Legitimacy:** Often suspect under EFTA
**Action:** Flag for review, high scrutiny
**Description:** Protects government officials, prosecutors, or institutional decision-making from embarrassment or accountability. Often covers: prosecutor names, internal deliberation about whether to prosecute, policy decisions, inter-agency communications about case handling.
**EFTA Basis:** Section 2(b) EXPLICITLY PROHIBITS redactions "solely to prevent embarrassment" to individuals or institutions
**Red flags:** Names of government employees redacted (they have reduced privacy expectations in official capacity), decision rationale hidden, same official's name redacted in one doc but visible in another

### Category D: Perpetrator Protection
**Legitimacy:** Suspect — highest scrutiny
**Action:** Flag immediately, catalog, cross-reference
**Description:** Names of powerful, wealthy, or politically connected individuals systematically redacted while less powerful individuals' names are visible. The most concerning pattern in the EFTA releases.
**EFTA Basis:** No EFTA exemption permits protecting perpetrators from accountability
**Red flags:** Asymmetric protection (victim details exposed, perpetrator hidden), systematic pattern across multiple documents, "potential targets" references with names redacted

## Red Flag Indicators

1. **Inconsistent redaction:** Same name redacted in Document A but visible in Document B
2. **Conclusion suppression:** Factual background visible but recommendations/decisions blanked
3. **Asymmetric protection:** Victim identifying details exposed while associated perpetrator names hidden
4. **Over-broad redaction:** Entire paragraphs blacked out when only a specific name needed protection
5. **Metadata leaks:** Names surviving in email headers, CC fields, or casual sign-offs while redacted in body text
6. **Pattern across datasets:** Same entity systematically protected across multiple documents/datasets

## Assessment Ratings

- **LIKELY VIOLATION:** Redaction appears to violate EFTA Section 2(b) prohibition on embarrassment-based redactions
- **SUSPECT:** Redaction raises questions but insufficient evidence to determine violation
- **UNCLEAR:** Cannot determine legitimacy without additional context
- **NEEDS RESEARCH:** Requires cross-referencing with other documents or legal analysis
- **REVIEW FAILURE:** Redaction system failed (information visible that should have been redacted, or vice versa)

## DS12 Documented Redaction Failures

1. **EFTA02731623:** DANY ADAs Wimmer, Puzio, Saxtein — names in clear text, redacted everywhere else
2. **EFTA02731783:** SDNY AUSA Lauren Phillips — name leaked in email header metadata
3. **EFTA02731771:** "Jane" — SDNY CRU AUSA first name survived in casual email sign-off
4. **Multiple documents:** Victim birth year, employer, family details exposed while perpetrator "potential targets" hidden
5. **EFTA02731069:** Corporate prosecution assessment conclusion page completely blanked — institutional decision concealed
