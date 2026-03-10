#!/usr/bin/env bash
# Download EFTA corpus databases from rhowardstone/Epstein-research-data GitHub releases.
# Usage: cd services/efta-mcp-server/data && ./download.sh
#
# Downloads:
#   v5.0 — full_text_corpus.db (~6.3 GB, split into 2 parts)
#   v5.1 — concordance_complete.db, alteration_results.db, image_analysis.db, handwriting_transcriptions.db
#
# Requires: curl, gzip, cat

set -euo pipefail

REPO="rhowardstone/Epstein-research-data"
BASE_URL="https://github.com/${REPO}/releases/download"

# ── Helpers ──────────────────────────────────────────────────────────────────

download() {
  local url="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    echo "  ✓ Already exists: $dest"
    return 0
  fi
  echo "  ↓ Downloading: $dest"
  curl -fSL --retry 4 --retry-delay 2 -o "$dest" "$url"
}

decompress() {
  local gz="$1" db="$2"
  if [[ -f "$db" ]]; then
    echo "  ✓ Already decompressed: $db"
    return 0
  fi
  echo "  ⚙ Decompressing: $gz → $db"
  gzip -dk "$gz"
}

# ── v5.0: Full-text corpus (split archive) ──────────────────────────────────

echo "═══ v5.0: Full-text corpus ═══"
download "${BASE_URL}/v5.0/full_text_corpus.db.gz.part_aa" "full_text_corpus.db.gz.part_aa"
download "${BASE_URL}/v5.0/full_text_corpus.db.gz.part_ab" "full_text_corpus.db.gz.part_ab"

if [[ -f "full_text_corpus.db" ]]; then
  echo "  ✓ Already assembled: full_text_corpus.db"
else
  echo "  ⚙ Reassembling split archive…"
  cat full_text_corpus.db.gz.part_aa full_text_corpus.db.gz.part_ab > full_text_corpus.db.gz
  echo "  ⚙ Decompressing full_text_corpus.db.gz…"
  gzip -d full_text_corpus.db.gz
  echo "  ✓ full_text_corpus.db ready"
fi

# ── v5.1: Research databases ─────────────────────────────────────────────────

echo ""
echo "═══ v5.1: Research databases ═══"

download "${BASE_URL}/v5.1/concordance_complete.db.gz" "concordance_complete.db.gz"
decompress "concordance_complete.db.gz" "concordance_complete.db"

download "${BASE_URL}/v5.1/alteration_results.db.gz" "alteration_results.db.gz"
decompress "alteration_results.db.gz" "alteration_results.db"

download "${BASE_URL}/v5.1/image_analysis.db.gz" "image_analysis.db.gz"
decompress "image_analysis.db.gz" "image_analysis.db"

download "${BASE_URL}/v5.1/handwriting_transcriptions.db.gz" "handwriting_transcriptions.db.gz"
decompress "handwriting_transcriptions.db.gz" "handwriting_transcriptions.db"

# ── Verification ─────────────────────────────────────────────────────────────

echo ""
echo "═══ Verification ═══"
for db in full_text_corpus.db concordance_complete.db alteration_results.db image_analysis.db handwriting_transcriptions.db; do
  if [[ -f "$db" ]]; then
    size=$(du -h "$db" | cut -f1)
    echo "  ✓ $db ($size)"
  else
    echo "  ✗ MISSING: $db"
  fi
done

echo ""
echo "Done. All databases ready for MCP server."
