import { renderMarkdown, type EntityRef, type RenderContext } from '@/lib/markdown-renderer'

interface FindingsMarkdownProps {
  markdown: string
  entities?: EntityRef[]
}

export function FindingsMarkdown({ markdown, entities = [] }: FindingsMarkdownProps) {
  if (!markdown || markdown.trim() === '') {
    return (
      <p className="font-body text-sm text-text-muted italic">
        Findings report is being compiled.
      </p>
    )
  }

  const context: RenderContext = {
    citations: [],
    entities,
    autoLink: true,
  }

  // Pre-process: split on [SPECULATION_START]...[SPECULATION_END] blocks
  const parts = markdown.split(
    /(\[SPECULATION_START\][\s\S]*?\[SPECULATION_END\])/,
  )

  const rendered = parts.map((part, i) => {
    const specMatch = part.match(
      /\[SPECULATION_START\]\n?([\s\S]*?)\n?\[SPECULATION_END\]/,
    )
    if (specMatch) {
      const innerNodes = renderMarkdown(specMatch[1].trim(), context)
      return (
        <div
          key={`spec-${i}`}
          className="my-6 border-l-[3px] border-amber-500 bg-amber-50/40 pl-4 pr-3 py-3 rounded-r"
        >
          <div className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-700 mb-3">
            Speculative Analysis — Inference Beyond Documented Evidence
          </div>
          {innerNodes}
        </div>
      )
    }
    return (
      <div key={`content-${i}`}>
        {renderMarkdown(part, context)}
      </div>
    )
  })

  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-text-primary pb-3 mb-6 border-b-2 border-text-primary">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted block mb-1">
          Section 01
        </span>
        Key Findings
      </h2>
      <div className="prose-case-file">
        {rendered}
      </div>
    </section>
  )
}
