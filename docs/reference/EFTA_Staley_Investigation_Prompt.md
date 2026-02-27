# Jes Staley Investigation — Corpus Deep Dive

## Mission

Use the MCP server's corpus search tools to systematically investigate Jes Staley's 7,058-document footprint across the EFTA corpus. Staley is Tier 1 — DANY identified him as an abuser during their June 2023 briefing to SDNY ("DANY believes victim also abused by Staley"). He resigned as Barclays CEO in 2021 over Epstein ties and previously ran JPMorgan's asset management division during the period JPM serviced ~$99M across Epstein entity accounts.

## What We Already Know (from DS12 analysis)

- **EFTA02731662** (20pp): DANY/SDNY master email chain. June 2023 briefing names Staley alongside Brunel. "DANY believes victim also abused by Staley."
- **EFTA02731737** (17pp): Variant of master chain. Also references Staley.
- **EFTA02674602**: DS9 financial valuation package. As JPM head of asset management, Staley oversaw institutional relationship — JPM ran derivatives, structured notes, FX options, commodity options, total return swaps across 3 Epstein entity accounts totaling ~$99M.
- Known aliases: "Jes", "James E. Staley", "James Edward Staley"
- Resigned Barclays November 2021 after UK FCA investigation into Epstein relationship
- Previously: JPMorgan Chase head of asset management, then CEO of private bank

## What We're Looking For

### Tier 1: Direct Evidence (highest priority)
- Any emails between Staley and Epstein (or Epstein's assistants: Sarah Kellen, Lesley Groff, Nadia Marcinkova)
- References to Staley in victim testimony, FBI 302s, or prosecution documents
- Staley on flight logs or scheduling documents
- Any documents linking Staley to Epstein properties (Palm Beach, NYC, USVI, NM)

### Tier 2: Institutional/Financial (high priority)
- JPMorgan internal communications about Staley-Epstein relationship
- Barclays investigation documents
- FCA regulatory findings
- DANY investigation documents beyond the two we already have
- Any reference to Staley in the context of the JPMorgan-Epstein banking relationship

### Tier 3: Network/Context (medium priority)  
- Staley mentioned alongside other Tier 1 suspects
- Social events, dinners, or gatherings where Staley appears
- Any communications about Staley from third parties

## Tools to Use

Start the MCP server and connect, then use these tools:

1. **`corpus_search`** — Full-text search across 1.38M docs. Start with:
   - "Jes Staley" (exact name)
   - "James Staley" (formal name)
   - "Staley" AND "Epstein" (co-occurrence)
   - "Staley" AND "JPMorgan" or "JPMC"
   - "Staley" AND "Barclays"

2. **`corpus_count_entity_mentions`** — Get document/page counts with dataset breakdown. Run for:
   - Name: "Jes Staley", aliases: ["James Staley", "James E. Staley", "J. Staley"]

3. **`corpus_get_document_text`** — Pull full text of high-value documents found via search. Prioritize:
   - Any document with Staley + victim language
   - Any direct Staley-Epstein correspondence
   - Any DANY/SDNY documents referencing Staley beyond 02731662/02731737
   - Any JPMorgan internal documents about the Epstein relationship

4. **`corpus_search_redactions`** — Check if Staley's name appears in redaction analysis data (reconstructed text, extracted entities)

5. **`corpus_resolve_url`** — Get external links (Jmail, DOJ, Carstensen) for key documents

6. **`get_entity_external_links`** — Pull Staley's external research URLs (Jmail person page, rhowardstone report, etc.)

7. **`search_external_entities`** — Check what the rhowardstone registry has on Staley

## Approach

### Phase 1: Reconnaissance (do this first)
- Run `corpus_count_entity_mentions` for Staley + aliases to get the dataset distribution
- Run `get_entity_external_links` for "Jes Staley" to see what external sources exist
- Run `search_external_entities` for "Staley" to check rhowardstone registry

### Phase 2: Targeted Search (based on Phase 1 results)
- Use `corpus_search` with targeted queries against the datasets where Staley appears most
- Focus on DS9 (emails — likely highest hit count) and any surprises from other datasets
- Pull full text of the most promising documents via `corpus_get_document_text`

### Phase 3: Evidence Assembly
- For each significant document found, note: EFTA number, dataset, document type, what it establishes, which entities appear, any redaction patterns
- Map connections: Who else appears in Staley documents? What dates/locations are mentioned?
- Identify cross-references to documents we already have in our database

## Output

Produce a structured findings report with:
1. **Document inventory** — Every significant Staley document found, categorized by evidence type
2. **Timeline** — Chronological sequence of Staley-Epstein interactions
3. **Key quotes/evidence** — Direct text from the most important documents
4. **Network map** — Who else appears in Staley's document universe
5. **Redaction analysis** — Any suspicious redaction patterns around Staley
6. **Open questions** — What the documents raise but don't answer
7. **Recommended next steps** — Specific documents or leads to pursue

Save the report as `EFTA_Staley_Investigation_Report.md` in the project.
