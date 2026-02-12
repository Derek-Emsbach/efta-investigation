import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  buildArcherStaticPrompt,
  buildArcherDocumentContext,
  type ArcherDocument,
} from '@/lib/ai/archer-prompt'
import { ASSISTANT_TOOLS, executeTool } from '@/lib/ai/tools'

export const maxDuration = 60

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

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      try {
        await runArcherConversation(messages, document, supabase, send)
        send('done', {})
      } catch (error) {
        send('error', {
          message:
            error instanceof Error ? error.message : 'An unexpected error occurred',
        })
      } finally {
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
): Promise<void> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
  })

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
      text: buildArcherDocumentContext(document),
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
