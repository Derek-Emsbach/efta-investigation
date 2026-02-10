import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, messageId } = await params

  // Verify conversation belongs to user
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const body = (await request.json()) as { tool_calls: unknown[] }

  if (!body.tool_calls) {
    return NextResponse.json({ error: 'Missing tool_calls' }, { status: 400 })
  }

  // Update the message's tool_calls JSONB
  const { error } = await supabase
    .from('conversation_messages')
    .update({ tool_calls: body.tool_calls })
    .eq('id', messageId)
    .eq('conversation_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
