import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { canBoost } from '@/lib/access-control'
import type { CommentReactionType, SubscriptionTier } from '@efta/shared'

const VALID_REACTION_TYPES: CommentReactionType[] = ['helpful', 'insightful', 'disagree']

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, 'comments')
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

  if (!canBoost(profile?.subscription_tier as SubscriptionTier | null)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await request.json()
  const commentId = body.comment_id as string
  const reactionType = body.reaction_type as CommentReactionType

  if (!commentId || !reactionType || !VALID_REACTION_TYPES.includes(reactionType)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
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
    return NextResponse.json({ error: 'Cannot react to your own comment' }, { status: 400 })
  }

  // Toggle: check if reaction exists
  const { data: existing } = await adminSupabase
    .from('comment_reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .eq('reaction_type', reactionType)
    .single()

  if (existing) {
    // Remove reaction
    await adminSupabase
      .from('comment_reactions')
      .delete()
      .eq('id', existing.id)

    return NextResponse.json({ added: false })
  }

  // Add reaction
  const { error } = await adminSupabase
    .from('comment_reactions')
    .insert({
      comment_id: commentId,
      user_id: user.id,
      reaction_type: reactionType,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // XP: award 5 XP for "helpful" reaction on investigator's comment
  if (reactionType === 'helpful') {
    const { data: authorProfile } = await adminSupabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', comment.author_id)
      .single()

    if (authorProfile?.subscription_tier === 'investigator') {
      // Check if XP already awarded for this comment
      const { data: existingXp } = await adminSupabase
        .from('xp_transactions')
        .select('id')
        .eq('event_type', 'comment_helpful')
        .eq('reference_id', commentId)
        .single()

      if (!existingXp) {
        await adminSupabase
          .from('xp_transactions')
          .insert({
            user_id: comment.author_id,
            event_type: 'comment_helpful',
            xp_amount: 5,
            reference_id: commentId,
            notes: 'Community marked comment as helpful',
          })
      }
    }
  }

  return NextResponse.json({ added: true })
}
