"""Verification suite. Every assertion checks a planted ground truth."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from efta_diff import compare, fingerprint_pdf, scan_pdf  # noqa: E402
from efta_diff.fingerprint import align  # noqa: E402
from tests.make_fixtures import build, TOKEN_A, TOKEN_B  # noqa: E402

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


@pytest.fixture(scope="session", autouse=True)
def _fixtures():
    build()


def _f(name):
    return os.path.join(FX, name)


# ---------------------------------------------------------------- text-layer

def test_detects_text_layer_leak():
    """A box drawn over live text must be reported, with the text recovered."""
    findings = scan_pdf(_f("leaky.pdf"))
    leaks = [f for f in findings if f.kind == "LEAK_TEXT_LAYER"]
    assert len(leaks) == 2, f"expected 2 leaks, got {len(leaks)}"
    recovered = " ".join(f.recovered_text for f in leaks)
    assert TOKEN_A in recovered
    assert TOKEN_B in recovered


def test_no_false_leak_on_proper_redaction():
    """A properly applied redaction must NOT be reported as a leak.

    This is the assertion that keeps the tool honest — a detector that flags
    everything is worse than none, because it manufactures findings.
    """
    findings = scan_pdf(_f("clean.pdf"))
    leaks = [f for f in findings if f.kind == "LEAK_TEXT_LAYER"]
    assert leaks == [], f"false positive: {[l.recovered_text for l in leaks]}"
    assert any(f.kind == "REDACTION" for f in findings), "boxes should still be recorded"


# -------------------------------------------------------------- differential

def test_differential_leak_recovers_inconsistently_redacted_text():
    """Release 1 hides both tokens; release 2 hides only one.

    Neither release alone exposes TOKEN_B in a readable region that release 1
    covered — the comparison is what recovers it.
    """
    res = compare(_f("release_1.pdf"), _f("release_2.pdf"), "DS-A", "DS-B")
    leaks = [f for f in res["findings"] if f["kind"] == "LEAK_DIFFERENTIAL"]
    assert leaks, "differential leak not detected"
    recovered = " ".join(f["recovered_text"] for f in leaks)
    assert TOKEN_B in recovered, f"TOKEN_B not recovered; got {recovered!r}"
    assert TOKEN_A not in recovered, "TOKEN_A was redacted in BOTH releases and must stay hidden"


def test_identical_releases_produce_no_findings():
    res = compare(_f("release_1.pdf"), _f("release_1.pdf"), "X", "X")
    assert res["counts"]["differential_leaks"] == 0
    assert res["counts"]["asymmetries"] == 0


# ----------------------------------------------------------------- alignment

def test_alignment_survives_page_reordering():
    """Pages must match on content, not on position."""
    a = fingerprint_pdf(_f("multi_ab.pdf"))
    b = fingerprint_pdf(_f("multi_ba.pdf"))
    pairs, only_a, only_b = align(a, b)
    assert len(pairs) == 2, f"expected 2 aligned pages, got {len(pairs)}"
    mapping = {pa.index: pb.index for pa, pb, _ in pairs}
    assert mapping == {0: 1, 1: 0}, f"reordering not detected: {mapping}"
    assert not only_a and not only_b


def test_fingerprint_is_stable():
    a = fingerprint_pdf(_f("clean.pdf"))
    b = fingerprint_pdf(_f("clean.pdf"))
    assert a[0].ink_hash == b[0].ink_hash
    assert a[0].layout_hash == b[0].layout_hash
    assert a[0].ink_distance(b[0]) == 0.0


def test_redaction_changes_ink_but_not_alignment():
    """A redacted page still aligns to its unredacted twin.

    Redaction adds ink, so ink distance alone would separate them; layout is
    what holds the match together.
    """
    a = fingerprint_pdf(_f("release_1.pdf"))
    b = fingerprint_pdf(_f("release_2.pdf"))
    pairs, _, _ = align(a, b)
    assert len(pairs) == 1, "a redacted page must still match its twin"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
