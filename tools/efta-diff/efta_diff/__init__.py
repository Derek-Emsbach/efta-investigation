"""efta-diff — differential disclosure analysis for released document sets."""
from .fingerprint import fingerprint_pdf, align, PageFingerprint
from .redactions import scan_pdf, scan_page, find_boxes, text_under
from .diff import compare
__all__ = ["fingerprint_pdf","align","PageFingerprint","scan_pdf","scan_page",
           "find_boxes","text_under","compare"]
__version__ = "1.0.0"
