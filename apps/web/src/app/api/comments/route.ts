import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { canComment } from '@/lib/access-control'
import type { CommentContentType, SubscriptionTier } from '@efta/shared'

const VALID_CONTENT_TYPES: CommentContentType[] = ['story', 'case_file', 'entity']
const MAX_BODY_LENGTH = 2000

const CONTENT_TABLE_MAP: Record<CommentContentType, string> = {
  story: 'stories',
  case_file: 'case_files',
  entity: 'entities',
}

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check subscription tier
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (!canComment(profile?.subscription_tier as SubscriptionTier | null)) {
    return NextResponse.json({ error: 'Subscription required to comment' }, { status: 403 })
  }

  const rateLimited = await checkRateLimit(request, 'comments')
  if (rateLimited) return rateLimited

  const body = await request.json()
  const contentType = body.content_type as CommentContentType
  const contentId = body.content_id as string
  const parentId = (body.parent_id as string | null) ?? null
  const commentBody = (body.body as string ?? '').trim()

  // Validate content_type
  if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 })
  }

  // Validate body
  if (!commentBody || commentBody.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: `Comment must be 1-${MAX_BODY_LENGTH} characters` },
      { status: 400 },
    )
  }

  // Validate content exists
  const tableName = CONTENT_TABLE_MAP[contentType]
  const { data: content } = await adminSupabase
    .from(tableName)
    .select('id')
    .eq('id', contentId)
    .single()

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  // If replying, validate parent is a top-level comment
  if (parentId) {
    const { data: parent } = await adminSupabase
      .from('comments')
      .select('id, parent_id')
      .eq('id', parentId)
      .single()

    if (!parent) {
      return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
    }

    if (parent.parent_id !== null) {
      return NextResponse.json({ error: 'Cannot reply to a reply' }, { status: 400 })
    }
  }

  // Insert comment
  const { data: comment, error } = await adminSupabase
    .from('comments')
    .insert({
      content_type: contentType,
      content_id: contentId,
      parent_id: parentId,
      author_id: user.id,
      body: commentBody,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comment }, { status: 201 })
}
