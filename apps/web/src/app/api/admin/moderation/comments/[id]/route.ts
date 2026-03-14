import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  const { id } = await params
  const body = await request.json()
  const action = body.action as string

  if (action === 'approve') {
    // Reset hidden + flag_count, delete all flags
    await adminSupabase
      .from('comment_flags')
      .delete()
      .eq('comment_id', id)

    const { error } = await adminSupabase
      .from('comments')
      .update({ is_hidden: false, flag_count: 0, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'hide') {
    const { error } = await adminSupabase
      .from('comments')
      .update({ is_hidden: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete') {
    const { error } = await adminSupabase
      .from('comments')
      .update({
        is_deleted: true,
        body: '[Comment removed by moderator]',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
