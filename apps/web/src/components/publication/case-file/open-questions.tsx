import type { OpenQuestion } from '@efta/shared'

interface OpenQuestionsProps {
  questions: OpenQuestion[]
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'text-[#c41e3a]',
  high: 'text-[#e65100]',
  medium: 'text-[#f57f17]',
  low: 'text-[#6b7280]',
}

export function OpenQuestions({ questions }: OpenQuestionsProps) {
  if (questions.length === 0) return null

  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-text-primary pb-3 mb-6 border-b-2 border-text-primary">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted block mb-1">
          Section 05
        </span>
        Open Questions
      </h2>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className="border-l-[3px] border-[#f57f17] bg-[#fff8e1] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] font-semibold text-[#f57f17] tracking-[0.06em]">
                Q-{String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                  PRIORITY_STYLES[q.priority] ?? 'text-text-muted'
                }`}
              >
                {q.priority}
              </span>
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider ml-auto">
                {q.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="font-body text-sm font-semibold text-text-primary leading-snug">
              {q.question}
            </p>
            {q.answer && (
              <p className="mt-2 font-body text-xs text-text-secondary italic">
                {q.answer}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
