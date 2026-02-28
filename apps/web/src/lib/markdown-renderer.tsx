import type { ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Citation {
  citation_number: number
  description: string | null
  bates_number: string | null
  document: { bates_number: string | null; title: string | null } | null
}

export interface EntityRef {
  slug: string
  name: string
  tier: number | null
}

export interface RenderContext {
  citations: Citation[]
  entities: EntityRef[]
  autoLink?: boolean // When true, auto-detect entity names + EFTA numbers in prose
}

// Internal context with computed auto-link fields
interface InternalContext extends RenderContext {
  _entityRegex?: RegExp
  _entityMap?: Map<string, EntityRef>
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * Custom Markdown → React renderer.
 *
 * Supported patterns:
 * - [CITE:N]           → inline citation badge
 * - {{entity:slug}}    → entity mention with link
 * - {{doc:EFTA...}}    → document card embed
 * - {{redacted:D}}...  → redaction marker
 * - > [!finding]       → key finding box
 * - > [!data:$158M]    → data callout
 * - > [!quote]         → pull quote
 * - Standard markdown: headings (h2-h4), paragraphs, lists, bold, italic, code
 * - Tables, horizontal rules, multi-paragraph blockquotes
 *
 * When autoLink is true:
 * - Entity names from context are auto-detected and linked to /entities/{slug}
 * - EFTA Bates numbers (EFTA\d{8,11}) are auto-detected and linked to evidence room
 */
export function renderMarkdown(
  markdown: string,
  context: RenderContext
): ReactNode[] {
  // Strip HTML comments
  const processed = markdown.replace(/<!--[\s\S]*?-->/g, '')

  // Build internal context with computed auto-link regex (built once, used for all blocks)
  const ctx: InternalContext = { ...context }
  if (ctx.autoLink && ctx.entities.length > 0) {
    // Sort longest first — critical to prevent partial matches on shared substrings
    const sorted = [...ctx.entities].sort(
      (a, b) => b.name.length - a.name.length
    )
    const patterns = sorted.map((e) =>
      e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    ctx._entityRegex = new RegExp(`\\b(${patterns.join('|')})\\b`)
    ctx._entityMap = new Map(sorted.map((e) => [e.name, e]))
  }

  const blocks = processed.split(/\n\n+/)
  const nodes: ReactNode[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim()
    if (!block) continue

    const node = renderBlock(block, i, ctx)
    if (node) nodes.push(node)
  }

  return nodes
}

// ─── Block Rendering ──────────────────────────────────────────────────────────

function renderBlock(
  block: string,
  key: number,
  ctx: InternalContext
): ReactNode | null {
  // Key Finding box
  if (block.startsWith('> [!finding]')) {
    const content = block
      .replace(/^>\s*\[!finding\]\s*/m, '')
      .replace(/^>\s?/gm, '')
    return (
      <div
        key={key}
        className="border-l-[3px] border-accent-red bg-[#c41e3a08] px-5 py-4 my-6"
      >
        <div className="font-mono text-[10px] font-bold text-accent-red uppercase tracking-wider mb-2">
          Key Finding
        </div>
        <div className="font-body text-sm text-text-primary leading-relaxed">
          {renderInline(content, ctx)}
        </div>
      </div>
    )
  }

  // Data callout
  const dataMatch = block.match(/^>\s*\[!data:(.*?)\]\s*\n?>\s?(.*)/)
  if (dataMatch) {
    return (
      <div key={key} className="text-center my-8 py-6">
        <div className="font-display text-5xl sm:text-6xl font-bold text-accent-red">
          {dataMatch[1]}
        </div>
        <div className="mt-2 font-body text-sm text-text-secondary">
          {renderInline(dataMatch[2], ctx)}
        </div>
      </div>
    )
  }

  // Pull quote
  if (block.startsWith('> [!quote]')) {
    const lines = block
      .replace(/^>\s*\[!quote\]\s*/m, '')
      .replace(/^>\s?/gm, '')
      .split('\n')
    const text = lines[0] ?? ''
    const attribution = lines[1]?.replace(/^—\s*/, '') ?? ''
    return (
      <blockquote
        key={key}
        className="my-8 border-l-[3px] border-accent-gold pl-6"
      >
        <p className="font-display text-2xl italic text-text-primary leading-relaxed">
          {renderInline(text, ctx)}
        </p>
        {attribution && (
          <footer className="mt-2 font-body text-sm text-text-muted">
            — {attribution}
          </footer>
        )}
      </blockquote>
    )
  }

  // Standard blockquote (with multi-paragraph support)
  if (block.startsWith('> ')) {
    const lines = block.split('\n').map((l) => l.replace(/^>\s?/, ''))
    // Group into sub-paragraphs by empty lines within the blockquote
    const paragraphs: string[][] = [[]]
    for (const line of lines) {
      if (line.trim() === '') {
        paragraphs.push([])
      } else {
        paragraphs[paragraphs.length - 1].push(line)
      }
    }
    const filled = paragraphs.filter((p) => p.length > 0)
    return (
      <blockquote
        key={key}
        className="border-l-[3px] border-border-default pl-4 italic text-text-secondary my-4"
      >
        {filled.map((p, j) => (
          <p
            key={j}
            className="font-body text-sm leading-relaxed mb-2 last:mb-0"
          >
            {renderInline(p.join(' '), ctx)}
          </p>
        ))}
      </blockquote>
    )
  }

  // Horizontal rule
  if (/^-{3,}$/.test(block)) {
    return <hr key={key} className="border-t border-border-default my-8" />
  }

  // Table (pipe-delimited with separator)
  if (/^\|/m.test(block) && /\|[\s-:|]+\|/.test(block)) {
    return renderTable(block, key, ctx)
  }

  // Headings (h4 first, then h3, h2, h1→h2)
  if (block.startsWith('#### '))
    return (
      <h4
        key={key}
        className="font-display text-base font-semibold text-text-primary mt-5 mb-2"
      >
        {renderInline(block.slice(5), ctx)}
      </h4>
    )
  if (block.startsWith('### '))
    return (
      <h3
        key={key}
        className="font-display text-lg font-semibold text-text-primary mt-8 mb-3"
      >
        {renderInline(block.slice(4), ctx)}
      </h3>
    )
  if (block.startsWith('## '))
    return (
      <h2
        key={key}
        className="font-display text-xl font-bold text-text-primary mt-10 mb-4"
      >
        {renderInline(block.slice(3), ctx)}
      </h2>
    )
  if (block.startsWith('# '))
    return (
      <h2
        key={key}
        className="font-display text-2xl font-bold text-text-primary mt-10 mb-4"
      >
        {renderInline(block.slice(2), ctx)}
      </h2>
    )

  // Unordered list
  if (block.match(/^[-*] /m)) {
    const items = block
      .split('\n')
      .filter((l) => l.match(/^\s*[-*] /))
      .map((l) => l.replace(/^\s*[-*] /, ''))
    return (
      <ul key={key} className="list-disc pl-6 my-4 space-y-1.5">
        {items.map((item, j) => (
          <li
            key={j}
            className="font-body text-base text-text-primary leading-relaxed"
          >
            {renderInline(item, ctx)}
          </li>
        ))}
      </ul>
    )
  }

  // Ordered list
  if (block.match(/^\d+\. /m)) {
    const items = block
      .split('\n')
      .filter((l) => l.match(/^\s*\d+\. /))
      .map((l) => l.replace(/^\s*\d+\.\s/, ''))
    return (
      <ol key={key} className="list-decimal pl-6 my-4 space-y-1.5">
        {items.map((item, j) => (
          <li
            key={j}
            className="font-body text-base text-text-primary leading-relaxed"
          >
            {renderInline(item, ctx)}
          </li>
        ))}
      </ol>
    )
  }

  // Document embed: {{doc:EFTA...}}
  const docMatch = block.match(/^\{\{doc:(EFTA\d+)\}\}$/)
  if (docMatch) {
    const bates = docMatch[1]
    return (
      <div
        key={key}
        className="border border-border-default bg-elevated my-6 overflow-hidden"
      >
        <div className="bg-ink px-4 py-2 flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-accent-red">
            {bates}
          </span>
          <span className="font-mono text-[10px] text-text-muted uppercase">
            Document
          </span>
        </div>
        <div className="px-4 py-3">
          <a
            href={`/evidence?q=${bates}`}
            className="font-mono text-xs text-neon-blue hover:underline"
          >
            View in Evidence Room →
          </a>
        </div>
      </div>
    )
  }

  // Paragraph
  return (
    <p
      key={key}
      className="font-body text-[17px] leading-[1.75] text-text-primary my-4"
    >
      {renderInline(block.replace(/\n/g, ' '), ctx)}
    </p>
  )
}

// ─── Table Rendering ──────────────────────────────────────────────────────────

function renderTable(
  block: string,
  key: number,
  ctx: InternalContext
): ReactNode {
  const lines = block
    .trim()
    .split('\n')
    .filter((l) => l.trim())
  if (lines.length < 3) {
    return (
      <p
        key={key}
        className="font-body text-[17px] leading-[1.75] text-text-primary my-4"
      >
        {renderInline(block, ctx)}
      </p>
    )
  }

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

  const headers = parseRow(lines[0])
  const sepIndex = lines.findIndex((l) => /^\|[\s-:|]+\|$/.test(l))
  if (sepIndex === -1) {
    return (
      <p
        key={key}
        className="font-body text-[17px] leading-[1.75] text-text-primary my-4"
      >
        {renderInline(block, ctx)}
      </p>
    )
  }

  const dataRows = lines.slice(sepIndex + 1)

  return (
    <div key={key} className="overflow-x-auto my-6 rounded">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="bg-[#e8dcc7] border border-[#d4c5a9] px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-wide"
              >
                {renderInline(h, ctx)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, i) => {
            const cells = parseRow(row)
            return (
              <tr key={i} className="hover:bg-[#ebe0ca]/50">
                {cells.map((c, j) => (
                  <td
                    key={j}
                    className="border border-[#d4c5a9] px-3 py-2 align-top"
                  >
                    {renderInline(c, ctx)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Inline Rendering ─────────────────────────────────────────────────────────

function renderInline(text: string, ctx: InternalContext): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    // Find the earliest custom pattern match
    const citeMatch = remaining.match(/\[CITE:(\d+)\]/)
    const entityMatch = remaining.match(/\{\{entity:([a-z0-9-]+)\}\}/)
    const redactMatch = remaining.match(
      /\{\{redacted:([A-D])\}\}(.*?)\{\{\/redacted\}\}/
    )

    const matches: {
      index: number
      length: number
      type: string
      match: RegExpMatchArray
    }[] = []
    if (citeMatch?.index != null)
      matches.push({
        index: citeMatch.index,
        length: citeMatch[0].length,
        type: 'cite',
        match: citeMatch,
      })
    if (entityMatch?.index != null)
      matches.push({
        index: entityMatch.index,
        length: entityMatch[0].length,
        type: 'entity',
        match: entityMatch,
      })
    if (redactMatch?.index != null)
      matches.push({
        index: redactMatch.index,
        length: redactMatch[0].length,
        type: 'redact',
        match: redactMatch,
      })

    // Auto-link: entity names (only when autoLink enabled)
    if (ctx.autoLink && ctx._entityRegex && ctx._entityMap) {
      const autoEntityMatch = remaining.match(ctx._entityRegex)
      if (autoEntityMatch?.index != null) {
        matches.push({
          index: autoEntityMatch.index,
          length: autoEntityMatch[0].length,
          type: 'autoEntity',
          match: autoEntityMatch,
        })
      }
    }

    // Auto-link: EFTA Bates numbers (only when autoLink enabled)
    if (ctx.autoLink) {
      const eftaMatch = remaining.match(/EFTA(\d{8,11})/)
      if (eftaMatch?.index != null) {
        matches.push({
          index: eftaMatch.index,
          length: eftaMatch[0].length,
          type: 'efta',
          match: eftaMatch,
        })
      }
    }

    if (matches.length === 0) {
      // No more custom patterns — render remaining as formatted text
      parts.push(...renderFormattedText(remaining, keyIdx))
      break
    }

    // Pick the earliest match
    matches.sort((a, b) => a.index - b.index)
    const earliest = matches[0]

    // Add text before the match
    if (earliest.index > 0) {
      parts.push(
        ...renderFormattedText(remaining.slice(0, earliest.index), keyIdx)
      )
      keyIdx++
    }

    // Render the match
    if (earliest.type === 'cite') {
      const num = parseInt(earliest.match[1], 10)
      const citation = ctx.citations.find((c) => c.citation_number === num)
      parts.push(
        <span
          key={`cite-${keyIdx++}`}
          className="inline-flex items-center justify-center w-[18px] h-[18px] bg-accent-red text-white text-[10px] font-mono font-bold cursor-help align-super -mt-1 mx-0.5"
          title={
            citation
              ? `${citation.bates_number ?? ''}: ${citation.description ?? ''}`
              : `Citation ${num}`
          }
        >
          {num}
        </span>
      )
    } else if (earliest.type === 'entity') {
      const slug = earliest.match[1]
      const entity = ctx.entities.find((e) => e.slug === slug)
      if (entity) {
        parts.push(
          <a
            key={`ent-${keyIdx++}`}
            href={`/entities/${slug}`}
            className="border-b-2 border-accent-gold text-text-primary hover:text-accent-gold transition-colors"
          >
            {entity.name}
          </a>
        )
      } else {
        parts.push(
          <span
            key={`ent-${keyIdx++}`}
            className="border-b border-dashed border-text-muted"
          >
            {slug.replace(/-/g, ' ')}
          </span>
        )
      }
    } else if (earliest.type === 'redact') {
      const category = earliest.match[1]
      parts.push(
        <span
          key={`redact-${keyIdx++}`}
          className="inline-flex items-center gap-1 bg-ink text-text-muted px-1.5 py-0.5 font-mono text-xs"
          title={`Redacted — Category ${category}`}
        >
          <span className="text-[9px] font-bold text-accent-red">
            [{category}]
          </span>
          <span className="line-through opacity-50">{earliest.match[2]}</span>
        </span>
      )
    } else if (earliest.type === 'autoEntity') {
      const name = earliest.match[0]
      const entity = ctx._entityMap?.get(name)
      if (entity) {
        parts.push(
          <a
            key={`auto-ent-${keyIdx++}`}
            href={`/entities/${entity.slug}`}
            className="border-b border-accent-gold/60 text-text-primary hover:text-accent-gold transition-colors"
          >
            {name}
          </a>
        )
      } else {
        parts.push(name)
      }
    } else if (earliest.type === 'efta') {
      const bates = earliest.match[0]
      parts.push(
        <a
          key={`efta-${keyIdx++}`}
          href={`/evidence?q=${bates}`}
          className="font-mono text-sm text-accent-red hover:underline"
        >
          {bates}
        </a>
      )
    }

    remaining = remaining.slice(earliest.index + earliest.length)
  }

  return parts
}

// ─── Text Formatting ──────────────────────────────────────────────────────────

function renderFormattedText(text: string, key: number): ReactNode[] {
  // Apply bold, italic, code formatting
  const parts: ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }

    if (match[2]) {
      parts.push(
        <strong key={`b-${key}-${match.index}`} className="font-semibold">
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <em key={`i-${key}-${match.index}`}>{match[3]}</em>
      )
    } else if (match[4]) {
      parts.push(
        <code
          key={`c-${key}-${match.index}`}
          className="font-mono text-sm bg-elevated px-1 py-0.5"
        >
          {match[4]}
        </code>
      )
    }

    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return parts
}
