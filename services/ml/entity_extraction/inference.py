"""Run trained NER model on new documents for entity extraction.

Can be used as a standalone batch processor or integrated as Stage 4b
in the worker pipeline.
"""

import sys
from pathlib import Path

from rich.console import Console

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import ML_MODELS_DIR

console = Console()


def load_model(model_dir: str | None = None):
    """Load the latest trained NER model."""
    import spacy

    if model_dir:
        return spacy.load(model_dir)

    ner_dir = ML_MODELS_DIR / "entity_ner"
    versions = sorted(ner_dir.glob("v*/model-best"))
    if not versions:
        raise FileNotFoundError("No trained NER model found")

    return spacy.load(versions[-1])


def extract_entities(text: str, nlp) -> list[dict]:
    """Extract entities from text using the trained NER model.

    Returns list of {name, start, end, label} dicts.
    """
    doc = nlp(text)
    return [
        {
            "name": ent.text,
            "start": ent.start_char,
            "end": ent.end_char,
            "label": ent.label_,
            "source": "ml_ner",
        }
        for ent in doc.ents
    ]


def run_batch(
    document_ids: list[str],
    model_dir: str | None = None,
) -> dict[str, list[dict]]:
    """Run NER extraction on a batch of documents.

    Returns {document_id: [entities]} mapping.
    """
    import db
    import storage

    nlp = load_model(model_dir)
    results: dict[str, list[dict]] = {}

    for doc_id in document_ids:
        doc = db.get_document(doc_id)
        if not doc or not doc.get("bates_number"):
            continue

        text = storage.download_text(doc["bates_number"])
        if not text:
            continue

        entities = extract_entities(text, nlp)
        results[doc_id] = entities

    return results
