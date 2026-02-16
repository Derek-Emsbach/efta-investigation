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
import type { Annotation } from '@/components/review/pdf-viewer'
import type { ArcherDocument } from '@/lib/ai/archer-prompt'

// ─── Types ──────────────────────────────────────────────

interface Suggestion {
  type: 'connection' | 'tier_change' | 'evidence' | 'new_entity' | 'event' | 'entity_document_link'
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
  dbId?: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

// ─── Constants ──────────────────────────────────────────

const DEFAULT_PROMPT =
  'Give me your first impression of this document — what type is it, what\'s the general subject, and what stands out? Then list the analysis sections I can explore with you.'

const QUICK_ACTIONS = [
  {
    label: 'First impression',
    description: 'Type, subject, and standout details',
    prompt: DEFAULT_PROMPT,
  },
  {
    label: 'Who is mentioned?',
    description: 'Identify every person, org, and entity',
    prompt: 'Identify every person, organization, and entity mentioned in this document. For each, tell me if they exist in our database and what tier they are. Highlight them in the PDF.',
  },
  {
    label: "What's significant?",
    description: 'Key evidence, dates, and amounts',
    prompt: 'What is the most significant content in this document for our investigation? Highlight key passages, quotes, dates, and financial amounts.',
  },
  {
    label: 'Redaction analysis',
    description: 'Flag suspicious Category C/D redactions',
    prompt: 'Analyze the redaction patterns in this document. Which redactions look like Category C (institutional protection) or Category D (perpetrator protection)? Who might be protected?',
  },
  {
    label: 'Cross-references',
    description: 'Match against existing database records',
    prompt: 'Cross-reference the entities and events in this document against our database. What connections exist? What connections are missing that should exist?',
  },
  {
    label: 'Propose theories',
    description: 'Investigative hypotheses from patterns',
    prompt: 'Based on what you see in this document, propose investigative theories. What patterns emerge? What new investigation threads does this suggest?',
  },
  {
    label: 'Recommend action',
    description: 'Should I approve, flag, or reject?',
    prompt: 'Based on your analysis, should I approve, flag, or reject this document? What severity and classification would you assign? Explain your reasoning.',
  },
  {
    label: 'Catalog all entities',
    description: 'Create/link every entity in this doc',
    prompt: 'Search for every person, organization, and entity mentioned in this document. For each one: if they already exist in our database, propose linking them to this document using suggest_entity_document_link. If they do NOT exist, propose creating them using suggest_new_entity with an appropriate tier, category, and this document\'s bates number. Do them all — I\'ll approve each one.',
  },
]

const TIER_COLORS: Record<number, string> = {
  1: 'bg-critical/20 text-critical border-critical/30',
  2: 'bg-warning/20 text-warning border-warning/30',
  3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  4: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  5: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  6: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const TOOL_LABELS: Record<string, string> = {
  search_entities: 'Searching entities',
  search_documents: 'Searching documents',
  search_events: 'Searching events',
  get_entity_profile: 'Loading entity profile',
  get_document_detail: 'Loading document detail',
  get_document_text: 'Reading document text',
  query_connections: 'Querying connections',
  cross_reference: 'Cross-referencing',
  suggest_connection: 'Proposing connection',
  suggest_tier_change: 'Proposing tier change',
  suggest_evidence_item: 'Proposing evidence item',
  suggest_new_entity: 'Creating entity',
  suggest_event: 'Creating event',
  suggest_entity_document_link: 'Linking entity to document',
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

// ─── Annotation Parsing ──────────────────────────────────

const ANNOTATION_REGEX = /<!--ANNOTATION:(.*?)-->/g

function extractAnnotations(text: string): {
  cleanText: string
  annotations: Annotation[]
} {
  const annotations: Annotation[] = []
  const cleanText = text.replace(ANNOTATION_REGEX, (_, json: string) => {
    try {
      const parsed = JSON.parse(json) as Annotation
      annotations.push(parsed)
    } catch {
      // Invalid JSON, skip
    }
    return ''
  })
  return { cleanText, annotations }
}

// ─── Props ──────────────────────────────────────────────

interface ArcherPanelProps {
  document: ArcherDocument | null
  onAnnotationsChange: (annotations: Annotation[]) => void
  onNavigate: (page: number) => void
}

export default function ArcherPanel({
  document,
  onAnnotationsChange,
  onNavigate,
}: ArcherPanelProps) {
  // ─── State ──────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const conversationIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const allAnnotationsRef = useRef<Annotation[]>([])
  const autoAnalysisTriggered = useRef<string | null>(null)
  const documentIdRef = useRef<string | null>(null)

  // ─── Scroll to bottom on new messages ──────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, activeToolCalls])

  // ─── Process annotations from streaming content ────
  useEffect(() => {
    if (!streamingContent) return
    const { annotations } = extractAnnotations(streamingContent)
    if (annotations.length > 0) {
      const existing = allAnnotationsRef.current
      const merged = [...existing]
      for (const a of annotations) {
        const isDuplicate = existing.some(
          (e) => e.text === a.text && e.page === a.page && e.type === a.type,
        )
        if (!isDuplicate) merged.push(a)
      }
      allAnnotationsRef.current = merged
      onAnnotationsChange(merged)

      for (const a of annotations) {
        if (a.type === 'navigate' && a.page) {
          onNavigate(a.page)
        }
      }
    }
  }, [streamingContent, onAnnotationsChange, onNavigate])

  // ─── Reset when document changes ───────────────────
  useEffect(() => {
    if (document?.id === documentIdRef.current) return
    documentIdRef.current = document?.id ?? null

    setMessages([])
    setInput('')
    setIsStreaming(false)
    setStreamingContent('')
    setActiveToolCalls([])
    setConversationId(null)
    conversationIdRef.current = null
    setError(null)
    allAnnotationsRef.current = []
    onAnnotationsChange([])
    abortRef.current?.abort()
    abortRef.current = null

    if (!document) return
    loadDocumentConversation(document.id)
  }, [document?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pre-fill default prompt on first view (no auto-send) ──
  useEffect(() => {
    if (
      !document ||
      isStreaming ||
      messages.length > 0 ||
      autoAnalysisTriggered.current === document.id
    ) {
      return
    }

    if (conversationId) return

    autoAnalysisTriggered.current = document.id
    setInput(DEFAULT_PROMPT)
  }, [document, messages.length, conversationId, isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load existing conversation for document ───────

  async function loadDocumentConversation(docId: string) {
    try {
      const res = await fetch(
        `/api/assistant/conversations?document_id=${docId}`,
      )
      if (!res.ok) return

      const data = await res.json()
      const conversations = data.conversations ?? []

      if (conversations.length > 0) {
        const conv = conversations[0]
        setConversationId(conv.id)
        conversationIdRef.current = conv.id
        autoAnalysisTriggered.current = docId

        const msgRes = await fetch(
          `/api/assistant/conversations/${conv.id}/messages`,
        )
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          const loaded: ChatMessage[] = (msgData.messages ?? []).map(
            (m: { id: string; role: 'user' | 'assistant'; content: string; tool_calls?: ToolCall[] }) => ({
              dbId: m.id,
              role: m.role,
              content: m.content,
              toolCalls: m.tool_calls,
            }),
          )
          setMessages(loaded)

          const allAnnotations: Annotation[] = []
          for (const msg of loaded) {
            if (msg.role === 'assistant' && msg.content) {
              const { annotations } = extractAnnotations(msg.content)
              allAnnotations.push(...annotations)
            }
          }
          allAnnotationsRef.current = allAnnotations
          onAnnotationsChange(allAnnotations)
        }
      }
    } catch {
      // Silently fail — user can still chat
    }
  }

  // ─── Save message to DB ────────────────────────────

  const saveMessage = useCallback(
    async (
      convId: string,
      msg: { role: string; content: string; tool_calls?: ToolCall[] },
    ): Promise<string | null> => {
      try {
        const res = await fetch(
          `/api/assistant/conversations/${convId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg),
          },
        )
        if (res.ok) {
          const data = await res.json()
          return data.id as string
        }
      } catch {
        // Silently fail
      }
      return null
    },
    [],
  )

  // ─── Update tool call in messages ──────────────────

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

  // ─── Persist tool call update ──────────────────────

  const persistToolCallUpdate = useCallback(
    async (toolCallId: string, updates: Partial<ToolCall>) => {
      const convId = conversationIdRef.current
      if (!convId) return

      setMessages((prev) => {
        const msg = prev.find((m) =>
          m.toolCalls?.some((tc) => tc.id === toolCallId),
        )
        if (!msg?.dbId || !msg.toolCalls) return prev

        const updatedToolCalls = msg.toolCalls.map((tc) =>
          tc.id === toolCallId ? { ...tc, ...updates } : tc,
        )

        fetch(
          `/api/assistant/conversations/${convId}/messages/${msg.dbId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_calls: updatedToolCalls }),
          },
        ).catch(() => {})

        return prev
      })
    },
    [],
  )

  // ─── Handle approve suggestion ─────────────────────

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

  // ─── Handle dismiss suggestion ─────────────────────

  const handleDismiss = useCallback(
    (toolCall: ToolCall) => {
      const updates = { suggestionStatus: 'dismissed' as const }
      updateToolCallInMessages(toolCall.id, updates)
      persistToolCallUpdate(toolCall.id, updates)
    },
    [updateToolCallInMessages, persistToolCallUpdate],
  )

  // ─── Send message ─────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming || !document) return

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

      let convId = conversationIdRef.current

      try {
        if (!convId) {
          const createRes = await fetch('/api/assistant/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Archer: ${document.bates_number ?? document.title ?? 'Document review'}`,
              document_id: document.id,
            }),
          })
          if (createRes.ok) {
            const created = await createRes.json()
            convId = created.id as string
            setConversationId(convId)
            conversationIdRef.current = convId
          }
        }

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

        const response = await fetch('/api/review/archer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            document,
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
          const { cleanText, annotations } = extractAnnotations(accumulatedText)

          const merged = [...allAnnotationsRef.current]
          for (const a of annotations) {
            const isDuplicate = merged.some(
              (e) => e.text === a.text && e.page === a.page && e.type === a.type,
            )
            if (!isDuplicate) merged.push(a)
          }
          allAnnotationsRef.current = merged
          onAnnotationsChange(merged)

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: cleanText,
            toolCalls:
              accumulatedToolCalls.length > 0
                ? accumulatedToolCalls
                : undefined,
          }

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
    [messages, isStreaming, document, saveMessage, onAnnotationsChange, onNavigate], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ─── Event handlers ───────────────────────────────

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

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleClear = () => {
    setMessages([])
    setConversationId(null)
    conversationIdRef.current = null
    setError(null)
    allAnnotationsRef.current = []
    onAnnotationsChange([])
    autoAnalysisTriggered.current = null
  }

  // ─── Empty state — no document selected ────────────

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <svg
            className="mx-auto h-10 w-10 text-text-muted/40 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-sm text-text-muted">Select a document to start reviewing with Archer.</p>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex h-full min-w-0 w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-info"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
          </svg>
          <span className="text-xs font-semibold text-text-primary">Archer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted truncate max-w-[120px]">
            {document.bates_number ?? 'Document'}
          </span>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4">
        {isEmpty ? (
          /* Welcome state with quick action cards */
          <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-4">
              <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-info"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                  <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs text-text-secondary mb-0.5">
                  Ask Archer to analyze this document
                </p>
                <p className="text-[10px] text-text-muted">
                  Send the default prompt or choose an analysis below
                </p>
              </div>
            </div>

            {/* Quick action cards — 2-column grid */}
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
                  <p className="text-[10px] text-text-muted mt-0.5 leading-snug">
                    {action.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
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
              <div className="space-y-2">
                {activeToolCalls.map((tc) => (
                  <ToolCallBlock key={tc.id} toolCall={tc} />
                ))}

                {streamingContent ? (
                  <div className="archer-markdown break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {extractAnnotations(streamingContent).cleanText}
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

            {/* Error */}
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
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Archer about this document..."
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
              onClick={handleStop}
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
        <div className="max-w-[85%] rounded-lg bg-info/10 px-3 py-2 text-xs text-text-primary leading-relaxed break-words">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Tool calls */}
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

      {/* Text content — rendered as markdown */}
      {message.content && (
        <div className="archer-markdown break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
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
    new_entity: 'New Entity',
    event: 'Timeline Event',
    entity_document_link: 'Document Link',
  }

  const typeColors: Record<string, string> = {
    connection: 'border-info/30 bg-info/5',
    tier_change: 'border-warning/30 bg-warning/5',
    evidence: 'border-success/30 bg-success/5',
    new_entity: 'border-violet-500/30 bg-violet-500/5',
    event: 'border-amber-500/30 bg-amber-500/5',
    entity_document_link: 'border-cyan-500/30 bg-cyan-500/5',
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

  // Pending — show approve/dismiss buttons
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
          {/* Tier badge for tier_change */}
          {suggestion.type === 'tier_change' && typeof suggestion.data.new_tier === 'number' ? (
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                TIER_COLORS[suggestion.data.new_tier as number] ??
                'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}
            >
              {'T' + String(suggestion.data.new_tier)}
            </span>
          ) : null}
          {/* Entity metadata for new_entity */}
          {suggestion.type === 'new_entity' ? (() => {
            const tier = Number(suggestion.data.tier)
            return (
              <div className="flex items-center gap-1.5 mt-1">
                {!isNaN(tier) && (
                  <span
                    className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                      TIER_COLORS[tier] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}
                  >
                    {'T' + String(tier)}
                  </span>
                )}
                {suggestion.data.entity_type ? (
                  <span className="text-[10px] text-text-muted">
                    {String(suggestion.data.entity_type)}
                  </span>
                ) : null}
                {suggestion.data.category ? (
                  <span className="text-[10px] text-text-muted">
                    {String(suggestion.data.category).replace(/_/g, ' ')}
                  </span>
                ) : null}
              </div>
            )
          })() : null}
          {/* Event date */}
          {suggestion.type === 'event' && suggestion.context.date ? (
            <span className="mt-1 inline-flex text-[10px] font-mono text-text-muted">
              {String(suggestion.context.date)}
            </span>
          ) : null}
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
