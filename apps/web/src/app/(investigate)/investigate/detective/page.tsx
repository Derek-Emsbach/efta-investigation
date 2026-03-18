'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'

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

interface QuotaInfo {
  queries_used: number
  daily_limit: number
}

const TOOL_LABELS: Record<string, string> = {
  search_entities: 'Searching entities',
  search_documents: 'Searching documents',
  search_events: 'Searching events',
  get_entity_profile: 'Loading entity profile',
  get_document_detail: 'Loading document',
  get_document_text: 'Reading document text',
  query_connections: 'Querying connections',
  cross_reference: 'Cross-referencing data',
}

export default function DetectivePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsStreaming(true)
    setStreamingContent('')
    setActiveToolCalls([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/investigate/detective', {
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Error: ${res.status}`)
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError('Failed to start streaming')
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      const toolCalls: ToolCall[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim()
            const dataLine = lines[lines.indexOf(line) + 1]
            if (!dataLine?.startsWith('data: ')) continue

            try {
              const data = JSON.parse(dataLine.slice(6))

              switch (eventType) {
                case 'quota':
                  setQuota(data as QuotaInfo)
                  break

                case 'text':
                  fullContent += data.content
                  setStreamingContent(fullContent)
                  break

                case 'tool_start': {
                  const tc: ToolCall = {
                    id: data.tool_use_id,
                    name: data.tool_name,
                    input: data.tool_input,
                    status: 'running',
                  }
                  toolCalls.push(tc)
                  setActiveToolCalls([...toolCalls])
                  break
                }

                case 'tool_result': {
                  const idx = toolCalls.findIndex((t) => t.id === data.tool_use_id)
                  if (idx !== -1) {
                    toolCalls[idx] = { ...toolCalls[idx], result: data.result, status: 'done' }
                    setActiveToolCalls([...toolCalls])
                  }
                  break
                }

                case 'done': {
                  const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    content: fullContent,
                    toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                  }
                  setMessages((prev) => [...prev, assistantMsg])
                  setStreamingContent('')
                  setActiveToolCalls([])
                  fullContent = ''
                  toolCalls.length = 0
                  break
                }

                case 'error':
                  setError(data.message)
                  break
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setIsStreaming(false)
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamingContent },
      ])
      setStreamingContent('')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Quota bar */}
      {quota && (
        <div className="border-b border-border-default bg-surface/30 px-6 py-1.5">
          <div className="mx-auto max-w-3xl flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-text-muted">
              AI QUERIES: {quota.queries_used}/{quota.daily_limit} TODAY
            </span>
            <div className="w-24 h-1 bg-border-default rounded-full overflow-hidden">
              <div
                className="h-full bg-critical rounded-full transition-all"
                style={{ width: `${Math.min(100, (quota.queries_used / quota.daily_limit) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-16">
              <h2 className="font-mono text-lg font-bold text-text-primary mb-2">
                Detective Research Assistant
              </h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                Ask questions about the EFTA documents, entities, connections, and events.
                The detective can search the database and help build your case.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Who are the Tier 1 entities?',
                  'Search for documents mentioning Deutsche Bank',
                  'What connections does Ghislaine Maxwell have?',
                  'Find events related to the NPA',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded border border-border-default bg-surface/50 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:border-critical/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {/* Streaming state */}
          {isStreaming && (
            <div className="space-y-3">
              {/* Active tool calls */}
              {activeToolCalls.map((tc) => (
                <div
                  key={tc.id}
                  className="flex items-center gap-2 rounded border border-border-default bg-surface/30 px-3 py-2 text-xs font-mono text-text-muted"
                >
                  {tc.status === 'running' ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-critical border-t-transparent" />
                  ) : (
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  <span>{TOOL_LABELS[tc.name] ?? tc.name}</span>
                </div>
              ))}

              {/* Streaming text */}
              {streamingContent && (
                <div className="rounded border border-border-default bg-surface/50 px-4 py-3">
                  <div className="prose prose-sm prose-invert max-w-none text-text-secondary whitespace-pre-wrap font-mono text-sm">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-critical animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-critical/30 bg-critical/10 px-6 py-2">
          <div className="mx-auto max-w-3xl flex items-center justify-between">
            <p className="text-xs text-critical">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-critical underline"
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border-default bg-surface/50 px-6 py-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Ask the detective..."
              rows={1}
              className="flex-1 resize-none rounded border border-border-default bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-critical/50 transition-colors font-mono"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex-shrink-0 rounded bg-border-default px-4 py-2.5 text-xs font-mono text-text-primary hover:bg-border-default/80 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex-shrink-0 rounded bg-critical px-4 py-2.5 text-xs font-mono text-white hover:bg-critical/90 disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            )}
          </div>
          <p className="text-[10px] text-text-muted mt-1.5 text-center">
            Read-only access. Findings should be submitted through the Submit tab.
          </p>
        </form>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded px-4 py-3 ${
          isUser
            ? 'bg-critical/10 border border-critical/20 text-text-primary'
            : 'border border-border-default bg-surface/50 text-text-secondary'
        }`}
      >
        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {message.toolCalls.map((tc) => (
              <details key={tc.id} className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] font-mono text-text-muted hover:text-text-secondary">
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {TOOL_LABELS[tc.name] ?? tc.name}
                </summary>
                {tc.result && (
                  <pre className="mt-1 p-2 rounded bg-background/50 text-[10px] text-text-muted overflow-x-auto max-h-32 overflow-y-auto">
                    {tc.result.length > 500 ? tc.result.slice(0, 500) + '...' : tc.result}
                  </pre>
                )}
              </details>
            ))}
          </div>
        )}

        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  )
}
