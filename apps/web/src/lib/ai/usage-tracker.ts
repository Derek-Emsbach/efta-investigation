import { createClient } from '@/lib/supabase/server'

/** Mutable accumulator passed into conversation runners. */
export interface UsageAccumulator {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  toolIterations: number
}

export function createUsageAccumulator(): UsageAccumulator {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    toolIterations: 0,
  }
}

/**
 * Add usage from one Anthropic finalMessage to the accumulator.
 * Call this after each `stream.finalMessage()` in the tool loop.
 */
export function accumulateUsage(
  acc: UsageAccumulator,
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number | null
    cache_read_input_tokens?: number | null
  },
) {
  acc.inputTokens += usage.input_tokens
  acc.outputTokens += usage.output_tokens
  acc.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0
  acc.cacheReadTokens += usage.cache_read_input_tokens ?? 0
  acc.toolIterations += 1
}

/** Write the accumulated usage to the api_usage_log table. */
export async function logApiUsage(params: {
  endpoint: string
  model: string
  usage: UsageAccumulator
  userId?: string
  durationMs: number
  error?: string
}) {
  try {
    const supabase = await createClient()

    const totalTokens =
      params.usage.inputTokens +
      params.usage.outputTokens +
      params.usage.cacheCreationTokens +
      params.usage.cacheReadTokens

    await supabase.from('api_usage_log').insert({
      endpoint: params.endpoint,
      model: params.model,
      input_tokens: params.usage.inputTokens,
      output_tokens: params.usage.outputTokens,
      cache_creation_tokens: params.usage.cacheCreationTokens,
      cache_read_tokens: params.usage.cacheReadTokens,
      total_tokens: totalTokens,
      tool_iterations: params.usage.toolIterations,
      user_id: params.userId ?? null,
      duration_ms: params.durationMs,
      error: params.error ?? null,
    })
  } catch (err) {
    // Never let logging failures break the AI response
    console.error('Failed to log API usage:', err)
  }
}
