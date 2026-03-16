import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { canFlag } from '@/lib/access-control'
import type { CommentContentType, CommentFlagReason, SubscriptionTier } from '@efta/shared'

const VALID_FLAG_REASONS: CommentFlagReason[] = ['spam', 'harassment', 'misinformation', 'off_topic', 'other']
const VALID_CONTENT_TYPES: CommentContentType[] = ['story', 'case_file', 'entity']

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'comments')
  if (rateLimited) return rateLimited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (!canFlag(profile?.subscription_tier as SubscriptionTier | null)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await request.json()
  const flagType = body.type as string

  if (flagType === 'comment') {
    const commentId = body.comment_id as string
    const reason = body.reason as CommentFlagReason
    const description = (body.description as string | null) ?? null

    if (!commentId || !reason || !VALID_FLAG_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Invalid flag request' }, { status: 400 })
    }

    // Verify comment exists and user is not the author
    const { data: comment } = await adminSupabase
      .from('comments')
      .select('id, author_id')
      .eq('id', commentId)
      .single()

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (comment.author_id === user.id) {
      return NextResponse.json({ error: 'Cannot flag your own comment' }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from('comment_flags')
      .insert({
        comment_id: commentId,
        user_id: user.id,
        reason,
        description,
      })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already flagged this comment' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  }

  if (flagType === 'inaccuracy') {
    const contentType = body.content_type as CommentContentType
    const contentId = body.content_id as string
    const excerpt = (body.excerpt as string | null) ?? null
    const description = (body.description as string ?? '').trim()

    if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 })
    }

    if (!contentId || !description) {
      return NextResponse.json({ error: 'content_id and description are required' }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from('inaccuracy_flags')
      .insert({
        content_type: contentType,
        content_id: contentId,
        user_id: user.id,
        excerpt,
        description,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid flag type' }, { status: 400 })
}
