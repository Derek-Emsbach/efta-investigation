import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  buildEntityInvestigateStaticPrompt,
  buildEntityInvestigateContext,
  type EntityInvestigateContext,
} from '@/lib/ai/entity-investigate-prompt'
import { ASSISTANT_TOOLS, executeTool } from '@/lib/ai/tools'
import type { Entity, EntityConnection, Tier } from '@efta/shared'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Entity investigation uses most tools except platform-meta
const INVESTIGATE_TOOLS = ASSISTANT_TOOLS.filter(
  (t) => t.name !== 'get_platform_context' && t.name !== 'suggest_platform_improvement',
)

const MAX_HISTORY_MESSAGES = 10

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      JSON.stringify({ error: 'Anthropic API key not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { messages }: { messages: ChatMessage[] } = await request.json()

  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No messages provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Fetch entity data for context
  const [entityResult, connectionsAsA, connectionsAsB, docCount, evidenceCount, eventCount] =
    await Promise.all([
      supabase.from('entities').select('*').eq('id', id).single(),
      supabase
        .from('entity_connections')
        .select('*, connected_entity:entities!entity_b(name, tier)')
        .eq('entity_a', id),
      supabase
        .from('entity_connections')
        .select('*, connected_entity:entities!entity_a(name, tier)')
        .eq('entity_b', id),
      supabase.from('entity_documents').select('*', { count: 'exact', head: true }).eq('entity_id', id),
      supabase.from('evidence_items').select('*', { count: 'exact', head: true }).eq('entity_id', id),
      supabase.from('entity_events').select('*', { count: 'exact', head: true }).eq('entity_id', id),
    ])

  if (entityResult.error || !entityResult.data) {
    return new Response(
      JSON.stringify({ error: 'Entity not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const entity = entityResult.data as Entity
  const allConnections = [
    ...((connectionsAsA.data ?? []) as (EntityConnection & { connected_entity: { name: string; tier: Tier | null } })[]),
    ...((connectionsAsB.data ?? []) as (EntityConnection & { connected_entity: { name: string; tier: Tier | null } })[]),
  ]

  const entityContext: EntityInvestigateContext = {
    entity,
    connections: allConnections.map((c) => ({
      connected_entity_name: c.connected_entity.name,
      connected_entity_tier: c.connected_entity.tier,
      relationship_type: c.relationship_type,
      evidence_strength: c.evidence_strength,
    })),
    documentCount: docCount.count ?? 0,
    evidenceCount: evidenceCount.count ?? 0,
    eventCount: eventCount.count ?? 0,
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
        await runEntityInvestigation(messages, entityContext, supabase, send)
        send('done', {})
      } catch (error) {
        send('error', {
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
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

async function runEntityInvestigation(
  chatMessages: ChatMessage[],
  entityContext: EntityInvestigateContext,
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (event: string, data: unknown) => void,
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

  // Split system prompt for caching
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: buildEntityInvestigateStaticPrompt(),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text' as const,
      text: buildEntityInvestigateContext(entityContext),
    },
  ]

  const MAX_TOOL_ITERATIONS = 8

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemBlocks,
      messages: apiMessages,
      tools: INVESTIGATE_TOOLS,
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
