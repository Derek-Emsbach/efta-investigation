/**
 * Shared utilities for parsing markdown tables from investigation docs.
 */

/**
 * Parse a markdown table into rows of cell arrays.
 * Skips header row and separator row.
 */
export function parseMarkdownTable(content: string, sectionHeader: string): string[][] {
  const lines = content.split('\n')
  const rows: string[][] = []
  let inSection = false
  let headerSkipped = false

  for (const line of lines) {
    if (line.startsWith('## ' + sectionHeader) || line.startsWith('## ' + sectionHeader.substring(0, 20))) {
      inSection = true
      headerSkipped = false
      continue
    }

    // New section starts — stop
    if (inSection && line.startsWith('## ') && !line.includes(sectionHeader)) {
      break
    }

    if (!inSection) continue

    // Skip non-table lines
    if (!line.startsWith('|')) continue

    // Skip header and separator rows
    if (!headerSkipped) {
      if (line.includes('---')) {
        headerSkipped = true
      }
      continue
    }

    // Parse table row
    const cells = line
      .split('|')
      .slice(1, -1) // Remove first and last empty elements from split
      .map(cell => cell.trim())

    if (cells.length > 0 && cells.some(c => c.length > 0)) {
      rows.push(cells)
    }
  }

  return rows
}

/**
 * Normalize a Bates number to always include the EFTA prefix.
 * Handles: "02731420", "EFTA02731420", "EFTA 02731420"
 */
export function normalizeBatesNumber(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, '')
  if (cleaned.startsWith('EFTA')) {
    return cleaned
  }
  if (/^\d{8}$/.test(cleaned)) {
    return `EFTA${cleaned}`
  }
  return cleaned
}

/**
 * Extract all Bates numbers from a string.
 * Matches both "EFTA02731420" and bare "02731420" formats.
 */
export function extractBatesNumbers(text: string): string[] {
  const matches = text.match(/(?:EFTA)?0\d{7}/g)
  if (!matches) return []
  return [...new Set(matches.map(normalizeBatesNumber))]
}

/**
 * Parse a "Source Docs" cell that may contain comma-separated Bates numbers.
 * Handles: "02731420, 02731465", "EFTA02731684", "Multiple", "—"
 */
export function parseSourceDocs(cell: string): string[] {
  if (!cell || cell === '—' || cell === '-' || cell.toLowerCase() === 'multiple') {
    return []
  }
  return extractBatesNumbers(cell)
}

/**
 * Map raw status strings from the markdown to database-compatible values.
 */
export function normalizeStatus(raw: string): string {
  const statusMap: Record<string, string> = {
    'NO CHARGES': 'not_investigated',
    'NOT INVESTIGATED': 'not_investigated',
    'SETTLED CIVIL': 'settled',
    'DENIED/SETTLED': 'settled',
    'CONVICTED': 'convicted',
    'RESIGNED BARCLAYS': 'identified',
    'DECEASED': 'deceased',
  }
  return statusMap[raw.toUpperCase()] || 'unknown'
}
