const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const bio = `"Allen Douschewitz" is a name given once in a victim/plaintiff journal entry, alongside "Mr. Caruthers" and "Mr. Islam," as one of three men alleged to have directly abused the diarist. Unlike the other "Mr. X" placeholder entities from the same journal (Federal Worker, Mr. Vradenberg, Bill S., Mr. Jacobson, Mr. Rails, Mr. Caruthers, Mr. Islam), this individual is given a first and last name rather than a surname-only honorific -- but the name itself has not been independently corroborated anywhere else in the corpus, and no confirmation exists that "Douschewitz" is even the correct real-world spelling of whatever name was intended.

The passage, written in the first person by the diarist, reads in full: "It doesnt matter how far away you are. No matter how good you think they are. Even the old president! They will get you. He should have been thinking of Chelsea! Gross! In a plane on a yacht in NY, in DC, at the vineyard. On the island. In palm beach. It doesnt matter. Disgusting pigs like Allen Douschewitz and Mr. Caruthers and even Mr. Islam will hurt you especially if Ghislaine is busy or not with you!" (EFTA02731465 p.2, Bates EFTA02731467; duplicate copy at EFTA00155037 p.12, Bates EFTA00155049).

Read plainly, this is a direct personal-abuse allegation: the diarist names Allen Douschewitz, Mr. Caruthers, and Mr. Islam together as men who would abuse her as substitutes when Ghislaine Maxwell was "busy or not with you." This is the same, materially more serious allegation category documented for Caruthers and Islam, and distinct from the separate "blood on their hands... dont care if this happens" passage on p.5 of the same document (which names Mr. Rails, Mr. Ein, Mr. Jacobson, Mr. Conway, Mr. Vradenberg, and Bill S., and reads as alleged awareness/complicity rather than direct abuse).

No independent real-world identification exists. A corpus-wide search for the exact surname "Douschewitz" returns only the two duplicate copies of this same journal passage -- zero corroboration elsewhere in the 1.38M-page corpus. A round of plausible phonetic/spelling variants was also run (Douchevitz, Douchowitz, Douschowitz, Dushevitz, Dushowitz, Dushewitz, Duschevitz, Duchewitz, Dochewitz, Douchevitch, Deutschowitz) and returned zero hits for every variant. One near-miss, "Doucette," returned OCR-garbled hits inside an unrelated PIMCO financial document (EFTA01484872) with no connection to Epstein's circle or this journal -- ruled out as noise, not a lead. This record stays an unidentified placeholder; the surname as given may itself be misspelled, garbled, or a pseudonym in the original journal.

Provenance corrections that apply to every entity from this journal (per the 2026-07-31 audit and confirmed across the Federal Worker/Vradenberg/Bill S./Jacobson/Rails/Caruthers/Islam sessions): this is NOT Virginia Giuffre's journal -- it is Dataset 12/8 material from the Leon Black prosecution file, belonging to the Doe v. Black plaintiff (1:23-cv-06418 / 1:22-cv-10019). It has NOT been "forensically authenticated" in the sense of dating the entries -- court-appointed examiner Gerald LaPorte could not date them, and Judge Rakoff denied the authentication claim on 2024-07-31. Third-party names in this journal are under a standing court redaction order (Judge Clarke, 1:23-cv-06418, ECF 388) going forward.`;

const tier_justification = `T3 (Circumstantial) -- unclassified_pending_review. Named in a victim/plaintiff journal entry alleging direct personal abuse ("will hurt you... if Ghislaine is busy or not with you"): EFTA02731465 p.2 (Bates EFTA02731467), duplicated at EFTA00155037 p.12 (Bates EFTA00155049). A first and last name is given ("Allen Douschewitz") but that name has zero independent corroboration anywhere in the 1.38M-page corpus and its spelling/accuracy is unverified -- identity remains unresolved. Tier reflects the seriousness of a direct, named allegation in a court-filed journal, not an established identification.`;

const evidence_summary = `CORPUS-VERIFIED 2026-09-22 -- quote located and page-cited (previously cited only as a co-mention inside the Caruthers/Islam records; this is the first pass dedicated to Douschewitz himself), identification search completed negative. Passage: EFTA02731465 p.2 / EFTA00155037 p.12 -- "Disgusting pigs like Allen Douschewitz and Mr. Caruthers and even Mr. Islam will hurt you especially if Ghislaine is busy or not with you!" Read as a direct-abuse allegation (substitute abuser when Maxwell unavailable), same category as Caruthers/Islam, distinct from the separate p.5 "blood on their hands" complicity passage naming Rails/Ein/Jacobson/Conway/Vradenberg/Bill S. in the same document. Exact-name corpus search ("Douschewitz"): 2 hits total, both duplicate copies of this same passage -- no independent corroboration. 11 phonetic/spelling variants searched (Douchevitz, Douchowitz, Douschowitz, Dushevitz, Dushowitz, Dushewitz, Duschevitz, Duchewitz, Dochewitz, Douchevitch, Deutschowitz): zero hits for all. One near-miss variant, "Doucette," returned unrelated OCR noise inside a PIMCO financial document (EFTA01484872) -- checked and ruled unrelated. Not publish-ready -- identity unresolved, spelling of the name itself unverified.`;

const payload = {
  name: 'Allen Douschewitz',
  slug: 'allen-douschewitz',
  entity_type: 'person',
  tier: 3,
  tier_justification,
  category: 'unclassified_pending_review',
  bio,
  status: 'not_investigated',
  aliases: [],
  is_public: false,
  profile_published: false,
  datasets_appeared: [12, 8],
  metadata: {
    aliases: [],
    source_docs: ['EFTA02731465', 'EFTA00155037'],
    evidence_summary,
    corpus_verification_2026_09_22: {
      quote: 'Disgusting pigs like Allen Douschewitz and Mr. Caruthers and even Mr. Islam will hurt you especially if Ghislaine is busy or not with you!',
      reason: 'identity unresolved; name spelling itself unverified; same standing court redaction order applies (Judge Clarke, 1:23-cv-06418, ECF 388)',
      page_cite: 'EFTA02731465 p.2 (Bates EFTA02731467); duplicate EFTA00155037 p.12 (Bates EFTA00155049)',
      searches_run: [
        'exact "Douschewitz" -- 2 hits, both duplicate copies of this same passage, zero independent corroboration',
        '11 phonetic/spelling variants (Douchevitz, Douchowitz, Douschowitz, Dushevitz, Dushowitz, Dushewitz, Duschevitz, Duchewitz, Dochewitz, Douchevitch, Deutschowitz) -- zero hits',
        '"Doucette" near-miss checked directly -- OCR noise inside unrelated PIMCO financial document EFTA01484872, ruled unrelated'
      ],
      publish_ready: false,
      allegation_type: 'direct_personal_abuse',
      identification_search: 'negative',
      new_entity_created: true,
      backlog_origin: 'flagged 2026-09-20 (Caruthers session), carried 2026-09-21 (Islam session), created 2026-09-22 -- closes out the Mr. X journal same-sentence trio (Caruthers/Islam/Douschewitz all now corpus-verified)',
      proposed_connection_not_created: {
        note: 'left for human confirmation per entity-enricher T1-T3 protocol',
        type: 'associate or alleged_abuse',
        target: 'Jeffrey Epstein (c8e78fb9-053a-400d-8630-e690db458545)',
        evidence: 'EFTA02731465 p.2'
      }
    }
  }
};

const res = await fetch(url + '/rest/v1/entities', {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  },
  body: JSON.stringify(payload)
});

const text = await res.text();
console.log('STATUS', res.status);
console.log(text);
