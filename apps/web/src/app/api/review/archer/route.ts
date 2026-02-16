import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  buildArcherStaticPrompt,
  buildArcherDocumentContext,
  stripBinaryNoise,
  type ArcherDocument,
} from '@/lib/ai/archer-prompt'
import { ASSISTANT_TOOLS, executeTool } from '@/lib/ai/tools'
import {
  createUsageAccumulator,
  accumulateUsage,
  logApiUsage,
  type UsageAccumulator,
} from '@/lib/ai/usage-tracker'
import { getSignedDownloadUrl } from '@/lib/r2/client'

export const maxDuration = 60

/**
 * Fetch the full extracted text from R2 for a document.
 * The DB only stores a 2000-char preview; full text lives at text/{bates}.txt.
 */
async function fetchFullTextFromR2(batesNumber: string | null): Promise<string | null> {
  if (!batesNumber) return null
  try {
    const r2Key = `text/${batesNumber}.txt`
    const signedUrl = await getSignedDownloadUrl(r2Key, 3600)
    const response = await fetch(signedUrl)
    if (response.ok) {
      return await response.text()
    }
  } catch {
    // R2 fetch failed — fall back to DB preview
  }
  return null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Archer uses most tools but not platform-meta ones
const ARCHER_TOOLS = ASSISTANT_TOOLS.filter(
  (t) => t.name !== 'get_platform_context' && t.name !== 'suggest_platform_improvement',
)

// Keep conversation history manageable — last 10 messages (~5 exchanges)
const MAX_HISTORY_MESSAGES = 10

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env.local file.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { messages, document }: { messages: ChatMessage[]; document: ArcherDocument } =
    await request.json()

  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No messages provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!document?.id) {
    return new Response(
      JSON.stringify({ error: 'No document provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  const usageAcc = createUsageAccumulator()
  const startTime = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      let errorMsg: string | undefined
      try {
        await runArcherConversation(messages, document, supabase, send, usageAcc)
        send('done', {})
      } catch (error) {
        errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred'
        send('error', { message: errorMsg })
      } finally {
        logApiUsage({
          endpoint: '/api/review/archer',
          model: 'claude-sonnet-4-5-20250929',
          usage: usageAcc,
          userId: user.id,
          durationMs: Date.now() - startTime,
          error: errorMsg,
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function runArcherConversation(
  chatMessages: ChatMessage[],
  document: ArcherDocument,
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (event: string, data: unknown) => void,
  usageAcc: UsageAccumulator,
): Promise<void> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
  })

  // Fetch full text from R2 to replace the 2000-char DB preview
  // Strip base64/binary noise (emails with PDF attachments can be 90%+ encoded junk)
  const fullText = await fetchFullTextFromR2(document.bates_number)
  const cleanedText = fullText ? stripBinaryNoise(fullText) : null
  const enrichedDocument: ArcherDocument = cleanedText
    ? { ...document, extracted_text: cleanedText }
    : document

  // Trim conversation history to prevent token bloat
  const trimmedMessages = chatMessages.length > MAX_HISTORY_MESSAGES
    ? chatMessages.slice(-MAX_HISTORY_MESSAGES)
    : chatMessages

  const apiMessages: Anthropic.MessageParam[] = trimmedMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Split system prompt for caching: static part (cacheable) + document context
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: buildArcherStaticPrompt(),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text' as const,
      text: buildArcherDocumentContext(enrichedDocument),
    },
  ]

  const MAX_TOOL_ITERATIONS = 8

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemBlocks,
      messages: apiMessages,
      tools: ARCHER_TOOLS,
    })

    const contentBlocks: Anthropic.ContentBlock[] = []

    stream.on('text', (text) => {
      send('text', { content: text })
    })

    stream.on('contentBlock', (block) => {
      contentBlocks.push(block)
      if (block.type === 'tool_use') {
        send('tool_start', {
          tool_name: block.name,
          tool_input: block.input,
          tool_use_id: block.id,
        })
      }
    })

    const finalMessage = await stream.finalMessage()
    accumulateUsage(usageAcc, finalMessage.usage)

    if (finalMessage.stop_reason !== 'tool_use') {
      break
    }

    apiMessages.push({
      role: 'assistant',
      content: finalMessage.content,
    })

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of contentBlocks) {
      if (block.type === 'tool_use') {
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          supabase,
        )

        send('tool_result', {
          tool_use_id: block.id,
          tool_name: block.name,
          result,
        })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }
    }

    apiMessages.push({
      role: 'user',
      content: toolResults,
    })
  }
}
