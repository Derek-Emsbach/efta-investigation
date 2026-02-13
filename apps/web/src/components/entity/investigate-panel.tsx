'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Types ──────────────────────────────────────────────

interface Suggestion {
  type: 'connection' | 'tier_change' | 'evidence'
  summary: string
  data: Record<string, unknown>
  context: Record<string, unknown>
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  status: 'running' | 'done'
  suggestion?: Suggestion
  suggestionStatus?: 'pending' | 'applying' | 'applied' | 'dismissed' | 'error'
  applyError?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

// ─── Constants ──────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'What do we know?',
    prompt: 'Give me your first impression of this entity — what stands out, what their role appears to be, and what investigation threads I should explore. Keep it to 3-5 sentences, then list the numbered threads.',
  },
  {
    label: 'Missing connections?',
    prompt: 'Cross-reference this entity across all documents. Are there entities that co-occur in documents but have no recorded connection? Who should be linked that isn\'t?',
  },
  {
    label: 'Risk assessment',
    prompt: 'Based on the evidence, is this entity correctly tiered? What would strengthen or weaken the case? What specific documents or evidence would change the assessment?',
  },
  {
    label: 'Timeline gaps',
    prompt: 'Analyze this entity\'s timeline of events. What gaps exist? What periods have no documented activity? Where might we find missing events?',
  },
  {
    label: 'Related documents',
    prompt: 'What documents mention this entity that we should prioritize reviewing? Focus on documents with high severity or those that connect to other high-tier entities.',
  },
  {
    label: 'Who connects?',
    prompt: 'Map this entity\'s connection network. Who are they connected to, and through what evidence? What patterns do you see in the relationship types?',
  },
]

const TOOL_LABELS: Record<string, string> = {
  search_entities: 'Searching entities',
  search_documents: 'Searching documents',
  search_events: 'Searching events',
  get_entity_profile: 'Loading entity profile',
  get_document_detail: 'Loading document detail',
  query_connections: 'Querying connections',
  cross_reference: 'Cross-referencing',
  suggest_connection: 'Proposing connection',
  suggest_tier_change: 'Proposing tier change',
  suggest_evidence_item: 'Proposing evidence item',
}

const TIER_COLORS: Record<number, string> = {
  1: 'bg-critical/20 text-critical border-critical/30',
  2: 'bg-warning/20 text-warning border-warning/30',
  3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  4: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  5: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  6: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

// ─── Markdown Components ────────────────────────────────

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-sm font-bold text-text-primary mt-3 mb-1.5">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-text-primary mt-3 mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-text-primary mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs text-text-secondary leading-relaxed mb-2">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="text-xs text-text-secondary ml-4 mb-2 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="text-xs text-text-secondary ml-4 mb-2 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="text-text-primary font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="text-text-secondary italic">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-elevated px-1 py-0.5 rounded text-[11px] font-mono text-text-secondary">{children}</code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-info/40 pl-3 my-2 text-xs text-text-muted italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-border-default my-3" />,
}

// ─── Props ──────────────────────────────────────────────

interface InvestigatePanelProps {
  entityId: string
  entityName: string
  onClose: () => void
}

export default function InvestigatePanel({ entityId, entityName, onClose }: InvestigatePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoTriggered = useRef(false)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, activeToolCalls])

  // Auto-analyze on first mount
  useEffect(() => {
    if (autoTriggered.current) return
    autoTriggered.current = true
    const timer = setTimeout(() => {
      sendMessage(
        `Give me your first impression of ${entityName} — what stands out about their role, tier, and connections? Then list the investigation threads I can explore with you.`,
      )
    }, 300)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update tool calls in messages ──────────────────

  const updateToolCallInMessages = useCallback(
    (toolCallId: string, updates: Partial<ToolCall>) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.toolCalls) return msg
          const hasTarget = msg.toolCalls.some((tc) => tc.id === toolCallId)
          if (!hasTarget) return msg
          return {
            ...msg,
            toolCalls: msg.toolCalls.map((tc) =>
              tc.id === toolCallId ? { ...tc, ...updates } : tc,
            ),
          }
        }),
      )
    },
    [],
  )

  // ─── Handle approve/dismiss suggestion ────────────────

  const handleApprove = useCallback(
    async (toolCall: ToolCall) => {
      if (!toolCall.suggestion) return
      updateToolCallInMessages(toolCall.id, { suggestionStatus: 'applying' })

      try {
        const response = await fetch('/api/assistant/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: toolCall.suggestion.type,
            data: toolCall.suggestion.data,
          }),
        })

        const result = await response.json()
        if (!response.ok) {
          updateToolCallInMessages(toolCall.id, {
            suggestionStatus: 'error',
            applyError: result.error ?? 'Failed to apply',
          })
        } else {
          updateToolCallInMessages(toolCall.id, { suggestionStatus: 'applied' })
        }
      } catch {
        updateToolCallInMessages(toolCall.id, {
          suggestionStatus: 'error',
          applyError: 'Network error',
        })
      }
    },
    [updateToolCallInMessages],
  )

  const handleDismiss = useCallback(
    (toolCall: ToolCall) => {
      updateToolCallInMessages(toolCall.id, { suggestionStatus: 'dismissed' })
    },
    [updateToolCallInMessages],
  )

  // ─── Send message ─────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      setError(null)
      const userMessage: ChatMessage = { role: 'user', content: content.trim() }
      const updatedMessages = [...messages, userMessage]
      setMessages(updatedMessages)
      setInput('')
      setIsStreaming(true)
      setStreamingContent('')
      setActiveToolCalls([])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(`/api/entities/${entityId}/investigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.error ?? `Request failed with status ${response.status}`,
          )
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''
        let accumulatedText = ''
        let accumulatedToolCalls: ToolCall[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6)
              try {
                const data = JSON.parse(jsonStr)

                if ('content' in data && typeof data.content === 'string') {
                  accumulatedText += data.content
                  setStreamingContent(accumulatedText)
                } else if (
                  'tool_name' in data &&
                  'tool_use_id' in data &&
                  !('result' in data)
                ) {
                  const tc: ToolCall = {
                    id: data.tool_use_id,
                    name: data.tool_name,
                    input: data.tool_input ?? {},
                    status: 'running',
                  }
                  accumulatedToolCalls = [...accumulatedToolCalls, tc]
                  setActiveToolCalls([...accumulatedToolCalls])
                } else if ('tool_use_id' in data && 'result' in data) {
                  let suggestion: Suggestion | undefined
                  let suggestionStatus: ToolCall['suggestionStatus']
                  try {
                    const parsed = JSON.parse(data.result)
                    if (parsed?.__suggestion) {
                      suggestion = parsed.__suggestion as Suggestion
                      suggestionStatus = 'pending'
                    }
                  } catch {
                    // Not JSON with __suggestion
                  }

                  accumulatedToolCalls = accumulatedToolCalls.map((tc) =>
                    tc.id === data.tool_use_id
                      ? { ...tc, result: data.result, status: 'done' as const, suggestion, suggestionStatus }
                      : tc,
                  )
                  setActiveToolCalls([...accumulatedToolCalls])
                } else if ('message' in data && Object.keys(data).length === 1) {
                  setError(data.message)
                }
              } catch {
                // Malformed JSON
              }
            }
          }
        }

        // Finalize assistant message
        if (accumulatedText.trim() || accumulatedToolCalls.length > 0) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: accumulatedText,
            toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
          }
          setMessages((prev) => [...prev, assistantMessage])
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred')
        }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        setActiveToolCalls([])
        abortRef.current = null
      }
    },
    [messages, isStreaming, entityId],
  )

  // ─── Event handlers ───────────────────────────────────

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex h-full flex-col border-l border-border-default bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
          </svg>
          <span className="text-xs font-semibold text-text-primary">Investigate</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted truncate max-w-[120px]">
            {entityName}
          </span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary transition-colors p-1"
            aria-label="Close investigate panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-4">
              <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                  <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-secondary mb-0.5">
                  Investigating {entityName}...
                </p>
                <p className="text-[10px] text-text-muted">
                  Or choose an angle below
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className="text-left rounded-lg border border-border-default bg-elevated/50 px-3 py-2.5 transition-colors hover:border-info/30 hover:bg-info/5 group"
                >
                  <p className="text-xs font-medium text-text-secondary group-hover:text-info transition-colors">
                    {action.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={`msg-${i}`}
                message={msg}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
              />
            ))}

            {isStreaming && (
              <div className="space-y-2">
                {activeToolCalls.map((tc) => (
                  <ToolCallBlock key={tc.id} toolCall={tc} />
                ))}
                {streamingContent ? (
                  <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {streamingContent}
                    </ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-info/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  </div>
                ) : activeToolCalls.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Thinking...
                  </div>
                ) : null}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-xs text-critical">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick actions — horizontal scroll after messages */}
      {!isStreaming && messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border-default px-4 py-2.5 scrollbar-none shrink-0">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.prompt)}
              className="shrink-0 rounded-lg border border-border-default px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-info/30 hover:bg-info/5 hover:text-info"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border-default px-4 py-3 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${entityName}...`}
              rows={2}
              disabled={isStreaming}
              className="w-full resize-none rounded-lg border border-border-default bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none disabled:opacity-50"
            />
            <span className="absolute bottom-1.5 right-2 text-[9px] text-text-muted/40">
              {isStreaming ? '' : '\u2318\u23CE'}
            </span>
          </div>
          {isStreaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="shrink-0 rounded-lg bg-critical/10 px-3 py-2 text-xs font-medium text-critical hover:bg-critical/20 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-info px-3 py-2 text-xs font-medium text-white hover:bg-info/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ─── Message Bubble ──────────────────────────────────────

function MessageBubble({
  message,
  onApprove,
  onDismiss,
}: {
  message: ChatMessage
  onApprove: (tc: ToolCall) => void
  onDismiss: (tc: ToolCall) => void
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-info/10 px-3 py-2 text-xs text-text-primary leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {message.toolCalls?.map((tc) => (
        <div key={tc.id}>
          <ToolCallBlock toolCall={tc} />
          {tc.suggestion && tc.suggestionStatus && (
            <SuggestionCard
              toolCall={tc}
              onApprove={() => onApprove(tc)}
              onDismiss={() => onDismiss(tc)}
            />
          )}
        </div>
      ))}
      {message.content && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
      )}
    </div>
  )
}

// ─── Tool Call Block ─────────────────────────────────────

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name
  const isRunning = toolCall.status === 'running'

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-default bg-elevated/50 px-3 py-1.5">
      {isRunning ? (
        <svg className="h-3.5 w-3.5 animate-spin text-info" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  )
}

// ─── Suggestion Card ─────────────────────────────────────

function SuggestionCard({
  toolCall,
  onApprove,
  onDismiss,
}: {
  toolCall: ToolCall
  onApprove: () => void
  onDismiss: () => void
}) {
  const suggestion = toolCall.suggestion!
  const status = toolCall.suggestionStatus!

  const typeLabels: Record<string, string> = {
    connection: 'Connection',
    tier_change: 'Tier Change',
    evidence: 'Evidence',
  }

  const typeColors: Record<string, string> = {
    connection: 'border-info/30 bg-info/5',
    tier_change: 'border-warning/30 bg-warning/5',
    evidence: 'border-success/30 bg-success/5',
  }

  if (status === 'applied') {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
        Applied: {suggestion.summary}
      </div>
    )
  }

  if (status === 'dismissed') {
    return (
      <div className="rounded-lg border border-border-default bg-elevated/30 px-3 py-2 text-xs text-text-muted line-through">
        {suggestion.summary}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-xs text-critical">
        Failed: {toolCall.applyError ?? 'Unknown error'}
      </div>
    )
  }

  if (status === 'applying') {
    return (
      <div className="rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-xs text-info flex items-center gap-2">
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Applying...
      </div>
    )
  }

  return (
    <div className={`rounded-lg border px-3 py-2 ${typeColors[suggestion.type] ?? 'border-border-default bg-elevated/30'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            {typeLabels[suggestion.type] ?? suggestion.type}
          </span>
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            {suggestion.summary}
          </p>
          {suggestion.type === 'tier_change' && typeof suggestion.data.new_tier === 'number' && (
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                TIER_COLORS[suggestion.data.new_tier] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}
            >
              T{suggestion.data.new_tier}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onApprove}
            className="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/20 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg bg-elevated px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
