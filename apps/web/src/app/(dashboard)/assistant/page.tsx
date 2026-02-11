'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
  type FormEvent,
} from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────

interface Suggestion {
  type: 'connection' | 'tier_change' | 'evidence' | 'platform'
  summary: string
  data: Record<string, unknown>
  context: Record<string, unknown>
}

interface ChatMessage {
  dbId?: string
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
  suggestion?: Suggestion
  suggestionStatus?: 'pending' | 'applying' | 'applied' | 'dismissed' | 'error'
  applyError?: string
}

interface ConversationSummary {
  id: string
  title: string | null
  pinned: boolean
  message_count: number
  updated_at: string
}

// ─── Tier Colors ──────────────────────────────────────────────

const TIER_COLORS: Record<number, string> = {
  1: 'bg-critical/20 text-critical border-critical/30',
  2: 'bg-warning/20 text-warning border-warning/30',
  3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  4: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  5: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  6: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const TIER_LABELS: Record<number, string> = {
  1: 'Convicted/Charged',
  2: 'NPA Immunity',
  3: 'Suspicious',
  4: 'Social/Prof',
  5: 'Victim/Witness',
  6: 'Staff/Legal',
}

function TierBadge({ tier }: { tier: number | null }) {
  if (!tier) return null
  const cls =
    TIER_COLORS[tier] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      T{tier}
    </span>
  )
}

// ─── Priority Badge ───────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-critical/20 text-critical border-critical/30',
  medium: 'bg-warning/20 text-warning border-warning/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const CATEGORY_LABELS: Record<string, string> = {
  feature: 'Feature',
  tracking: 'Tracking',
  tool: 'Tool',
  investigation: 'Investigation',
  data_model: 'Data Model',
  ux: 'UX',
}

// ─── Helpers ──────────────────────────────────────────────────

function generateTitle(message: string): string {
  const cleaned = message.trim().replace(/\n+/g, ' ')
  if (cleaned.length <= 60) return cleaned
  const truncated = cleaned.slice(0, 60)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > 20) {
    return truncated.slice(0, lastSpace) + '...'
  }
  return truncated + '...'
}

function timeGroup(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This Week'
  if (diffDays < 30) return 'This Month'
  return 'Older'
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Main Page (with Suspense wrapper) ──────────────────────

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AssistantPageInner />
    </Suspense>
  )
}

// ─── Inner Page ─────────────────────────────────────────────

function AssistantPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(
    searchParams.get('c'),
  )
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [showPanel, setShowPanel] = useState(true)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef<string | null>(conversationId)

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  // ─── Load conversation list on mount ────────────────────
  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch('/api/assistant/conversations')
        if (res.ok) {
          const data = await res.json()
          setConversations(data.conversations ?? [])
        }
      } catch {
        // Silently fail — list will just be empty
      } finally {
        setLoadingConversations(false)
      }
    }
    fetchConversations()
  }, [])

  // ─── Load conversation from URL param ───────────────────
  useEffect(() => {
    const cParam = searchParams.get('c')
    if (cParam && cParam !== conversationIdRef.current) {
      loadConversation(cParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ─── Auto-scroll ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, activeToolCalls])

  // ─── Auto-resize textarea ───────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  // ─── Load a conversation ────────────────────────────────

  const loadConversation = useCallback(
    async (id: string) => {
      setLoadingMessages(true)
      setError(null)
      setMessages([])
      setConversationId(id)
      conversationIdRef.current = id

      try {
        const res = await fetch(`/api/assistant/conversations/${id}`)
        if (!res.ok) {
          setError('Failed to load conversation')
          return
        }
        const data = await res.json()
        const loaded: ChatMessage[] = (data.messages ?? []).map(
          (m: { dbId: string; role: string; content: string; toolCalls?: ToolCall[] }) => ({
            dbId: m.dbId,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            toolCalls: m.toolCalls,
          }),
        )
        setMessages(loaded)
      } catch {
        setError('Failed to load conversation')
      } finally {
        setLoadingMessages(false)
      }
    },
    [],
  )

  // ─── Update URL helper ─────────────────────────────────

  const updateUrl = useCallback(
    (id: string | null) => {
      if (id) {
        router.replace(`/assistant?c=${id}`, { scroll: false })
      } else {
        router.replace('/assistant', { scroll: false })
      }
    },
    [router],
  )

  // ─── Refresh conversation list ──────────────────────────

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations ?? [])
      }
    } catch {
      // Silently fail
    }
  }, [])

  // ─── Save message to DB ─────────────────────────────────

  const saveMessage = useCallback(
    async (
      convId: string,
      msg: { role: string; content: string; tool_calls?: ToolCall[] },
    ): Promise<string | null> => {
      try {
        const res = await fetch(`/api/assistant/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        })
        if (res.ok) {
          const data = await res.json()
          return data.id as string
        }
      } catch {
        // Silently fail — message is still in local state
      }
      return null
    },
    [],
  )

  // ─── Update tool call in messages (local state) ─────────

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

  // ─── Persist suggestion status to DB ────────────────────

  const persistToolCallUpdate = useCallback(
    async (toolCallId: string, updates: Partial<ToolCall>) => {
      const convId = conversationIdRef.current
      if (!convId) return

      // Find the message containing this tool call
      setMessages((prev) => {
        const msg = prev.find((m) =>
          m.toolCalls?.some((tc) => tc.id === toolCallId),
        )
        if (!msg?.dbId || !msg.toolCalls) return prev

        const updatedToolCalls = msg.toolCalls.map((tc) =>
          tc.id === toolCallId ? { ...tc, ...updates } : tc,
        )

        // Fire and forget the DB update
        fetch(
          `/api/assistant/conversations/${convId}/messages/${msg.dbId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_calls: updatedToolCalls }),
          },
        ).catch(() => {
          // Silently fail
        })

        return prev
      })
    },
    [],
  )

  // ─── Handle approve ─────────────────────────────────────

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
          const errUpdates = {
            suggestionStatus: 'error' as const,
            applyError: result.error ?? 'Failed to apply',
          }
          updateToolCallInMessages(toolCall.id, errUpdates)
          persistToolCallUpdate(toolCall.id, errUpdates)
        } else {
          const okUpdates = { suggestionStatus: 'applied' as const }
          updateToolCallInMessages(toolCall.id, okUpdates)
          persistToolCallUpdate(toolCall.id, okUpdates)
        }
      } catch {
        const errUpdates = {
          suggestionStatus: 'error' as const,
          applyError: 'Network error',
        }
        updateToolCallInMessages(toolCall.id, errUpdates)
        persistToolCallUpdate(toolCall.id, errUpdates)
      }
    },
    [updateToolCallInMessages, persistToolCallUpdate],
  )

  // ─── Handle dismiss ─────────────────────────────────────

  const handleDismiss = useCallback(
    (toolCall: ToolCall) => {
      const updates = { suggestionStatus: 'dismissed' as const }
      updateToolCallInMessages(toolCall.id, updates)
      persistToolCallUpdate(toolCall.id, updates)
    },
    [updateToolCallInMessages, persistToolCallUpdate],
  )

  // ─── Send message ───────────────────────────────────────

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

      // Ensure conversation exists
      let convId = conversationIdRef.current

      try {
        if (!convId) {
          const title = generateTitle(content.trim())
          const createRes = await fetch('/api/assistant/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })
          if (createRes.ok) {
            const created = await createRes.json()
            convId = created.id as string
            setConversationId(convId)
            conversationIdRef.current = convId
            updateUrl(convId)
          }
        }

        // Save user message
        if (convId) {
          const userDbId = await saveMessage(convId, {
            role: 'user',
            content: content.trim(),
          })
          if (userDbId) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, dbId: userDbId } : m,
              ),
            )
          }
        }

        // Stream response
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
              void eventType
            }

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
                      ? {
                          ...tc,
                          result: data.result,
                          status: 'done' as const,
                          suggestion,
                          suggestionStatus,
                        }
                      : tc,
                  )
                  setActiveToolCalls([...accumulatedToolCalls])
                } else if (
                  'message' in data &&
                  Object.keys(data).length === 1
                ) {
                  setError(data.message)
                }
              } catch {
                // Malformed JSON line
              }
            }
          }
        }

        // Finalize assistant message
        if (accumulatedText.trim() || accumulatedToolCalls.length > 0) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: accumulatedText,
            toolCalls:
              accumulatedToolCalls.length > 0
                ? accumulatedToolCalls
                : undefined,
          }

          // Save assistant message to DB
          if (convId) {
            const assistantDbId = await saveMessage(convId, {
              role: 'assistant',
              content: accumulatedText,
              tool_calls:
                accumulatedToolCalls.length > 0
                  ? accumulatedToolCalls
                  : undefined,
            })
            if (assistantDbId) {
              assistantMessage.dbId = assistantDbId
            }
          }

          setMessages((prev) => [...prev, assistantMessage])
          refreshConversations()
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred',
          )
        }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        setActiveToolCalls([])
        abortRef.current = null
      }
    },
    [messages, isStreaming, updateUrl, saveMessage, refreshConversations],
  )

  // ─── Event handlers ─────────────────────────────────────

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

  const handleNewConversation = () => {
    setMessages([])
    setConversationId(null)
    conversationIdRef.current = null
    setError(null)
    updateUrl(null)
  }

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) return
    updateUrl(id)
    loadConversation(id)
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/assistant/conversations/${id}`, { method: 'DELETE' })
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (id === conversationId) {
        handleNewConversation()
      }
    } catch {
      // Silently fail
    }
  }

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await fetch(`/api/assistant/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
      )
    } catch {
      // Silently fail
    }
  }

  const handlePinConversation = async (id: string, pinned: boolean) => {
    try {
      await fetch(`/api/assistant/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      })
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pinned } : c)),
      )
    } catch {
      // Silently fail
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming && !loadingMessages

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen">
      {/* Mobile backdrop for conversation panel */}
      {showPanel && (
        <div
          className="fixed inset-0 z-30 bg-background/60 md:hidden"
          onClick={() => setShowPanel(false)}
        />
      )}

      {/* Conversation panel */}
      {showPanel && (
        <ConversationPanel
          conversations={conversations}
          activeId={conversationId}
          loading={loadingConversations}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          onRename={handleRenameConversation}
          onPin={handlePinConversation}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* Chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border-default bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            {!showPanel && (
              <button
                onClick={() => setShowPanel(true)}
                className="mr-1 rounded-md p-1.5 text-text-muted hover:text-text-secondary hover:bg-elevated/50 transition-colors"
                title="Show conversations"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </button>
            )}
            <AssistantAvatar />
            <div>
              <h1 className="font-display text-lg font-semibold text-text-primary">
                Detective Partner
              </h1>
              <p className="text-xs text-text-muted">
                AI investigator with database access &amp; platform advisory
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewConversation}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              New conversation
            </button>
          )}
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Spinner />
                <span>Loading conversation...</span>
              </div>
            </div>
          ) : isEmpty ? (
            <WelcomePanel onSuggestion={handleSuggestion} />
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.dbId ?? `msg-${i}`}
                  message={msg}
                  onApprove={handleApprove}
                  onDismiss={handleDismiss}
                />
              ))}

              {/* Streaming state */}
              {isStreaming && (
                <div className="flex gap-3">
                  <div className="shrink-0 mt-1">
                    <AssistantAvatar size="sm" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    {activeToolCalls.map((tc) => (
                      <ToolCallBlock
                        key={tc.id}
                        toolCall={tc}
                        onApprove={handleApprove}
                        onDismiss={handleDismiss}
                      />
                    ))}

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
    </div>
  )
}

// ─── Conversation Panel ──────────────────────────────────

interface ConversationPanelProps {
  conversations: ConversationSummary[]
  activeId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onPin: (id: string, pinned: boolean) => void
  onClose: () => void
}

function ConversationPanel({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onPin,
  onClose,
}: ConversationPanelProps) {
  // Group conversations
  const pinned = conversations.filter((c) => c.pinned)
  const unpinned = conversations.filter((c) => !c.pinned)

  const groups: { label: string; items: ConversationSummary[] }[] = []
  if (pinned.length > 0) {
    groups.push({ label: 'Pinned', items: pinned })
  }

  const grouped: Record<string, ConversationSummary[]> = {}
  for (const c of unpinned) {
    const group = timeGroup(c.updated_at)
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(c)
  }
  const ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older']
  for (const label of ORDER) {
    if (grouped[label]) {
      groups.push({ label, items: grouped[label] })
    }
  }

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-[280px] flex flex-col border-r border-border-default bg-surface md:relative md:inset-auto md:z-auto md:shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-muted hover:text-text-secondary hover:bg-elevated/50 transition-colors"
          title="Hide panel"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
      </div>

      {/* New conversation button */}
      <div className="px-3 py-2">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary hover:bg-elevated/50 hover:border-info/30 transition-colors"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-text-muted">
            No conversations yet.
            <br />
            Start a new one above.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-2 py-1.5 text-[10px] font-medium text-text-muted/60 uppercase tracking-wider">
                {group.label}
              </p>
              {group.items.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeId}
                  onSelect={() => onSelect(conv.id)}
                  onDelete={() => onDelete(conv.id)}
                  onRename={(title) => onRename(conv.id, title)}
                  onPin={() => onPin(conv.id, !conv.pinned)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Conversation Item ──────────────────────────────────

interface ConversationItemProps {
  conversation: ConversationSummary
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onPin: () => void
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onPin,
}: ConversationItemProps) {
  const [showActions, setShowActions] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(
    conversation.title ?? 'Untitled',
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [isRenaming])

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed)
    }
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <div className="rounded-md px-2 py-1.5">
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            if (e.key === 'Escape') setIsRenaming(false)
          }}
          className="w-full rounded border border-info/50 bg-elevated px-2 py-1 text-xs text-text-primary focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div
      className={`group relative flex items-center rounded-md transition-colors ${
        isActive
          ? 'bg-elevated border-l-2 border-info'
          : 'hover:bg-elevated/50'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false)
        setConfirmDelete(false)
      }}
    >
      <button
        onClick={onSelect}
        className={`flex-1 min-w-0 px-3 py-2 text-left ${isActive ? 'pl-2.5' : ''}`}
      >
        <p className="truncate text-xs font-medium text-text-secondary">
          {conversation.pinned && (
            <span className="mr-1 text-info/60" title="Pinned">
              //
            </span>
          )}
          {conversation.title ?? 'Untitled'}
        </p>
        <p className="text-[10px] text-text-muted/60 mt-0.5">
          {relativeTime(conversation.updated_at)}
          {conversation.message_count > 0 && (
            <span className="ml-2">
              {conversation.message_count} msg{conversation.message_count !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </button>

      {/* Action buttons (shown on hover) */}
      {showActions && !confirmDelete && (
        <div className="flex items-center gap-0.5 pr-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPin()
            }}
            className="rounded p-1 text-text-muted/60 hover:text-text-secondary transition-colors"
            title={conversation.pinned ? 'Unpin' : 'Pin'}
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill={conversation.pinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 4.478v5.921a.75.75 0 01-.22.53l-4.72 4.72a2.25 2.25 0 01-2.56.434l-1.5-.75-3.22 3.22m8.22-8.22V4.478A2.25 2.25 0 0114.75 2.25h-5.5A2.25 2.25 0 007 4.478v5.922a.75.75 0 01-.22.53l-.78.78"
              />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsRenaming(true)
            }}
            className="rounded p-1 text-text-muted/60 hover:text-text-secondary transition-colors"
            title="Rename"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
              />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDelete(true)
            }}
            className="rounded p-1 text-text-muted/60 hover:text-critical transition-colors"
            title="Delete"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center gap-1 pr-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
              setConfirmDelete(false)
            }}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-critical bg-critical/10 hover:bg-critical/20 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDelete(false)
            }}
            className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Welcome Panel ─────────────────────────────────────────

const SUGGESTED_QUERIES = [
  {
    title: 'Follow the Money',
    query:
      'Help me trace the financial infrastructure. What shell companies, financial institutions, and money flows do we have documented? What are we missing?',
    icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33',
  },
  {
    title: 'Leon Black Case',
    query:
      'Walk me through the Leon Black prosecution failure. What connections exist, what evidence do we have, and what theories should we explore?',
    icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.257m0 0l4.5 4.5',
  },
  {
    title: 'Protection Apparatus',
    query:
      'Who enabled the cover-up? Map out the protection apparatus — the NPA, prosecutorial failures, and institutional actors who looked the other way.',
    icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  },
  {
    title: 'Blind Spots',
    query:
      'What are the biggest gaps in our investigation? Which entities need more research? What patterns might we be missing?',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z',
  },
  {
    title: 'Platform Strategy',
    query:
      "What should this platform be tracking that it currently isn't? What tools would make this investigation more effective?",
    icon: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
  },
  {
    title: 'Redaction Analysis',
    query:
      "Let's analyze redaction patterns. Which documents have suspicious Category C or D redactions? What might they be hiding?",
    icon: 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88',
  },
]

function WelcomePanel({
  onSuggestion,
}: {
  onSuggestion: (query: string) => void
}) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        {/* Welcome header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-info/10 mb-4">
            <AssistantAvatar size="lg" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">
            Detective Partner
          </h2>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Your AI investigative partner. I can search the database, develop
            theories, suggest connections, and help shape the platform.
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={sq.icon}
                />
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

interface MessageBubbleProps {
  message: ChatMessage
  onApprove: (tc: ToolCall) => void
  onDismiss: (tc: ToolCall) => void
}

function MessageBubble({ message, onApprove, onDismiss }: MessageBubbleProps) {
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
        {message.toolCalls?.map((tc) => (
          <ToolCallBlock
            key={tc.id}
            toolCall={tc}
            onApprove={onApprove}
            onDismiss={onDismiss}
          />
        ))}

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
  get_platform_context: 'Reading platform context',
  suggest_connection: 'Suggesting connection',
  suggest_tier_change: 'Suggesting tier change',
  suggest_evidence_item: 'Suggesting evidence',
  suggest_platform_improvement: 'Suggesting improvement',
}

interface ToolCallBlockProps {
  toolCall: ToolCall
  onApprove: (tc: ToolCall) => void
  onDismiss: (tc: ToolCall) => void
}

function ToolCallBlock({
  toolCall,
  onApprove,
  onDismiss,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name

  const paramEntries = Object.entries(toolCall.input).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  )

  const hasSuggestion =
    toolCall.suggestion && toolCall.suggestionStatus !== 'dismissed'

  return (
    <div className="space-y-2">
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

          {paramEntries.length > 0 && (
            <span className="text-text-muted/60 truncate">
              (
              {paramEntries
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(', ')}
              )
            </span>
          )}

          <svg
            className={`ml-auto h-3 w-3 text-text-muted shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border-default">
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

            {toolCall.result && !toolCall.suggestion && (
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

      {/* Suggestion card */}
      {hasSuggestion && (
        <SuggestionCard
          toolCall={toolCall}
          onApprove={() => onApprove(toolCall)}
          onDismiss={() => onDismiss(toolCall)}
        />
      )}
    </div>
  )
}

// ─── Suggestion Card ──────────────────────────────────────

interface SuggestionCardProps {
  toolCall: ToolCall
  onApprove: () => void
  onDismiss: () => void
}

function SuggestionCard({
  toolCall,
  onApprove,
  onDismiss,
}: SuggestionCardProps) {
  const suggestion = toolCall.suggestion!
  const status = toolCall.suggestionStatus

  if (status === 'applied') {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success flex items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0"
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
        <span>
          {suggestion.type === 'platform' ? 'Saved to backlog' : 'Applied'} —{' '}
          {suggestion.summary}
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/5 px-4 py-3">
        <p className="text-sm text-critical mb-2">
          Failed: {toolCall.applyError}
        </p>
        <p className="text-xs text-text-muted">{suggestion.summary}</p>
      </div>
    )
  }

  const isApplying = status === 'applying'

  switch (suggestion.type) {
    case 'connection':
      return (
        <ConnectionCard
          suggestion={suggestion}
          isApplying={isApplying}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      )
    case 'tier_change':
      return (
        <TierChangeCard
          suggestion={suggestion}
          isApplying={isApplying}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      )
    case 'evidence':
      return (
        <EvidenceCard
          suggestion={suggestion}
          isApplying={isApplying}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      )
    case 'platform':
      return (
        <PlatformCard
          suggestion={suggestion}
          isApplying={isApplying}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      )
  }
}

// ─── Card Variants ─────────────────────────────────────────

interface CardProps {
  suggestion: Suggestion
  isApplying: boolean
  onApprove: () => void
  onDismiss: () => void
}

function ConnectionCard({
  suggestion,
  isApplying,
  onApprove,
  onDismiss,
}: CardProps) {
  const ctx = suggestion.context
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-info uppercase tracking-wider">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.257m0 0l4.5 4.5"
            />
          </svg>
          New Connection
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm mb-2">
        <span className="font-medium text-text-primary">
          {ctx.entity_a_name as string}
        </span>
        <TierBadge tier={ctx.entity_a_tier as number} />
        <span className="text-text-muted mx-1">&rarr;</span>
        <span className="font-mono text-xs text-info">
          {suggestion.data.relationship_type as string}
        </span>
        <span className="text-text-muted mx-1">&rarr;</span>
        <span className="font-medium text-text-primary">
          {ctx.entity_b_name as string}
        </span>
        <TierBadge tier={ctx.entity_b_tier as number} />
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
        <span>
          Strength:{' '}
          <span className="text-text-secondary">
            {suggestion.data.evidence_strength as string}
          </span>
        </span>
      </div>

      <p className="text-xs text-text-secondary mb-3">
        {suggestion.data.description as string}
      </p>

      <CardActions
        isApplying={isApplying}
        onApprove={onApprove}
        onDismiss={onDismiss}
        approveLabel="Approve"
      />
    </div>
  )
}

function TierChangeCard({
  suggestion,
  isApplying,
  onApprove,
  onDismiss,
}: CardProps) {
  const ctx = suggestion.context
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-warning uppercase tracking-wider mb-3">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5M16.5 18V4.5"
          />
        </svg>
        Tier Change
      </div>

      <div className="flex items-center gap-3 text-sm mb-2">
        <span className="font-medium text-text-primary">
          {ctx.entity_name as string}
        </span>
        <TierBadge tier={ctx.current_tier as number} />
        <span className="text-text-muted">&rarr;</span>
        <TierBadge tier={suggestion.data.new_tier as number} />
        <span className="text-xs text-text-muted">
          ({TIER_LABELS[suggestion.data.new_tier as number] ?? ''})
        </span>
      </div>

      <p className="text-xs text-text-secondary mb-3">
        {suggestion.data.justification as string}
      </p>

      {Boolean(ctx.current_justification) && (
        <p className="text-xs text-text-muted mb-3 italic">
          Current: {ctx.current_justification as string}
        </p>
      )}

      <CardActions
        isApplying={isApplying}
        onApprove={onApprove}
        onDismiss={onDismiss}
        approveLabel="Approve"
      />
    </div>
  )
}

function EvidenceCard({
  suggestion,
  isApplying,
  onApprove,
  onDismiss,
}: CardProps) {
  const ctx = suggestion.context
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-400 uppercase tracking-wider mb-3">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        New Evidence
      </div>

      <div className="flex items-center gap-2 text-sm mb-2">
        <span className="font-medium text-text-primary">
          {ctx.entity_name as string}
        </span>
        <TierBadge tier={ctx.entity_tier as number} />
      </div>

      {Boolean(ctx.document_bates) && (
        <p className="text-xs text-text-muted mb-1 font-mono">
          Source: {ctx.document_bates as string}
          {ctx.document_title ? ` — ${ctx.document_title as string}` : ''}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
        <span>
          Type:{' '}
          <span className="text-text-secondary">
            {suggestion.data.evidence_type as string}
          </span>
        </span>
        <span>
          Category:{' '}
          <span className="text-text-secondary">
            {suggestion.data.category as string}
          </span>
        </span>
        <span>
          Strength:{' '}
          <span className="text-text-secondary">
            {suggestion.data.strength as string}
          </span>
        </span>
      </div>

      <p className="text-xs text-text-secondary mb-3">
        {suggestion.data.description as string}
      </p>

      <CardActions
        isApplying={isApplying}
        onApprove={onApprove}
        onDismiss={onDismiss}
        approveLabel="Approve"
      />
    </div>
  )
}

function PlatformCard({
  suggestion,
  isApplying,
  onApprove,
  onDismiss,
}: CardProps) {
  const ctx = suggestion.context
  const categoryLabel =
    CATEGORY_LABELS[ctx.category as string] ?? (ctx.category as string)
  const priorityCls =
    PRIORITY_COLORS[ctx.priority as string] ??
    'bg-gray-500/20 text-gray-400 border-gray-500/30'

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-violet-400 uppercase tracking-wider">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
            />
          </svg>
          Platform Improvement
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-medium text-violet-400">
            {categoryLabel}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityCls}`}
          >
            {ctx.priority as string}
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-text-primary mb-2">
        {suggestion.data.title as string}
      </p>
      <p className="text-xs text-text-secondary mb-2">
        {suggestion.data.description as string}
      </p>
      <p className="text-xs text-text-muted italic mb-3">
        Rationale: {suggestion.data.rationale as string}
      </p>

      <CardActions
        isApplying={isApplying}
        onApprove={onApprove}
        onDismiss={onDismiss}
        approveLabel="Save to Backlog"
      />
    </div>
  )
}

function CardActions({
  isApplying,
  onApprove,
  onDismiss,
  approveLabel,
}: {
  isApplying: boolean
  onApprove: () => void
  onDismiss: () => void
  approveLabel: string
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onApprove}
        disabled={isApplying}
        className="flex items-center gap-1.5 rounded-md bg-success/10 border border-success/30 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        {isApplying ? (
          <>
            <Spinner />
            Applying...
          </>
        ) : (
          approveLabel
        )}
      </button>
      <button
        onClick={onDismiss}
        disabled={isApplying}
        className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-elevated/50 transition-colors disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  )
}

// ─── Small Components ──────────────────────────────────────

function AssistantAvatar({
  size = 'md',
}: {
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  const iconClass =
    size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

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
