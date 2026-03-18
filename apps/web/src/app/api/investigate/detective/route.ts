import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireInvestigator } from '@/lib/supabase/require-investigator'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildInvestigatorSystemPrompt } from '@/lib/ai/investigator-prompt'
import {
  INVESTIGATOR_TOOLS,
  executeInvestigatorTool,
} from '@/lib/ai/investigator-tools'
import {
  createUsageAccumulator,
  accumulateUsage,
  logApiUsage,
  type UsageAccumulator,
} from '@/lib/ai/usage-tracker'
import type { SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(request, {
    tier: 'general',
    isInvestigator: true,
  })
  if (rateLimited) return rateLimited

  // Investigator-only auth check (returns stats for quota enforcement)
  const authResult = await requireInvestigator()
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase, stats } = authResult

  // --- Daily quota enforcement ---
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  let queriesUsed = stats.ai_queries_used_today
  const dailyLimit = stats.ai_queries_daily_limit

  // Reset counter if it's a new day
  if (stats.ai_queries_reset_date !== today) {
    queriesUsed = 0
    await supabase
      .from('investigator_stats')
      .update({
        ai_queries_used_today: 0,
        ai_queries_reset_date: today,
      })
      .eq('user_id', user.id)
  }

  if (queriesUsed >= dailyLimit) {
    return NextResponse.json(
      {
        error: 'Daily AI query limit reached',
        queries_used: queriesUsed,
        daily_limit: dailyLimit,
        resets_at: `${today}T00:00:00Z`,
      },
      { status: 429 },
    )
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI service not configured' },
      { status: 500 },
    )
  }

  const { messages }: { messages: ChatMessage[] } = await request.json()

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: 'No messages provided' },
      { status: 400 },
    )
  }

  // Increment quota counter
  await supabase
    .from('investigator_stats')
    .update({
      ai_queries_used_today: queriesUsed + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  const encoder = new TextEncoder()
  const usageAcc = createUsageAccumulator()
  const startTime = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        )
      }

      // Send quota info as first event
      send('quota', {
        queries_used: queriesUsed + 1,
        daily_limit: dailyLimit,
      })

      let errorMsg: string | undefined
      try {
        await runConversation(messages, supabase, send, usageAcc)
        send('done', {})
      } catch (error) {
        errorMsg =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred'
        send('error', { message: errorMsg })
      } finally {
        logApiUsage({
          endpoint: '/api/investigate/detective',
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
  supabase: SupabaseClient,
  send: (event: string, data: unknown) => void,
  usageAcc: UsageAccumulator,
): Promise<void> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
  })

  const apiMessages: Anthropic.MessageParam[] = chatMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Fewer iterations than admin (5 vs 8) to limit cost per query
  const MAX_TOOL_ITERATIONS = 5

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: buildInvestigatorSystemPrompt(),
      messages: apiMessages,
      tools: INVESTIGATOR_TOOLS,
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
        const result = await executeInvestigatorTool(
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
