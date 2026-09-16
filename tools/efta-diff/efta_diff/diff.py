"""Differential disclosure: compare releases of the same document.

When an agency publishes a document more than once and redacts it
inconsistently, the union of what is visible across releases exceeds what any
single release shows. This module aligns two releases page-by-page (by
structural fingerprint, not by page order) and reports:

  LEAK_DIFFERENTIAL   a region redacted in release A whose text is visible in
                      release B at the same coordinates
  ASYMMETRY           a box present in one release and absent in the other,
                      with nothing recoverable -- evidence of an inconsistent
                      redaction policy even when the content stays hidden
"""
from __future__ import annotations
from dataclasses import dataclass, asdict

try:
    import fitz
except ImportError:  # pragma: no cover
    fitz = None

from .fingerprint import fingerprint_pdf, align
from .redactions import find_boxes, text_under, Box

OVERLAP_MIN = 0.45


def _iou(a: Box, b: Box) -> float:
    ix0, iy0 = max(a.x0, b.x0), max(a.y0, b.y0)
    ix1, iy1 = min(a.x1, b.x1), min(a.y1, b.y1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    union = a.area + b.area - inter
    return inter / union if union > 0 else 0.0


@dataclass
class DiffFinding:
    kind: str
    page_a: int
    page_b: int
    box: dict
    recovered_text: str = ""
    source_release: str = ""
    note: str = ""
    def as_dict(self): return asdict(self)


def compare(path_a: str, path_b: str, label_a: str = "A", label_b: str = "B") -> dict:
    if fitz is None:
        raise RuntimeError("PyMuPDF required")
    fa, fb = fingerprint_pdf(path_a), fingerprint_pdf(path_b)
    pairs, only_a, only_b = align(fa, fb)

    findings = []
    with fitz.open(path_a) as da, fitz.open(path_b) as db:
        for pa_fp, pb_fp, score in pairs:
            pa, pb = da[pa_fp.index], db[pb_fp.index]
            boxes_a, boxes_b = find_boxes(pa), find_boxes(pb)

            # region redacted in A -> is it readable in B?
            for ba in boxes_a:
                matched = [bb for bb in boxes_b if _iou(ba, bb) >= OVERLAP_MIN]
                if matched:
                    continue
                txt = text_under(pb, ba)
                if txt:
                    findings.append(DiffFinding(
                        "LEAK_DIFFERENTIAL", pa_fp.index, pb_fp.index, ba.as_dict(),
                        txt, label_b,
                        f"Redacted in {label_a}; the same region is readable in {label_b}."))
                else:
                    findings.append(DiffFinding(
                        "ASYMMETRY", pa_fp.index, pb_fp.index, ba.as_dict(), "", label_a,
                        f"Box in {label_a} with no counterpart in {label_b}; "
                        f"nothing recoverable, but the policy differs."))

            # and the mirror direction
            for bb in boxes_b:
                if any(_iou(bb, ba) >= OVERLAP_MIN for ba in boxes_a):
                    continue
                txt = text_under(pa, bb)
                if txt:
                    findings.append(DiffFinding(
                        "LEAK_DIFFERENTIAL", pa_fp.index, pb_fp.index, bb.as_dict(),
                        txt, label_a,
                        f"Redacted in {label_b}; the same region is readable in {label_a}."))
                else:
                    findings.append(DiffFinding(
                        "ASYMMETRY", pa_fp.index, pb_fp.index, bb.as_dict(), "", label_b,
                        f"Box in {label_b} with no counterpart in {label_a}; "
                        f"nothing recoverable, but the policy differs."))

    return {
        "release_a": {"path": path_a, "label": label_a, "pages": len(fa)},
        "release_b": {"path": path_b, "label": label_b, "pages": len(fb)},
        "aligned_pages": [(a.index, b.index, round(s, 3)) for a, b, s in pairs],
        "unmatched_a": [p.index for p in only_a],
        "unmatched_b": [p.index for p in only_b],
        "findings": [f.as_dict() for f in findings],
        "counts": {
            "differential_leaks": sum(1 for f in findings if f.kind == "LEAK_DIFFERENTIAL"),
            "asymmetries": sum(1 for f in findings if f.kind == "ASYMMETRY"),
        },
    }
