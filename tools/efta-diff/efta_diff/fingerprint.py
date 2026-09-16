"""Structural fingerprinting: match the same underlying page across releases.

Metadata cannot identify re-releases (the DOJ strips it). Content can.
Two fingerprints per page:
  - `ink`   : a coarse 16x16 occupancy grid of rendered dark pixels. Survives
              re-scanning, requantisation and mild skew. Redaction boxes ADD
              ink, so `ink` alone is not sufficient for matching.
  - `layout`: quantised geometry of text spans, ignoring the glyphs. Survives
              redaction of the *content* (a redacted span still occupies space)
              but changes when a page is genuinely different.
Matching uses layout first, ink as a tiebreak — so a page redacted in one
release still matches its unredacted twin in another.
"""
from __future__ import annotations
import hashlib
from dataclasses import dataclass, field

try:
    import fitz
except ImportError:  # pragma: no cover
    fitz = None

GRID = 16
DARK = 160          # 0-255; below this counts as ink
RENDER_DPI = 100


@dataclass(frozen=True)
class PageFingerprint:
    index: int
    ink: tuple            # GRID*GRID occupancy ratios, quantised 0-15
    layout: tuple         # quantised (x0,y0,x1,y1) span boxes
    width: float
    height: float
    text_len: int

    @property
    def ink_hash(self) -> str:
        return hashlib.sha1(bytes(self.ink)).hexdigest()[:16]

    @property
    def layout_hash(self) -> str:
        return hashlib.sha1(repr(self.layout).encode()).hexdigest()[:16]

    def ink_distance(self, other: "PageFingerprint") -> float:
        """Mean absolute occupancy difference, 0.0 (identical) .. 1.0."""
        if not self.ink or not other.ink:
            return 1.0
        n = min(len(self.ink), len(other.ink))
        return sum(abs(a - b) for a, b in zip(self.ink[:n], other.ink[:n])) / (15.0 * n)

    def layout_similarity(self, other: "PageFingerprint") -> float:
        """Jaccard overlap of quantised span boxes, 1.0 == same skeleton."""
        a, b = set(self.layout), set(other.layout)
        if not a and not b:
            return 1.0
        if not a or not b:
            return 0.0
        return len(a & b) / len(a | b)


def _ink_grid(page) -> tuple:
    pm = page.get_pixmap(dpi=RENDER_DPI, colorspace=fitz.csGRAY, alpha=False)
    w, h, samples = pm.width, pm.height, pm.samples
    if w == 0 or h == 0:
        return tuple([0] * (GRID * GRID))
    counts = [0] * (GRID * GRID)
    totals = [0] * (GRID * GRID)
    for y in range(h):
        gy = min(GRID - 1, y * GRID // h)
        row = y * pm.stride
        for x in range(w):
            gi = gy * GRID + min(GRID - 1, x * GRID // w)
            totals[gi] += 1
            if samples[row + x] < DARK:
                counts[gi] += 1
    return tuple(
        int(round(15.0 * counts[i] / totals[i])) if totals[i] else 0
        for i in range(GRID * GRID)
    )


def _layout(page, q: int = 8) -> tuple:
    boxes = []
    for blk in page.get_text("dict")["blocks"]:
        for line in blk.get("lines", []):
            for span in line.get("spans", []):
                x0, y0, x1, y1 = span["bbox"]
                boxes.append((int(x0 // q), int(y0 // q), int(x1 // q), int(y1 // q)))
    return tuple(sorted(boxes))


def fingerprint_pdf(path: str) -> list:
    if fitz is None:
        raise RuntimeError("PyMuPDF required")
    out = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc):
            out.append(PageFingerprint(
                index=i, ink=_ink_grid(page), layout=_layout(page),
                width=page.rect.width, height=page.rect.height,
                text_len=len(page.get_text().strip()),
            ))
    return out


def align(a: list, b: list, layout_floor: float = 0.35, ink_ceiling: float = 0.30):
    """Greedy best-match alignment. Returns (pairs, only_a, only_b)."""
    pairs, used = [], set()
    for pa in a:
        best, best_score = None, -1.0
        for pb in b:
            if pb.index in used:
                continue
            lay = pa.layout_similarity(pb)
            ink = 1.0 - pa.ink_distance(pb)
            score = lay * 0.75 + ink * 0.25 if lay > 0 else ink * 0.5
            if score > best_score:
                best, best_score = pb, score
        if best is not None and (
            pa.layout_similarity(best) >= layout_floor
            or pa.ink_distance(best) <= ink_ceiling
        ):
            used.add(best.index)
            pairs.append((pa, best, best_score))
    only_a = [p for p in a if p.index not in {x[0].index for x in pairs}]
    only_b = [p for p in b if p.index not in used]
    return pairs, only_a, only_b
