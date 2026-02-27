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

  // Simple markdown → HTML for now (headings, paragraphs, lists, bold, italic)
  // Will be replaced with the full unified/remark renderer in Phase 4
  const html = simpleMarkdownToHtml(markdown)

  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-text-primary pb-3 mb-6 border-b-2 border-text-primary">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted block mb-1">
          Section 01
        </span>
        Key Findings
      </h2>
      <div
        className="prose-case-file font-body text-base leading-[1.75] text-text-primary [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_li]:mb-1.5 [&_strong]:font-semibold [&_em]:italic [&_blockquote]:border-l-3 [&_blockquote]:border-accent-red [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_code]:font-mono [&_code]:text-sm [&_code]:bg-elevated [&_code]:px-1 [&_code]:py-0.5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}

function simpleMarkdownToHtml(md: string): string {
  return md
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''

      // Headings
      if (trimmed.startsWith('### '))
        return `<h3>${inlineFormat(trimmed.slice(4))}</h3>`
      if (trimmed.startsWith('## '))
        return `<h2>${inlineFormat(trimmed.slice(3))}</h2>`
      if (trimmed.startsWith('# '))
        return `<h2>${inlineFormat(trimmed.slice(2))}</h2>`

      // Unordered list
      if (trimmed.match(/^[-*] /m)) {
        const items = trimmed
          .split('\n')
          .filter((l) => l.match(/^[-*] /))
          .map((l) => `<li>${inlineFormat(l.replace(/^[-*] /, ''))}</li>`)
          .join('')
        return `<ul>${items}</ul>`
      }

      // Ordered list
      if (trimmed.match(/^\d+\. /m)) {
        const items = trimmed
          .split('\n')
          .filter((l) => l.match(/^\d+\. /))
          .map((l) => `<li>${inlineFormat(l.replace(/^\d+\. /, ''))}</li>`)
          .join('')
        return `<ol>${items}</ol>`
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        const text = trimmed
          .split('\n')
          .map((l) => l.replace(/^>\s?/, ''))
          .join(' ')
        return `<blockquote><p>${inlineFormat(text)}</p></blockquote>`
      }

      // Paragraph
      return `<p>${inlineFormat(trimmed.replace(/\n/g, ' '))}</p>`
    })
    .join('')
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}
