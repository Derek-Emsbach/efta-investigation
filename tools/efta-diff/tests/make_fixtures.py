"""Synthetic fixtures with known-planted redaction failures.

Content is deliberately meaningless ("TOKEN-ALPHA-001") so the fixtures carry
no resemblance to real case material. The point is only that the detector
finds what we planted and does not find what we did not plant.
"""
import os

import fitz

OUT = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(OUT, exist_ok=True)

TOKEN_A = "TOKEN-ALPHA-001"
TOKEN_B = "TOKEN-BRAVO-002"
BODY = (
    "SAMPLE DOCUMENT FOR AUTOMATED TESTING\n\n"
    "This page exists only to exercise the page-alignment and box-detection\n"
    "code paths. It contains no real content of any kind.\n"
)


def _page(doc, tokens=(), cover=(), remove=()):
    """cover -> box drawn, text LEFT in the text layer (a leak)
    remove -> apply_redactions(), text genuinely destroyed (a real redaction)
    """
    p = doc.new_page(width=612, height=792)
    p.insert_text((72, 90), BODY, fontsize=11)
    spots = []
    for i, t in enumerate(tokens):
        y = 200 + i * 40
        p.insert_text((72, y), t, fontsize=11)
        spots.append(fitz.Rect(68, y - 13, 68 + 6.2 * len(t), y + 5))
    for i in cover:
        p.draw_rect(spots[i], color=(0, 0, 0), fill=(0, 0, 0))
    for i in remove:
        p.add_redact_annot(spots[i], fill=(0, 0, 0))
    if remove:
        p.apply_redactions()
    return p


def build():
    # 1. leaky — boxes drawn over text that remains in the text layer
    d = fitz.open()
    _page(d, [TOKEN_A, TOKEN_B], cover=[0, 1])
    d.save(f"{OUT}/leaky.pdf")
    d.close()

    # 2. clean — redactions properly applied, text actually destroyed
    d = fitz.open()
    _page(d, [TOKEN_A, TOKEN_B], remove=[0, 1])
    d.save(f"{OUT}/clean.pdf")
    d.close()

    # 3. differential pair — same page, inconsistent policy between releases.
    #    release_1 removes both tokens; release_2 removes only the first.
    #    Comparing the two recovers TOKEN_B.
    d = fitz.open()
    _page(d, [TOKEN_A, TOKEN_B], remove=[0, 1])
    d.save(f"{OUT}/release_1.pdf")
    d.close()

    d = fitz.open()
    _page(d, [TOKEN_A, TOKEN_B], remove=[0])
    d.save(f"{OUT}/release_2.pdf")
    d.close()

    # 4. reordered multi-page, to prove alignment ignores page order
    for name, order in (("multi_ab.pdf", ("ALPHA", "BETA")),
                        ("multi_ba.pdf", ("BETA", "ALPHA"))):
        d = fitz.open()
        for tag in order:
            p = d.new_page(width=612, height=792)
            p.insert_text((72, 100), f"PAGE {tag}\n{BODY}", fontsize=11)
        d.save(f"{OUT}/{name}")
        d.close()

    print("fixtures written to", OUT)


if __name__ == "__main__":
    build()
