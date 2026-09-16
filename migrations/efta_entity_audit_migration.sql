-- ============================================================================
-- EFTA ENTITY AUDIT — CORRECTIVE MIGRATION
-- Generated 2026-07-31.  REVIEW BEFORE RUNNING.
--
-- Audited all 151 entities. 128 defective.
-- This migration UNPUBLISHES unsafe records, corrects tiers and categories,
-- and flags extraction artefacts for deletion. It DELETES NOTHING.
--
-- BACKUP FIRST:
--   CREATE TABLE entities_backup_20260731 AS SELECT * FROM entities;
-- ROLLBACK:
--   UPDATE entities e SET is_public=b.is_public, profile_published=b.profile_published,
--     tier=b.tier, category=b.category, metadata=b.metadata
--   FROM entities_backup_20260731 b WHERE e.id=b.id;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS entities_backup_20260731 AS SELECT * FROM entities;


-- ---------------------------------------------------------------------------
-- 1. UNPUBLISH — records not safe to publish as-is
-- ---------------------------------------------------------------------------

-- Adriana Ross: Add the SDFL-only limitation to the NPA reference; the co-conspirator clause named exactly four women and bound only the Southern District of Florida.
-- Alexander Acosta: State the OPR finding accurately: the November 2020 OPR report concluded Acosta exercised ''poor judgment'' and did NOT find professional misconduct
-- Alissa Wimmer: Keep permanently unpublished
-- AllianceBernstein Holding L.P.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Apollo Global Management LLC: Correct the core fact: the $158M was paid by Leon Black PERSONALLY, from his own and family funds. The Dechert review commissioned by Apollo (January 2021) found Apollo never retai
-- Ares Management, L.P.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Athene: Delete
-- Barnaby Mars: Correct the name to Barnaby Marsh before any further publication — the record itself notes ''Barnaby Mars'' is an OCR artifact
-- Bill Gates: Replace ''smoking gun proving'' with what the document actually shows
-- Bill Richardson: Correct the death date to 1 September 2023.
-- BlackRock Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Brad Karp: Replace ''recruiting'' — in a trafficking database the word carries a meaning the underlying emails (a law-firm hiring approach) do not support
-- Brit Insurance: Delete
-- Bruce Reinhart: Unpublish immediately and rewrite
-- CNS: Delete
-- Celina Edith Dubin: Unpublish
-- Donald Trump: Add Trump''s denial, prominently.
-- Douglas Wigdor: Note the April 2026 sanctions and fee award against Wigdor LLP in Doe v. Black, which bear on the reliability of material this database sources to the firm
-- Dr. Chen: Unpublish immediately
-- Ehud Barak: Downgrade to Tier 4. The record''s own content contains no allegation of criminal participation.
-- Erica: Keep unpublished
-- Eva Andersson-Dubin: Strike ''potentially participatory'' or state precisely what the memo says
-- Federated Investors, Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Franklin Resources Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Gerd (Epstein associate): Unpublish immediately
-- Glenn Dubin: Downgrade to Tier 3. Dubin has never been charged; Tier 1 on this project''s own scale means convicted or charged.
-- Great Wolf Resorts: Delete
-- Harry Beller: Cite the minutes claim or delete it
-- Horowitz: Keep unpublished — a surname-only attorney record is a misidentification waiting to happen
-- Howard Lutnick: Add the anonymous-unevaluated-tip caveat to the Ponzi/money-laundering line, matching the framing used in the Wexner record, or delete the line.
-- Invesco: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Ion: Keep permanently unpublished
-- Jane (first name only): Delete — a bare first name from an email sign-off is not an identifiable entity and cannot be published without risking attachment to the wrong person
-- Janus Capital Group Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Jeanne Christensen: Add the material fact the record omits: Judge Jessica Clarke sanctioned Christensen in Doe v. Black (23 April 2026), finding counsel lied repeatedly to the court and to opposing co
-- Jeffrey Epstein: DELETE the ''forensically authenticated'' claim entirely, or replace it with the actual procedural history: examiner could not date entries; Rakoff denied the claim 31 Jul 2024; Cl
-- Jeffrey Fuller: Downgrade ''confirmed'' to ''a June 2010 FBI tip reported that…''
-- Jes Staley: IMMEDIATELY change category from ''abuser''. Nothing in this record supports it.
-- Jim Atkins: Keep published=false. This is correct and should not change while the person is unidentified.
-- Juan Alessi: Frame the ''thief'' quote explicitly as Epstein''s discrediting attempt in the same sentence, not as a bare quotation
-- KKR & Co. L.P.: Produce the EFTA document numbers or delete the record
-- Karyna Shuliak: Unpublish pending an assessment of whether she should be treated as a victim rather than an associate
-- Kathryn Ruemmler: Supply the trust and will citations or withdraw the claim — being named in Epstein''s will is a specific, damaging and checkable assertion
-- LPL Investment Holdings Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Lauren Phillips: Keep permanently unpublished
-- Lawrence Visoski: Remove ''corporate front'' and the ''Fraudulent Transfers'' heading, or attribute the fraud characterisation to whoever actually made it
-- Leah Saxtein: Keep permanently unpublished
-- Legg Mason Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Leon Black: DELETE the ''forensically authenticated ... no fabrication'' sentence. It is the single most dangerous statement in the database.
-- Les Wexner: Delete the ''FBI co-conspirator chart listing'' claim or cite the specific chart, document and page.
-- Liston Abramson: Correct entity_type: Liston Abramson LLP is a law firm, not a person
-- MSCI: Delete — an index, an exchange and a data vendor are not participants in anything
-- Mark Epstein: Correct or drop the grand jury claim — the corpus elsewhere cites EFTA01249325, a 2009 civil deposition, not grand jury testimony
-- Michael J. Cyprys: Delete immediately
-- Mona Juul: Add the 8 Feb 2026 Okokrim charge, with a source, and state plainly that it is a CORRUPTION charge with no sexual-offence component.
-- Morgan Stanley & Co. LLC: Delete or convert to a document-provenance field on the research report itself
-- Morgan Stanley C.T.V.M. S.A.: Delete or convert to a document-provenance field on the research report itself
-- Morgan Stanley Canada Limited: Delete or convert to a document-provenance field on the research report itself
-- Morgan Stanley Mexico, Casa de Bolsa SA de C.V.: Delete or convert to a document-provenance field on the research report itself
-- NASD: Delete
-- NYSE: Delete — an index, an exchange and a data vendor are not participants in anything
-- Nadia Marcinkova: Replace ''Reported missing since early Jan 2024'' with an accurate statement (no verified public whereabouts; no missing-person report identified).
-- Nicholas Stelzner: Delete immediately
-- OM Asset Management Plc: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Oaktree Capital Group, LLC: Produce the EFTA document numbers or delete the record
-- Oppenheimer Funds: Delete
-- Paul Morris: Keep unpublished
-- Peter Mandelson: Rewrite or delete the ''Svet'' line. Either state precisely what the document says, with a page reference and no implication beyond it, or remove it.
-- Richard Branson: Resolve the EFTA01779732 collision; at least two of the three uses are misattributed
-- Richard D. Kahn: Change category from ''inner_circle'' immediately — the record''s own text says ''Tier 6 (financial)'' and ''No criminal charges''
-- S&P 500: Delete — an index, an exchange and a data vendor are not participants in anything
-- Sarah Kellen: Cite the Judge Nathan quotation to a specific opinion, docket entry, date and page, and add the caveat that an evidentiary co-conspirator finding is not a finding of criminal guilt
-- Sergio Cordero: Keep unpublished
-- Simone: Keep unpublished — a first-name-only administrator of a victims'' compensation fund sits directly adjacent to claimant identities
-- Sprouts: Delete
-- Stewart Oldfield: Keep unpublished
-- Sultan Ahmed bin Sulayem: Unpublish immediately
-- T. Rowe Price Group, Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- TOPIX: Delete — an index, an exchange and a data vendor are not participants in anything
-- Tazia Smith: Keep unpublished
-- Terje Rød-Larsen: Add the 8 Feb 2026 Okokrim charge, with a source, stating expressly that it is a corruption charge with no sexual-offence component and that ''siktet'' is formal suspicion, not ind
-- The Blackstone Group LP: Produce the EFTA document numbers or delete the record
-- The Carlyle Group LP: Produce the EFTA document numbers or delete the record
-- Thomson Reuters: Delete — an index, an exchange and a data vendor are not participants in anything
-- Valdson Cotrin: Keep permanently unpublished
-- Vanessa Puzio: Keep permanently unpublished
-- Virginia Giuffre: Delete the journal attribution entirely: EFTA02731420/02731465 are Dataset 12 (Leon Black file) and belong to the Doe v. Black plaintiff (1:23-cv-06418), NOT Giuffre — per the proj
-- Virtus Investment Partners Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- Waddell & Reed Financial Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area
-- WisdomTree Investments, Inc.: Delete, or move to a non-investigative ''corpus noise'' holding area

UPDATE entities SET is_public=false, profile_published=false, updated_at=now()
 WHERE name IN ('Adriana Ross', 'Alexander Acosta', 'Alissa Wimmer', 'AllianceBernstein Holding L.P.', 'Apollo Global Management LLC', 'Ares Management, L.P.', 'Athene', 'Barnaby Mars', 'Bill Gates', 'Bill Richardson', 'BlackRock Inc.', 'Brad Karp', 'Brit Insurance', 'Bruce Reinhart', 'CNS', 'Celina Edith Dubin', 'Donald Trump', 'Douglas Wigdor', 'Dr. Chen', 'Ehud Barak', 'Erica', 'Eva Andersson-Dubin', 'Federated Investors, Inc.', 'Franklin Resources Inc.', 'Gerd (Epstein associate)', 'Glenn Dubin', 'Great Wolf Resorts', 'Harry Beller', 'Horowitz', 'Howard Lutnick', 'Invesco', 'Ion', 'Jane (first name only)', 'Janus Capital Group Inc.', 'Jeanne Christensen', 'Jeffrey Epstein', 'Jeffrey Fuller', 'Jes Staley', 'Jim Atkins', 'Juan Alessi', 'KKR & Co. L.P.', 'Karyna Shuliak', 'Kathryn Ruemmler', 'LPL Investment Holdings Inc.', 'Lauren Phillips', 'Lawrence Visoski', 'Leah Saxtein', 'Legg Mason Inc.', 'Leon Black', 'Les Wexner', 'Liston Abramson', 'MSCI', 'Mark Epstein', 'Michael J. Cyprys', 'Mona Juul', 'Morgan Stanley & Co. LLC', 'Morgan Stanley C.T.V.M. S.A.', 'Morgan Stanley Canada Limited', 'Morgan Stanley Mexico, Casa de Bolsa SA de C.V.', 'NASD', 'NYSE', 'Nadia Marcinkova', 'Nicholas Stelzner', 'OM Asset Management Plc', 'Oaktree Capital Group, LLC', 'Oppenheimer Funds', 'Paul Morris', 'Peter Mandelson', 'Richard Branson', 'Richard D. Kahn', 'S&P 500', 'Sarah Kellen', 'Sergio Cordero', 'Simone', 'Sprouts', 'Stewart Oldfield', 'Sultan Ahmed bin Sulayem', 'T. Rowe Price Group, Inc.', 'TOPIX', 'Tazia Smith', 'Terje Rød-Larsen', 'The Blackstone Group LP', 'The Carlyle Group LP', 'Thomson Reuters', 'Valdson Cotrin', 'Vanessa Puzio', 'Virginia Giuffre', 'Virtus Investment Partners Inc.', 'Waddell & Reed Financial Inc.', 'WisdomTree Investments, Inc.');


-- ---------------------------------------------------------------------------
-- 2. TIER CORRECTIONS
-- ---------------------------------------------------------------------------

-- Ehud Barak: T3 -> T4  (NEVER CHARGED, NEVER SUED in connection with Epstein, in any jurisdiction. Faced substantial press scrutiny in)
UPDATE entities SET tier=4, updated_at=now() WHERE name='Ehud Barak';
-- Glenn Dubin: T1 -> T3  (NEVER CHARGED, NEVER CONVICTED. No criminal charge in any jurisdiction. Named by Virginia Giuffre in a 2016 de)
UPDATE entities SET tier=3, updated_at=now() WHERE name='Glenn Dubin';
-- Howard Lutnick: T3 -> T4  (NEVER CHARGED, NEVER SUED in connection with Epstein. Sitting US Secretary of Commerce. Interviewed by the Hou)
UPDATE entities SET tier=4, updated_at=now() WHERE name='Howard Lutnick';
-- Jes Staley: T1 -> T3  (NEVER CRIMINALLY CHARGED anywhere. Regulatory only: the FCA banned him from senior UK financial services roles)
UPDATE entities SET tier=3, updated_at=now() WHERE name='Jes Staley';
-- Leon Black: T1 -> T3  (NEVER CRIMINALLY CHARGED. SDNY reviewed and declined; DANY investigated 2021-2024 without charging. Civil: Gan)
UPDATE entities SET tier=3, updated_at=now() WHERE name='Leon Black';
-- Mona Juul: T3 -> T1  (CHARGED (Norwegian ''siktet''). On 8 Feb 2026 Okokrim, Norway''s economic crime authority, charged Juul with s)
UPDATE entities SET tier=1, updated_at=now() WHERE name='Mona Juul';
-- Terje Rød-Larsen: T3 -> T1  (CHARGED (Norwegian ''siktet''). On 8 Feb 2026 Okokrim charged Rod-Larsen as an accessory to / with contributin)
UPDATE entities SET tier=1, updated_at=now() WHERE name='Terje Rød-Larsen';

-- ---------------------------------------------------------------------------
-- 3. CATEGORY CORRECTIONS — 'abuser' applied without an abuse allegation
-- ---------------------------------------------------------------------------

-- Alexander Acosta: 'law_enforcement' -> 'legal — federal prosecutor/DOJ official'
UPDATE entities SET category='legal — federal prosecutor/DOJ official', updated_at=now() WHERE name='Alexander Acosta';
-- AllianceBernstein Holding L.P.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='AllianceBernstein Holding L.P.';
-- Apollo Global Management LLC: 'financial' -> 'financial — Leon Black''s employer, no institutional finding'
UPDATE entities SET category='financial — Leon Black''s employer, no institutional finding', updated_at=now() WHERE name='Apollo Global Management LLC';
-- Ares Management, L.P.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Ares Management, L.P.';
-- Athene: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Athene';
-- BlackRock Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='BlackRock Inc.';
-- Brit Insurance: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Brit Insurance';
-- Bruce Reinhart: 'legal' -> 'legal — defence counsel; note current judicial office'
UPDATE entities SET category='legal — defence counsel; note current judicial office', updated_at=now() WHERE name='Bruce Reinhart';
-- CNS: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='CNS';
-- Celina Edith Dubin: 'associate' -> 'third_party_beneficiary (not an associate)'
UPDATE entities SET category='third_party_beneficiary (not an associate)', updated_at=now() WHERE name='Celina Edith Dubin';
-- Dr. Chen: 'witness' -> 'unidentified_reference — do not treat as an entity'
UPDATE entities SET category='unidentified_reference — do not treat as an entity', updated_at=now() WHERE name='Dr. Chen';
-- Eva Andersson-Dubin: 'associate' -> 'associate — with the participation language removed'
UPDATE entities SET category='associate — with the participation language removed', updated_at=now() WHERE name='Eva Andersson-Dubin';
-- Federated Investors, Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Federated Investors, Inc.';
-- Franklin Resources Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Franklin Resources Inc.';
-- Gerd (Epstein associate): 'witness' -> 'unidentified_reference — do not treat as an entity'
UPDATE entities SET category='unidentified_reference — do not treat as an entity', updated_at=now() WHERE name='Gerd (Epstein associate)';
-- Glenn Dubin: 'alleged_abuser' -> 'alleged_abuser (Tier 3, allegation denied)'
UPDATE entities SET category='alleged_abuser (Tier 3, allegation denied)', updated_at=now() WHERE name='Glenn Dubin';
-- Great Wolf Resorts: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Great Wolf Resorts';
-- Horowitz: 'attorney' -> 'unidentified — surname only'
UPDATE entities SET category='unidentified — surname only', updated_at=now() WHERE name='Horowitz';
-- Invesco: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Invesco';
-- Ion: 'witness' -> 'unidentified individual — possible victim, do not publish'
UPDATE entities SET category='unidentified individual — possible victim, do not publish', updated_at=now() WHERE name='Ion';
-- Jane (first name only): 'prosecutor' -> 'not an entity — delete'
UPDATE entities SET category='not an entity — delete', updated_at=now() WHERE name='Jane (first name only)';
-- Janus Capital Group Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Janus Capital Group Inc.';
-- Jean-Luc Brunel: 'abuser' -> 'alleged_abuser (charged, died before trial)'
UPDATE entities SET category='alleged_abuser (charged, died before trial)', updated_at=now() WHERE name='Jean-Luc Brunel';
-- Jes Staley: 'abuser' -> 'financial_enabler / associate'
UPDATE entities SET category='financial_enabler / associate', updated_at=now() WHERE name='Jes Staley';
-- Jim Atkins: 'associate' -> 'unidentified_alleged_perpetrator'
UPDATE entities SET category='unidentified_alleged_perpetrator', updated_at=now() WHERE name='Jim Atkins';
-- KKR & Co. L.P.: 'financial' -> 'no established Epstein connection — candidate for deletion'
UPDATE entities SET category='no established Epstein connection — candidate for deletion', updated_at=now() WHERE name='KKR & Co. L.P.';
-- Karyna Shuliak: 'associate' -> 'partner/beneficiary — victim status unassessed'
UPDATE entities SET category='partner/beneficiary — victim status unassessed', updated_at=now() WHERE name='Karyna Shuliak';
-- LPL Investment Holdings Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='LPL Investment Holdings Inc.';
-- Legg Mason Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Legg Mason Inc.';
-- Leon Black: 'abuser' -> 'alleged_abuser (civil claim pending, allegations denied)'
UPDATE entities SET category='alleged_abuser (civil claim pending, allegations denied)', updated_at=now() WHERE name='Leon Black';
-- Liston Abramson: 'attorney' -> 'organization — law firm'
UPDATE entities SET category='organization — law firm', updated_at=now() WHERE name='Liston Abramson';
-- MSCI: 'financial' -> 'not an entity — delete'
UPDATE entities SET category='not an entity — delete', updated_at=now() WHERE name='MSCI';
-- Michael J. Cyprys: 'financial' -> 'document author — not an entity'
UPDATE entities SET category='document author — not an entity', updated_at=now() WHERE name='Michael J. Cyprys';
-- Morgan Stanley & Co. LLC: 'financial' -> 'document provenance metadata — not an entity'
UPDATE entities SET category='document provenance metadata — not an entity', updated_at=now() WHERE name='Morgan Stanley & Co. LLC';
-- Morgan Stanley C.T.V.M. S.A.: 'financial' -> 'document provenance metadata — not an entity'
UPDATE entities SET category='document provenance metadata — not an entity', updated_at=now() WHERE name='Morgan Stanley C.T.V.M. S.A.';
-- Morgan Stanley Canada Limited: 'financial' -> 'document provenance metadata — not an entity'
UPDATE entities SET category='document provenance metadata — not an entity', updated_at=now() WHERE name='Morgan Stanley Canada Limited';
-- Morgan Stanley Mexico, Casa de Bolsa SA de C.V.: 'financial' -> 'document provenance metadata — not an entity'
UPDATE entities SET category='document provenance metadata — not an entity', updated_at=now() WHERE name='Morgan Stanley Mexico, Casa de Bolsa SA de C.V.';
-- NASD: 'government' -> 'not an entity — delete; also defunct'
UPDATE entities SET category='not an entity — delete; also defunct', updated_at=now() WHERE name='NASD';
-- NYSE: 'financial' -> 'not an entity — delete'
UPDATE entities SET category='not an entity — delete', updated_at=now() WHERE name='NYSE';
-- Nadia Marcinkova: 'operational' -> 'operational / possible victim (dual status - NPA-named, never charged)'
UPDATE entities SET category='operational / possible victim (dual status - NPA-named, never charged)', updated_at=now() WHERE name='Nadia Marcinkova';
-- Nicholas Stelzner: 'financial' -> 'document author — not an entity'
UPDATE entities SET category='document author — not an entity', updated_at=now() WHERE name='Nicholas Stelzner';
-- OM Asset Management Plc: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='OM Asset Management Plc';
-- Oaktree Capital Group, LLC: 'financial' -> 'no established Epstein connection — candidate for deletion'
UPDATE entities SET category='no established Epstein connection — candidate for deletion', updated_at=now() WHERE name='Oaktree Capital Group, LLC';
-- Oppenheimer Funds: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Oppenheimer Funds';
-- Paul Morris: 'financial' -> 'bank employee — no finding against him'
UPDATE entities SET category='bank employee — no finding against him', updated_at=now() WHERE name='Paul Morris';
-- Richard D. Kahn: 'inner_circle' -> 'legal/financial professional'
UPDATE entities SET category='legal/financial professional', updated_at=now() WHERE name='Richard D. Kahn';
-- S&P 500: 'financial' -> 'not an entity — delete'
UPDATE entities SET category='not an entity — delete', updated_at=now() WHERE name='S&P 500';
-- Sergio Cordero: 'associate' -> 'informant/source (not associate)'
UPDATE entities SET category='informant/source (not associate)', updated_at=now() WHERE name='Sergio Cordero';
-- Sprouts: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Sprouts';
-- Stewart Oldfield: 'financial' -> 'bank employee — no finding against him'
UPDATE entities SET category='bank employee — no finding against him', updated_at=now() WHERE name='Stewart Oldfield';
-- Sultan Ahmed bin Sulayem: 'financial' -> 'unknown — record has no content'
UPDATE entities SET category='unknown — record has no content', updated_at=now() WHERE name='Sultan Ahmed bin Sulayem';
-- T. Rowe Price Group, Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='T. Rowe Price Group, Inc.';
-- TOPIX: 'financial' -> 'not an entity — delete'
UPDATE entities SET category='not an entity — delete', updated_at=now() WHERE name='TOPIX';
-- Tazia Smith: 'financial' -> 'bank employee — no finding against her'
UPDATE entities SET category='bank employee — no finding against her', updated_at=now() WHERE name='Tazia Smith';
-- The Blackstone Group LP: 'financial' -> 'no established Epstein connection — candidate for deletion'
UPDATE entities SET category='no established Epstein connection — candidate for deletion', updated_at=now() WHERE name='The Blackstone Group LP';
-- The Carlyle Group LP: 'financial' -> 'no established Epstein connection — candidate for deletion'
UPDATE entities SET category='no established Epstein connection — candidate for deletion', updated_at=now() WHERE name='The Carlyle Group LP';
-- Thomson Reuters: 'media' -> 'not an entity — delete'
UPDATE entities SET category='not an entity — delete', updated_at=now() WHERE name='Thomson Reuters';
-- Virtus Investment Partners Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Virtus Investment Partners Inc.';
-- Waddell & Reed Financial Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='Waddell & Reed Financial Inc.';
-- WisdomTree Investments, Inc.: 'financial' -> 'not an entity in this investigation — delete'
UPDATE entities SET category='not an entity in this investigation — delete', updated_at=now() WHERE name='WisdomTree Investments, Inc.';

-- ---------------------------------------------------------------------------
-- 4. JOURNAL-SOURCED RECORDS (already applied 2026-07-31; included for completeness)
-- ---------------------------------------------------------------------------

-- Names the victim explicitly declared FALSE at EFTA02731420 p.6.
-- "...are not who they say! Run run run!"  These are NOT people.
UPDATE entities SET tier=NULL, category='unidentified_alias', status='alias_declared_false_by_victim',
  is_public=false, profile_published=false, updated_at=now()
 WHERE name IN ('Mr. Atkins', 'Mr. Cecchi', 'Mr. Goodlatte', 'Mr. Ludwig', 'Mr. Mody', 'Mr. Mora', 'Mr. Sant');


-- ---------------------------------------------------------------------------
-- 5. EXTRACTION ARTEFACTS — flagged for DELETION after your review
-- ---------------------------------------------------------------------------
-- ~20 'entities' extracted from the disclosure boilerplate and comparables
-- table of ONE 1 Apr 2015 Morgan Stanley equity research report on Apollo.
-- Includes two named private research analysts whose only connection is authorship.
UPDATE entities SET is_public=false, profile_published=false, updated_at=now()
 WHERE name IN ('AllianceBernstein', 'BlackRock', 'T. Rowe Price', 'Invesco', 'Legg Mason', 'MSCI', 'S&P 500', 'TOPIX', 'NYSE', 'NASD', 'Thomson Reuters', 'Michael J. Cyprys', 'Nicholas Stelzner', 'KKR', 'Oaktree', 'Carlyle', 'The Carlyle Group', 'Janus Capital Group Inc.', 'Athene', 'The Blackstone Group LP');
-- After review:
-- DELETE FROM entities WHERE name IN ('AllianceBernstein', 'BlackRock', 'T. Rowe Price', 'Invesco', 'Legg Mason', 'MSCI', 'S&P 500', 'TOPIX', 'NYSE', 'NASD', 'Thomson Reuters', 'Michael J. Cyprys', 'Nicholas Stelzner', 'KKR', 'Oaktree', 'Carlyle', 'The Carlyle Group', 'Janus Capital Group Inc.', 'Athene', 'The Blackstone Group LP');

-- Five prosecutors who exist as entities ONLY because a DOJ redaction failed.
-- No allegation attached to any of them. Republishing what redaction withheld
-- is the mirror of the conduct this investigation documents.
UPDATE entities SET is_public=false, profile_published=false, updated_at=now()
 WHERE name IN ('Alissa Wimmer', 'Leah Saxtein', 'Vanessa Puzio', 'Lauren Phillips', 'Jane (first name only)');
-- DELETE FROM entities WHERE name IN ('Alissa Wimmer', 'Leah Saxtein', 'Vanessa Puzio', 'Lauren Phillips', 'Jane (first name only)');


-- ---------------------------------------------------------------------------
-- 6. SPECIFIC FACTUAL ERRORS — verified against primary/reported sources
-- ---------------------------------------------------------------------------
-- Ghislaine Maxwell: NOT at FCI Tallahassee. Moved to FPC Bryan, Texas, 1 Aug 2025.
--   Also: no longer "the ONLY associate charged post-death" (Brunel; 2026 UK arrests;
--   Norwegian charges against Juul and Rod-Larsen).
-- Bill Richardson: died 1 September 2023, not 28 August.
-- Apollo Global Management: the $158M was paid by LEON BLACK PERSONALLY. The Dechert
--   review (Jan 2021) found Apollo never retained Epstein and no fund money was involved.
--   The record's claim against the listed company is false. THIS RECORD IS LIVE.
-- Alexander Acosta: was the U.S. Attorney, not law enforcement. OPR found "poor
--   judgment", NOT professional misconduct. NPA co-conspirator clause named FOUR
--   women and bound only S.D. Fla. -- it was never "blanket".
-- Leon Black: never criminally charged. Judge Clarke (24 Apr 2026) found the plaintiff
--   falsified sonograms, ordered a jury instruction, found spoliation, and sanctioned
--   Wigdor LLP. The record's "no fabrication" parenthetical is the inverse of the record.
-- Jes Staley: never criminally charged anywhere. UK Upper Tribunal (26 Jun 2025) upheld
--   an FCA prohibition + ~GBP 1.1m penalty for recklessly approving a letter that
--   downplayed his friendship with Epstein -- a regulatory integrity finding only.
-- Mona Juul / Terje Rod-Larsen: CHARGED (siktet) with aggravated corruption by
--   Okokrim, 8 Feb 2026. Absent from both records. Corruption, not abuse.
-- Virginia Giuffre: died April 2025; status field still null. Her record attributes the
--   DS12 journals to her -- they belong to the Doe v. Black plaintiff.

COMMIT;
