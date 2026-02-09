# Document Processing Pipeline

## Overview

Every document ingested into the system passes through a multi-stage pipeline. Each stage updates the document's `processing_status` in the database.

## Pipeline Stages

### Stage 1: Ingest
**Input:** Zip file, Google Drive URL, or individual file upload
**Process:**
- Unpack archive (if zip)
- Create `document` record in database (status: `queued`)
- Upload original file to R2 at `datasets/{dataset_number}/{bates_number}.pdf`
- Generate thumbnail (first page at 150 DPI) → upload to R2 at `thumbnails/{bates_number}_thumb.jpg`
- Extract basic file metadata: size, page count, file type
**Output:** Document record with R2 URL, basic metadata populated

### Stage 2: Forensic Analysis
**Input:** PDF file from R2
**Process (using PyMuPDF/fitz):**
- PDF version detection (1.3, 1.5, etc.)
- Metadata extraction: Creator, Producer, CreationDate, ModDate
- XMP metadata check
- EOF marker count (2 = standard pipeline, 3 = alternate pipeline)
- Permission flags
- Font catalog
- Embedded file/JavaScript/form detection
- Page-by-page structure analysis
**Output:** `forensic_metadata` JSONB field populated:
```json
{
  "pdf_version": "1.5",
  "pipeline": "standard",
  "metadata_status": "stripped",
  "eof_markers": 2,
  "permissions": -4,
  "fonts": ["Helvetica", "Helvetica-Bold", "Times-Roman"],
  "has_xmp": false,
  "has_javascript": false,
  "has_forms": false,
  "has_embedded_files": false,
  "creation_date": null,
  "page_sizes": ["612x792"]
}
```

### Stage 3: Text Extraction
**Input:** PDF file from R2
**Process:**
- PyMuPDF text extraction per page
- If text layer empty/minimal: render page at 200 DPI → OCR (Tesseract)
- Combine all page text into `extracted_text` field
- Detect document date(s) from content
- Detect document type from content patterns:
  - "From:" / "To:" / "Subject:" → email
  - "FEDERAL BUREAU OF INVESTIGATION" → fbi_302
  - Financial table patterns → financial
  - Legal heading patterns → legal_memo
  - Image-only → photo
**Output:** `extracted_text` populated, `document_type` classified, `original_date` detected

### Stage 4: Entity Extraction
**Input:** Extracted text
**Process:**
- Name detection using pattern matching + NLP
- Match detected names against existing `entities` table
- For matches: create `entity_documents` junction record with role and excerpt
- For new names: create entity record with `processing_status = 'needs_review'`, default Tier 4
- Detect case numbers (50D-NY-3027571, etc.) and cross-reference
- Detect locations (addresses, properties)
**Output:** Entity-document links created, new entities flagged

### Stage 5: Redaction Detection
**Input:** PDF file + extracted text
**Process:**
- Detect redacted regions (black rectangles in PDF)
- Calculate redaction coverage per page (percentage)
- Overall redaction level: none / low (<10%) / moderate (10-30%) / heavy (30-60%) / very heavy (>60%)
- Classify detected redactions using A-D framework:
  - Names redacted → check if victim (Cat A) or potential perpetrator (Cat D)
  - Decision text redacted → Category C (institutional)
  - Legal references redacted → Category B
- Cross-reference: is same content redacted differently in other documents?
**Output:** `redactions` table records created, document `flags` updated

### Stage 6: Cross-Reference
**Input:** Document metadata, extracted text, entities
**Process:**
- Match dates against existing events timeline
- Match entities against other documents containing same entities
- Match case numbers against known investigations
- Match location references against known properties
- Detect if this is a variant of an existing document (same email chain, different redactions)
- Calculate similarity scores against existing documents
**Output:** Suggested connections, duplicate/variant flagging

### Stage 7: Classification
**Input:** All extracted data from stages 1-6
**Process:**
- Evidence value scoring (high / medium / low) based on:
  - Entity count and tier levels
  - Document type (FBI 302 and prosecution memos score higher)
  - Redaction patterns (heavy redaction on specific topics = higher value)
  - Date relevance (critical time periods score higher)
  - Cross-reference density
- Severity classification: extreme_critical / critical / high / routine
- Priority scoring for human review queue (1-10, lower = more urgent)
**Output:** `classification`, `severity`, review priority set. Document status → `extracted` (or `needs_review` if priority < 5)

## Processing Status Flow

```
queued → processing → extracted → needs_review → reviewed → published
                  ↘ failed (with error message, retryable)
```

## Tiered Processing Rules

### Tier A: Automatic (ALL documents)
Stages 1-3 always run automatically. Every document gets: file in R2, metadata, text extraction.

### Tier B: AI-Assisted (flagged documents)
Stages 4-7 run on documents that meet ANY of:
- File > 3 pages
- Known entity name detected in text
- Document type = email, memo, or report (not photo/blank)
- Redaction coverage > 10%

### Tier C: Human Review (high-value documents)
Flagged for admin review when ANY of:
- Priority score < 5
- New entity names detected
- Tier 1-2 entity mentioned
- Severity = extreme_critical or critical
- Redaction classified as Category C or D
- Cross-reference with existing investigation found

## Two-Pipeline Baseline (from DS12 forensics)

All DOJ EFTA documents conform to one of two processing pipelines:

| Attribute | Standard | Alternate |
|-----------|----------|-----------|
| PDF Version | 1.5 | 1.3 |
| Metadata | Fully stripped | CreationDate retained |
| EOF Markers | 2 | 3 (occasionally 2 for micro-files) |
| Content | Multi-page emails, memos | Single-page photos, screenshots |
| Fonts | Helvetica + Bold + Times-Roman/Arial/Courier | Helvetica + Bold only |

Deviation from these patterns should be flagged as anomalous.
