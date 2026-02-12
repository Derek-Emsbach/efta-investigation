import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  buildInvestigationStaticPrompt,
  buildInvestigationContext,
  type InvestigationContext,
} from '@/lib/ai/investigation-prompt'
import { ASSISTANT_TOOLS, executeTool } from '@/lib/ai/tools'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Investigation Archer uses the same tools as the main assistant
const INVESTIGATION_TOOLS = ASSISTANT_TOOLS.filter(
  (t) =>
    t.name !== 'get_platform_context' &&
    t.name !== 'suggest_platform_improvement'
)

const MAX_HISTORY_MESSAGES = 10

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages }: { messages: ChatMessage[] } = await request.json()

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Load investigation context from database
  const [invResult, entitiesResult, docsResult, eventsResult] =
    await Promise.all([
      supabase.from('investigations').select('*').eq('id', id).single(),
      supabase
        .from('entity_investigations')
        .select('role, entities(name, tier, entity_type)')
        .eq('investigation_id', id),
      supabase
        .from('investigation_documents')
        .select(
          'documents(bates_number, title, document_type, severity)'
        )
        .eq('investigation_id', id),
      supabase
        .from('investigation_events')
        .select('events(title, date, event_type, description)')
        .eq('investigation_id', id),
    ])

  if (invResult.error || !invResult.data) {
    return new Response(
      JSON.stringify({ error: 'Investigation not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const investigation = invResult.data
  const context: InvestigationContext = {
    id: investigation.id,
    name: investigation.name,
    status: investigation.status,
    summary: investigation.summary,
    open_questions: investigation.open_questions ?? [],
    entities: (entitiesResult.data ?? []).map((e) => {
      const entity = e.entities as unknown as {
        name: string
        tier: number | null
        entity_type: string
      }
      return {
        name: entity?.name ?? 'Unknown',
        tier: entity?.tier ?? null,
        entity_type: entity?.entity_type ?? 'unknown',
        role: e.role,
      }
    }),
    documents: (docsResult.data ?? []).map((d) => {
      const doc = d.documents as unknown as {
        bates_number: string | null
        title: string | null
        document_type: string | null
        severity: string | null
      }
      return {
        bates_number: doc?.bates_number ?? null,
        title: doc?.title ?? null,
        document_type: doc?.document_type ?? null,
        severity: doc?.severity ?? null,
      }
    }),
    events: (eventsResult.data ?? []).map((e) => {
      const evt = e.events as unknown as {
        title: string | null
        date: string | null
        event_type: string | null
        description: string | null
      }
      return {
        title: evt?.title ?? null,
        date: evt?.date ?? null,
        event_type: evt?.event_type ?? null,
        description: evt?.description ?? null,
      }
    }),
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          )
        )
      }

      try {
        await runInvestigationChat(messages, context, supabase, send)
        send('done', {})
      } catch (error) {
        send('error', {
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
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

async function runInvestigationChat(
  chatMessages: ChatMessage[],
  context: InvestigationContext,
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (event: string, data: unknown) => void
): Promise<void> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
  })

  const trimmedMessages =
    chatMessages.length > MAX_HISTORY_MESSAGES
      ? chatMessages.slice(-MAX_HISTORY_MESSAGES)
      : chatMessages

  const apiMessages: Anthropic.MessageParam[] = trimmedMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: buildInvestigationStaticPrompt(),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text' as const,
      text: buildInvestigationContext(context),
    },
  ]

  const MAX_TOOL_ITERATIONS = 8

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemBlocks,
      messages: apiMessages,
      tools: INVESTIGATION_TOOLS,
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
          supabase
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
