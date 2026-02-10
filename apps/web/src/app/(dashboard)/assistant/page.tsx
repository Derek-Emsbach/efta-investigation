'use client'

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'

// ─── Types ───────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  status: 'running' | 'done'
}

// ─── Main Page ───────────────────────────────────────────────

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, activeToolCalls])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

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
        const response = await fetch('/api/assistant', {
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
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim()
              // Next line should be data
              const dataLineIndex = lines.indexOf(line) + 1
              if (dataLineIndex < lines.length && lines[dataLineIndex].startsWith('data: ')) {
                // handled below
              }
              void eventType // processed via data lines
            }

            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6)
              try {
                const data = JSON.parse(jsonStr)

                // Determine event type from buffer context
                // SSE format: "event: type\ndata: {...}\n\n"
                // We parse by looking at the data content shape
                if ('content' in data && typeof data.content === 'string') {
                  // text event
                  accumulatedText += data.content
                  setStreamingContent(accumulatedText)
                } else if ('tool_name' in data && 'tool_use_id' in data && !('result' in data)) {
                  // tool_start event
                  const tc: ToolCall = {
                    id: data.tool_use_id,
                    name: data.tool_name,
                    input: data.tool_input ?? {},
                    status: 'running',
                  }
                  accumulatedToolCalls = [...accumulatedToolCalls, tc]
                  setActiveToolCalls([...accumulatedToolCalls])
                } else if ('tool_use_id' in data && 'result' in data) {
                  // tool_result event
                  accumulatedToolCalls = accumulatedToolCalls.map((tc) =>
                    tc.id === data.tool_use_id
                      ? { ...tc, result: data.result, status: 'done' as const }
                      : tc,
                  )
                  setActiveToolCalls([...accumulatedToolCalls])
                } else if ('message' in data && Object.keys(data).length === 1) {
                  // error event
                  setError(data.message)
                }
                // done event is empty {} — ignored
              } catch {
                // Malformed JSON line, skip
              }
            }
          }
        }

        // Finalize: add assistant message with accumulated content
        if (accumulatedText.trim() || accumulatedToolCalls.length > 0) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: accumulatedText,
            toolCalls:
              accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
          }
          setMessages((prev) => [...prev, assistantMessage])
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(
            err instanceof Error ? err.message : 'An unexpected error occurred',
          )
        }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        setActiveToolCalls([])
        abortRef.current = null
      }
    },
    [messages, isStreaming],
  )

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

  const handleSuggestion = (query: string) => {
    sendMessage(query)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border-default bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <AssistantAvatar />
          <div>
            <h1 className="font-display text-lg font-semibold text-text-primary">
              Research Assistant
            </h1>
            <p className="text-xs text-text-muted">
              AI-powered investigation queries with database access
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([])
              setError(null)
            }}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Clear conversation
          </button>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <WelcomePanel onSuggestion={handleSuggestion} />
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* Streaming state */}
            {isStreaming && (
              <div className="flex gap-3">
                <div className="shrink-0 mt-1">
                  <AssistantAvatar size="sm" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  {/* Active tool calls */}
                  {activeToolCalls.map((tc) => (
                    <ToolCallBlock key={tc.id} toolCall={tc} />
                  ))}

                  {/* Streaming text */}
                  {streamingContent ? (
                    <div className="prose-invert text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {streamingContent}
                      <span className="inline-block w-1.5 h-4 bg-info/70 animate-pulse ml-0.5 align-text-bottom" />
                    </div>
                  ) : activeToolCalls.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <Spinner />
                      <span>Thinking...</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border-default bg-surface px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-end gap-3"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about entities, documents, connections, or patterns..."
              rows={1}
              disabled={isStreaming}
              className="w-full resize-none rounded-lg border border-border-default bg-elevated px-4 py-3 pr-12 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none disabled:opacity-50"
            />
            <span className="absolute bottom-1.5 right-3 text-[10px] text-text-muted/50">
              {isStreaming ? '' : '\u2318\u23CE'}
            </span>
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="shrink-0 rounded-lg bg-critical/10 px-4 py-3 text-sm font-medium text-critical hover:bg-critical/20 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-info px-4 py-3 text-sm font-medium text-white hover:bg-info/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ─── Welcome Panel ─────────────────────────────────────────

const SUGGESTED_QUERIES = [
  {
    title: 'Entity Connections',
    query: 'What connections exist for Leon Black?',
    icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.257m0 0l4.5 4.5',
  },
  {
    title: 'Under-Investigated',
    query: 'Which Tier 3 entities have the least documented evidence?',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z',
  },
  {
    title: 'NPA Documents',
    query: 'Find all documents related to the Non-Prosecution Agreement',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
  {
    title: 'Redaction Patterns',
    query: 'What redaction patterns appear across the most critical documents?',
    icon: 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88',
  },
  {
    title: 'Entity Profile',
    query: 'Show me everything we have on Sarah Kellen',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  },
  {
    title: 'Critical Documents',
    query: 'Which entities appear in the most extreme_critical documents?',
    icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33',
  },
]

function WelcomePanel({ onSuggestion }: { onSuggestion: (query: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        {/* Welcome header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-info/10 mb-4">
            <AssistantAvatar size="lg" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">
            Research Assistant
          </h2>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Ask questions about entities, documents, connections, and patterns.
            I have read-only access to the full investigation database.
          </p>
        </div>

        {/* Suggested queries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq.title}
              onClick={() => onSuggestion(sq.query)}
              className="group flex items-start gap-3 rounded-lg border border-border-default bg-surface p-4 text-left transition-all hover:border-info/40 hover:bg-elevated/50"
            >
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-text-muted group-hover:text-info transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={sq.icon} />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                  {sq.title}
                </p>
                <p className="text-sm text-text-secondary group-hover:text-text-primary transition-colors line-clamp-2">
                  {sq.query}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Message Bubble ────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-info/10 border border-info/20 px-4 py-3">
          <p className="text-sm text-text-primary whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-1">
        <AssistantAvatar size="sm" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {/* Tool calls */}
        {message.toolCalls?.map((tc) => (
          <ToolCallBlock key={tc.id} toolCall={tc} />
        ))}

        {/* Text content */}
        {message.content && (
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tool Call Block ───────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  search_entities: 'Searching entities',
  search_documents: 'Searching documents',
  search_events: 'Searching events',
  get_entity_profile: 'Loading entity profile',
  get_document_detail: 'Loading document detail',
  query_connections: 'Querying connections',
  cross_reference: 'Cross-referencing',
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name

  // Format params for display
  const paramEntries = Object.entries(toolCall.input).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  )

  return (
    <div className="rounded-lg border border-border-default bg-elevated/30 overflow-hidden text-xs">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-elevated/50 transition-colors"
      >
        {toolCall.status === 'running' ? (
          <Spinner />
        ) : (
          <svg
            className="h-3.5 w-3.5 text-success shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        <span className="text-text-muted font-medium">{label}</span>

        {/* Inline params summary */}
        {paramEntries.length > 0 && (
          <span className="text-text-muted/60 truncate">
            ({paramEntries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})
          </span>
        )}

        <svg
          className={`ml-auto h-3 w-3 text-text-muted shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border-default">
          {/* Params */}
          {paramEntries.length > 0 && (
            <div className="px-3 py-2 border-b border-border-default">
              <p className="text-text-muted/60 uppercase tracking-wider text-[10px] mb-1">
                Parameters
              </p>
              <pre className="text-text-muted font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {toolCall.result && (
            <div className="px-3 py-2 max-h-60 overflow-auto">
              <p className="text-text-muted/60 uppercase tracking-wider text-[10px] mb-1">
                Result
              </p>
              <pre className="text-text-muted font-mono whitespace-pre-wrap break-words">
                {toolCall.result.length > 3000
                  ? toolCall.result.slice(0, 3000) + '\n... (truncated)'
                  : toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Small Components ──────────────────────────────────────

function AssistantAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <div
      className={`${sizeClass} rounded-lg bg-info/10 flex items-center justify-center`}
    >
      <svg
        className={`${iconClass} text-info`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin text-info shrink-0"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
