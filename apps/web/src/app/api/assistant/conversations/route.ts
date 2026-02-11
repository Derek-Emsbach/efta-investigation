import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch conversations with message counts
  let query = supabase
    .from('conversations')
    .select('id, title, pinned, created_at, updated_at')
    .eq('user_id', user.id)

  // Filter by document_id if provided (used by Archer review partner)
  const documentId = request.nextUrl.searchParams.get('document_id')
  if (documentId) {
    query = query.eq('document_id', documentId)
  }

  const { data: conversations, error } = await query
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get message counts per conversation
  const convIds = conversations.map((c) => c.id)
  let messageCounts: Record<string, number> = {}

  if (convIds.length > 0) {
    const { data: counts } = await supabase
      .from('conversation_messages')
      .select('conversation_id')
      .in('conversation_id', convIds)

    if (counts) {
      messageCounts = counts.reduce(
        (acc, row) => {
          acc[row.conversation_id] = (acc[row.conversation_id] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )
    }
  }

  const result = conversations.map((c) => ({
    ...c,
    message_count: messageCounts[c.id] ?? 0,
  }))

  return NextResponse.json({ conversations: result })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, document_id } = (await request.json()) as {
    title?: string
    document_id?: string
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      title: title ?? null,
      ...(document_id ? { document_id } : {}),
    })
    .select('id, title, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
