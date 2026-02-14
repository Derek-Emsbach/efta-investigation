import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { ASSISTANT_TOOLS, executeTool } from '@/lib/ai/tools'
import {
  createUsageAccumulator,
  accumulateUsage,
  logApiUsage,
  type UsageAccumulator,
} from '@/lib/ai/usage-tracker'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  // Admin-only auth check
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env.local file.',
      }),
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
        await runConversation(messages, supabase, send, usageAcc)
        send('done', {})
      } catch (error) {
        errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred'
        send('error', { message: errorMsg })
      } finally {
        logApiUsage({
          endpoint: '/api/assistant',
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

async function runConversation(
  chatMessages: ChatMessage[],
  supabase: Awaited<ReturnType<typeof createClient>>,
  send: (event: string, data: unknown) => void,
  usageAcc: UsageAccumulator,
): Promise<void> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
  })

  // Build API messages from chat history
  const apiMessages: Anthropic.MessageParam[] = chatMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const MAX_TOOL_ITERATIONS = 8

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // Stream Claude's response
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: apiMessages,
      tools: ASSISTANT_TOOLS,
    })

    // Collect content blocks for tool use handling
    const contentBlocks: Anthropic.ContentBlock[] = []

    // Stream text deltas to client in real-time
    stream.on('text', (text) => {
      send('text', { content: text })
    })

    // Track content blocks
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

    // Wait for stream to complete
    const finalMessage = await stream.finalMessage()
    accumulateUsage(usageAcc, finalMessage.usage)

    // If no tool use, we're done
    if (finalMessage.stop_reason !== 'tool_use') {
      break
    }

    // Claude wants to use tools — execute them
    apiMessages.push({
      role: 'assistant',
      content: finalMessage.content,
    })

    // Execute each tool_use block
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

    // Add tool results and loop for next Claude response
    apiMessages.push({
      role: 'user',
      content: toolResults,
    })
  }
}
