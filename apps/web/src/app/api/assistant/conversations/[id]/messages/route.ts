import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

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

  const body = (await request.json()) as {
    role: 'user' | 'assistant'
    content: string
    tool_calls?: unknown[]
  }

  if (!body.role || body.content === undefined) {
    return NextResponse.json({ error: 'Missing role or content' }, { status: 400 })
  }

  // Insert message
  const { data: message, error: msgError } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: id,
      role: body.role,
      content: body.content,
      tool_calls: body.tool_calls ?? null,
    })
    .select('id')
    .single()

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  // Touch conversation's updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ id: message.id })
}
