interface FindingsMarkdownProps {
  markdown: string
}

export function FindingsMarkdown({ markdown }: FindingsMarkdownProps) {
  if (!markdown || markdown.trim() === '') {
    return (
      <p className="font-body text-sm text-text-muted italic">
        Findings report is being compiled.
      </p>
    )
  }

  const html = markdownToHtml(markdown)

  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-text-primary pb-3 mb-6 border-b-2 border-text-primary">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted block mb-1">
          Section 01
        </span>
        Key Findings
      </h2>
      <div
        className={`
          prose-case-file font-body text-base leading-[1.75] text-text-primary
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3
          [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
          [&_h4]:font-display [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2
          [&_p]:mb-4
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
          [&_li]:mb-1.5
          [&_strong]:font-semibold
          [&_em]:italic
          [&_blockquote]:border-l-3 [&_blockquote]:border-accent-red [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_blockquote]:my-4
          [&_blockquote_p]:mb-2
          [&_code]:font-mono [&_code]:text-sm [&_code]:bg-elevated [&_code]:px-1 [&_code]:py-0.5
          [&_hr]:border-t [&_hr]:border-border-default [&_hr]:my-8
          [&_.table-wrapper]:overflow-x-auto [&_.table-wrapper]:my-6 [&_.table-wrapper]:rounded
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
          [&_th]:bg-[#e8dcc7] [&_th]:border [&_th]:border-[#d4c5a9] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide
          [&_td]:border [&_td]:border-[#d4c5a9] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top
          [&_tbody_tr:hover]:bg-[#ebe0ca]/50
          [&_.speculation-block]:my-6 [&_.speculation-block]:border-l-3 [&_.speculation-block]:border-amber-500 [&_.speculation-block]:bg-amber-50/40 [&_.speculation-block]:pl-4 [&_.speculation-block]:pr-3 [&_.speculation-block]:py-3 [&_.speculation-block]:rounded-r
          [&_.speculation-header]:font-mono [&_.speculation-header]:text-xs [&_.speculation-header]:font-semibold [&_.speculation-header]:uppercase [&_.speculation-header]:tracking-wide [&_.speculation-header]:text-amber-700 [&_.speculation-header]:mb-3
        `}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}

// ─── Markdown → HTML ──────────────────────────────────────────────────────────

function markdownToHtml(md: string): string {
  // Strip HTML comments (<!-- ... -->)
  let processed = md.replace(/<!--[\s\S]*?-->/g, '')

  // Handle [SPECULATION_START]...[SPECULATION_END] blocks
  // Split by speculation blocks, process each part
  const parts = processed.split(
    /(\[SPECULATION_START\][\s\S]*?\[SPECULATION_END\])/,
  )

  return parts
    .map((part) => {
      const specMatch = part.match(
        /\[SPECULATION_START\]\n?([\s\S]*?)\n?\[SPECULATION_END\]/,
      )
      if (specMatch) {
        const innerHtml = processBlocks(specMatch[1].trim())
        return (
          '<div class="speculation-block">' +
          '<div class="speculation-header">Speculative Analysis — Inference Beyond Documented Evidence</div>' +
          innerHtml +
          '</div>'
        )
      }
      return processBlocks(part)
    })
    .join('')
}

function processBlocks(md: string): string {
  return md
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''

      // Horizontal rule
      if (/^-{3,}$/.test(trimmed)) return '<hr />'

      // Table (block with pipe-delimited rows and separator)
      if (/^\|/m.test(trimmed) && /\|[\s-:|]+\|/.test(trimmed))
        return parseTable(trimmed)

      // Headings (h4 → h2, # maps to h2 to avoid conflict with component h2)
      if (trimmed.startsWith('#### '))
        return `<h4>${inlineFormat(trimmed.slice(5))}</h4>`
      if (trimmed.startsWith('### '))
        return `<h3>${inlineFormat(trimmed.slice(4))}</h3>`
      if (trimmed.startsWith('## '))
        return `<h2>${inlineFormat(trimmed.slice(3))}</h2>`
      if (trimmed.startsWith('# '))
        return `<h2>${inlineFormat(trimmed.slice(2))}</h2>`

      // Unordered list
      if (/^[-*] /m.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((l) => /^\s*[-*] /.test(l))
          .map(
            (l) =>
              `<li>${inlineFormat(l.replace(/^\s*[-*] /, ''))}</li>`,
          )
          .join('')
        return `<ul>${items}</ul>`
      }

      // Ordered list
      if (/^\d+\. /m.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((l) => /^\s*\d+\. /.test(l))
          .map(
            (l) =>
              `<li>${inlineFormat(l.replace(/^\s*\d+\. /, ''))}</li>`,
          )
          .join('')
        return `<ol>${items}</ol>`
      }

      // Blockquote (may contain sub-paragraphs separated by bare > lines)
      if (/^>/m.test(trimmed)) {
        const lines = trimmed
          .split('\n')
          .map((l) => l.replace(/^>\s?/, ''))
        // Group into sub-paragraphs by empty lines within the blockquote
        const paragraphs: string[][] = [[]]
        for (const line of lines) {
          if (line.trim() === '') {
            paragraphs.push([])
          } else {
            paragraphs[paragraphs.length - 1].push(line)
          }
        }
        const innerHtml = paragraphs
          .filter((p) => p.length > 0)
          .map((p) => `<p>${inlineFormat(p.join(' '))}</p>`)
          .join('')
        return `<blockquote>${innerHtml}</blockquote>`
      }

      // Paragraph
      return `<p>${inlineFormat(trimmed.replace(/\n/g, ' '))}</p>`
    })
    .join('')
}

// ─── Table Parser ─────────────────────────────────────────────────────────────

function parseTable(block: string): string {
  const lines = block
    .trim()
    .split('\n')
    .filter((l) => l.trim())
  if (lines.length < 3) return `<p>${inlineFormat(block)}</p>`

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

  const headers = parseRow(lines[0])
  const sepIndex = lines.findIndex((l) => /^\|[\s-:|]+\|$/.test(l))
  if (sepIndex === -1) return `<p>${inlineFormat(block)}</p>`

  const dataRows = lines.slice(sepIndex + 1)

  const thead = `<thead><tr>${headers.map((h) => `<th>${inlineFormat(h)}</th>`).join('')}</tr></thead>`
  const tbody = `<tbody>${dataRows
    .map((row) => {
      const cells = parseRow(row)
      return `<tr>${cells.map((c) => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`
    })
    .join('')}</tbody>`

  return `<div class="table-wrapper"><table>${thead}${tbody}</table></div>`
}

// ─── Inline Formatting ────────────────────────────────────────────────────────

function inlineFormat(text: string): string {
  return (
    text
      // Bold (must come before italic)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic (single * not preceded/followed by *)
      .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
  )
}
