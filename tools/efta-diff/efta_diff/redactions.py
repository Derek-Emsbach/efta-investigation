"""Redaction detection, and the failure modes that leak.

Three findings this module produces:

  LEAK_TEXT_LAYER  A redaction box is drawn over text that is STILL PRESENT in
                   the PDF text layer. The page looks redacted; the bytes are
                   not. This is the single most common real-world failure and
                   it is fully recoverable without touching the image.

  LEAK_DIFFERENTIAL  A region redacted in one release is VISIBLE in another
                   release of the same page. Recoverable by comparison alone.
                   (Produced by diff.py, which consumes this module.)

  REDACTION        A box with nothing recoverable behind it. Recorded so the
                   redaction *pattern* can be analysed even when the content
                   cannot be read.

Everything here is read-only analysis of documents the government published.
Nothing removes, defeats or reconstructs a redaction that actually worked.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict

try:
    import fitz
except ImportError:  # pragma: no cover
    fitz = None

MIN_AREA = 200.0        # pt^2; ignore specks
MAX_PAGE_FRAC = 0.92    # a "box" covering the whole page is a scan artefact
NEAR_BLACK = 0.28       # mean channel value below this counts as a black fill
NEAR_WHITE = 0.93


@dataclass
class Box:
    x0: float; y0: float; x1: float; y1: float
    kind: str = "black"          # black | white | annot
    @property
    def area(self) -> float: return max(0.0, self.x1-self.x0) * max(0.0, self.y1-self.y0)
    def rect(self): return fitz.Rect(self.x0, self.y0, self.x1, self.y1)
    def as_dict(self): return asdict(self)


@dataclass
class Finding:
    page: int
    kind: str                    # LEAK_TEXT_LAYER | REDACTION
    box: dict
    recovered_text: str = ""
    note: str = ""
    def as_dict(self): return asdict(self)


def _fill_kind(fill) -> str | None:
    if fill is None:
        return None
    vals = fill if isinstance(fill, (tuple, list)) else (fill,)
    try:
        m = sum(float(v) for v in vals) / len(vals)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if m <= NEAR_BLACK:
        return "black"
    if m >= NEAR_WHITE:
        return "white"
    return None


def find_boxes(page) -> list:
    """Filled rectangles that plausibly serve as redactions."""
    page_area = page.rect.width * page.rect.height
    out = []
    for d in page.get_drawings():
        kind = _fill_kind(d.get("fill"))
        if kind is None:
            continue
        r = d["rect"]
        b = Box(r.x0, r.y0, r.x1, r.y1, kind)
        if b.area < MIN_AREA or (page_area and b.area / page_area > MAX_PAGE_FRAC):
            continue
        # a rectangle must actually be rectangular
        if not any(it[0] == "re" for it in d.get("items", [])):
            continue
        out.append(b)
    for a in page.annots() or []:
        if a.type[0] == 12:  # Redact annotation left in place
            r = a.rect
            out.append(Box(r.x0, r.y0, r.x1, r.y1, "annot"))
    return out


def text_under(page, box: Box, shrink: float = 1.0) -> str:
    r = box.rect()
    r = fitz.Rect(r.x0 + shrink, r.y0 + shrink, r.x1 - shrink, r.y1 - shrink)
    if r.is_empty or r.width <= 0 or r.height <= 0:
        return ""
    return page.get_text("text", clip=r).strip()


def scan_page(page, page_no: int) -> list:
    findings = []
    for b in find_boxes(page):
        leaked = text_under(page, b)
        if leaked:
            findings.append(Finding(page_no, "LEAK_TEXT_LAYER", b.as_dict(), leaked,
                "Text is present in the PDF text layer beneath a redaction box. "
                "The visual redaction does not remove the underlying characters."))
        else:
            findings.append(Finding(page_no, "REDACTION", b.as_dict(), "",
                "Box with no recoverable text layer behind it."))
    return findings


def scan_pdf(path: str) -> list:
    if fitz is None:
        raise RuntimeError("PyMuPDF required")
    out = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc):
            out.extend(scan_page(page, i))
    return out
