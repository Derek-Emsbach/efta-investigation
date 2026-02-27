import type { ReactNode } from 'react'

interface Citation {
  citation_number: number
  description: string | null
  bates_number: string | null
  document: { bates_number: string | null; title: string | null } | null
}

interface EntityRef {
  slug: string
  name: string
  tier: number | null
}

interface RenderContext {
  citations: Citation[]
  entities: EntityRef[]
}

/**
 * Custom Markdown → React renderer.
 *
 * Supported patterns:
 * - [CITE:N]           → inline citation badge
 * - {{entity:slug}}    → entity mention with link
 * - {{doc:EFTA...}}    → document card embed
 * - > [!finding]       → key finding box
 * - > [!data:$158M]    → data callout
 * - > [!quote]         → pull quote
 * - Standard markdown: headings, paragraphs, lists, bold, italic, code
 */
export function renderMarkdown(
  markdown: string,
  context: RenderContext
): ReactNode[] {
  const blocks = markdown.split(/\n\n+/)
  const nodes: ReactNode[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim()
    if (!block) continue

    const node = renderBlock(block, i, context)
    if (node) nodes.push(node)
  }

  return nodes
}

function renderBlock(
  block: string,
  key: number,
  ctx: RenderContext
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

  // Standard blockquote
  if (block.startsWith('> ')) {
    const content = block.replace(/^>\s?/gm, '')
    return (
      <blockquote
        key={key}
        className="border-l-[3px] border-border-default pl-4 italic text-text-secondary my-4"
      >
        <p className="font-body text-sm leading-relaxed">
          {renderInline(content, ctx)}
        </p>
      </blockquote>
    )
  }

  // Headings
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
      .filter((l) => l.match(/^[-*] /))
      .map((l) => l.replace(/^[-*] /, ''))
    return (
      <ul key={key} className="list-disc pl-6 my-4 space-y-1.5">
        {items.map((item, j) => (
          <li key={j} className="font-body text-base text-text-primary leading-relaxed">
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
      .filter((l) => l.match(/^\d+\. /))
      .map((l) => l.replace(/^\d+\.\s/, ''))
    return (
      <ol key={key} className="list-decimal pl-6 my-4 space-y-1.5">
        {items.map((item, j) => (
          <li key={j} className="font-body text-base text-text-primary leading-relaxed">
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
        <div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2">
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

function renderInline(text: string, ctx: RenderContext): ReactNode[] {
  // Split text on custom patterns, preserving them
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

    const matches: { index: number; length: number; type: string; match: RegExpMatchArray }[] = []
    if (citeMatch?.index != null)
      matches.push({ index: citeMatch.index, length: citeMatch[0].length, type: 'cite', match: citeMatch })
    if (entityMatch?.index != null)
      matches.push({ index: entityMatch.index, length: entityMatch[0].length, type: 'entity', match: entityMatch })
    if (redactMatch?.index != null)
      matches.push({ index: redactMatch.index, length: redactMatch[0].length, type: 'redact', match: redactMatch })

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
          <span key={`ent-${keyIdx++}`} className="border-b border-dashed border-text-muted">
            {slug.replace(/-/g, ' ')}
          </span>
        )
      }
    } else if (earliest.type === 'redact') {
      const category = earliest.match[1]
      parts.push(
        <span
          key={`redact-${keyIdx++}`}
          className="inline-flex items-center gap-1 bg-[#1a1a1a] text-text-muted px-1.5 py-0.5 font-mono text-xs"
          title={`Redacted — Category ${category}`}
        >
          <span className="text-[9px] font-bold text-accent-red">[{category}]</span>
          <span className="line-through opacity-50">{earliest.match[2]}</span>
        </span>
      )
    }

    remaining = remaining.slice(earliest.index + earliest.length)
  }

  return parts
}

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
