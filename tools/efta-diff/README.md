# efta-diff — differential disclosure analysis

**Status: written, NOT executed. The test suite has never been run.**
See *Verification* below before you trust a single output.

---

## What this is for

When an agency publishes the same document more than once and redacts it
inconsistently, the union of what is visible across releases exceeds what any
single release shows. That is *differential disclosure*, and it is the only
lawful de-redaction technique that reliably works: you are reading what the
government published, in the places where it published it.

This tool finds three things.

| Finding | Meaning | Recoverable? |
|---|---|---|
| `LEAK_TEXT_LAYER` | A redaction box is drawn over text that is **still present in the PDF text layer**. The page looks redacted; the bytes are not. | Yes, from one file |
| `LEAK_DIFFERENTIAL` | A region redacted in release A is **visible in release B** at the same coordinates. | Yes, by comparison |
| `ASYMMETRY` | A box in one release with no counterpart in the other, nothing recoverable behind it. | No — but it evidences an inconsistent redaction *policy*, which is itself a finding under EFTA §2(b) |

Nothing here defeats, removes, or reconstructs a redaction that actually
worked. If the bytes are gone, they are gone.

---

## Why it fingerprints instead of matching on metadata

The obvious approach — find re-released documents by comparing titles, dates
and document types — **cannot work on this corpus.** I checked against the
live index:

- documents with a real title (not just the bates number): **0 of 1000 sampled**
- distinct `document_type` values: **all null**
- page counts: **84% are 1 page, 11% are 2** — no discriminating power

The DOJ stripped the metadata. So matching has to happen on content.
`fingerprint.py` computes two signatures per page:

- **`ink`** — a 16×16 occupancy grid of rendered dark pixels. Survives
  rescanning and requantisation. But *redaction adds ink*, so ink alone would
  push a redacted page away from its unredacted twin.
- **`layout`** — quantised geometry of text spans, ignoring the glyphs. A
  redacted span still occupies space, so the skeleton survives redaction.

Alignment weights layout 0.75 / ink 0.25, which is what lets a redacted page
still match the release where it was left visible. That is the whole trick.
Page order is never assumed.

---

## Layout

```
efta_diff/
  fingerprint.py   page signatures + order-independent alignment
  redactions.py    box detection, text-layer leak detection
  diff.py          two-release comparison
tests/
  make_fixtures.py synthetic PDFs with planted failures
  test_efta_diff.py verification suite
```

## Use

```python
from efta_diff import scan_pdf, compare

# single file — is anything readable under a box?
for f in scan_pdf("EFTA02731420.pdf"):
    if f.kind == "LEAK_TEXT_LAYER":
        print(f.page, f.recovered_text)

# two releases of the same document
res = compare("ds9/EFTA0100.pdf", "oversight/EFTA0100.pdf",
              label_a="DS9", label_b="House Oversight")
print(res["counts"])
for f in res["findings"]:
    if f["kind"] == "LEAK_DIFFERENTIAL":
        print(f"p{f['page_a']} visible in {f['source_release']}: {f['recovered_text']}")
```

---

## Verification — READ THIS

**I wrote these tests. I was not able to run them.** Bash execution was blocked
in the session that produced this code. Every claim below is a claim about what
the tests are *designed* to check, not a report of them passing.

```bash
pip install pymupdf pytest
python -m pytest tests/ -v
```

Seven assertions, each against a planted ground truth:

1. `test_detects_text_layer_leak` — two boxes drawn over live text are both found and both tokens recovered.
2. `test_no_false_leak_on_proper_redaction` — a correctly applied redaction is **not** reported as a leak. **This is the assertion that matters most.** A detector that flags everything manufactures findings, which is the exact failure this project just spent a session correcting in its own entity database.
3. `test_differential_leak_recovers_inconsistently_redacted_text` — release 1 hides both tokens, release 2 hides one; the comparison recovers the second and **must not** recover the first.
4. `test_identical_releases_produce_no_findings` — no phantom findings from a file against itself.
5. `test_alignment_survives_page_reordering` — pages match on content, not position.
6. `test_fingerprint_is_stable` — deterministic.
7. `test_redaction_changes_ink_but_not_alignment` — a redacted page still aligns to its unredacted twin.

If any of these fail, the tool is wrong and its output is not evidence.
Treat test 2 as a gate: **if it fails, stop using the tool entirely.**

---

## Tuning

Constants likely to need adjustment against real DOJ scans, all at module top:

- `redactions.NEAR_BLACK` (0.28) / `NEAR_WHITE` (0.93) — fill thresholds. DOJ
  "white-out" redactions on off-white scans may need `NEAR_WHITE` lowered.
- `redactions.MIN_AREA` (200 pt²) — raise if scan speckle produces noise.
- `diff.OVERLAP_MIN` (0.45) — IoU at which two boxes count as the same
  redaction. Lower it if the same region is drawn at slightly different sizes
  across releases.
- `fingerprint.align(layout_floor=0.35, ink_ceiling=0.30)` — loosen for
  rescanned or skewed material.

## Known limits

- **Image-only pages produce nothing.** Most of this corpus is unsearchable
  scans; `LEAK_TEXT_LAYER` requires a text layer. Run OCR first, and note that
  OCR text is *your* inference, not the document — never cite it as primary.
- Vector-graphic redactions that are not axis-aligned rectangles are missed.
- Alignment is greedy, not optimal. Fine for 2 releases; revisit for N.
- No handling yet of the same document appearing at different scan resolutions.

## Next

- OCR pass so image-only pages participate
- N-way comparison rather than pairwise
- Wire to the corpus index once documents have content behind them — as of
  this writing, **0 of 1,380,395 document records have a file or extracted text**,
  so there is nothing yet for this tool to run against at scale.
