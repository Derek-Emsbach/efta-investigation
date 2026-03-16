import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_BODY_LENGTH = 2000
const EDIT_WINDOW_MS = 15 * 60_000 // 15 minutes

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = await checkRateLimit(request, 'comments')
  if (rateLimited) return rateLimited

  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Get comment
  const { data: comment } = await adminSupabase
    .from('comments')
    .select('id, author_id, created_at, is_deleted')
    .eq('id', id)
    .single()

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isOwn = comment.author_id === user.id

  if (!isOwn && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json()

  // Soft delete
  if (body.delete === true) {
    const { error } = await adminSupabase
      .from('comments')
      .update({
        is_deleted: true,
        body: '[Comment deleted by user]',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  // Edit body
  const newBody = (body.body as string ?? '').trim()
  if (!newBody || newBody.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be 1-${MAX_BODY_LENGTH} characters` },
      { status: 400 },
    )
  }

  // Check edit window (authors only, admins can edit anytime)
  if (isOwn && !isAdmin) {
    const elapsed = Date.now() - new Date(comment.created_at as string).getTime()
    if (elapsed > EDIT_WINDOW_MS) {
      return NextResponse.json(
        { error: 'Edit window has expired (15 minutes)' },
        { status: 403 },
      )
    }
  }

  const { error } = await adminSupabase
    .from('comments')
    .update({
      body: newBody,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
