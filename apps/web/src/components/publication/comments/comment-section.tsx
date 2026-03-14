import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type {
  CommentContentType,
  CommentWithAuthor,
  CommentReactionCounts,
  CommentReactionType,
  CommentAuthor,
  SubscriptionTier,
  InvestigatorRank,
} from '@efta/shared'
import { CommentThread } from './comment-thread'

interface CommentSectionProps {
  contentType: CommentContentType
  contentId: string
  currentPath: string
}

const PER_PAGE = 20

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function CommentSection({ contentType, contentId, currentPath }: CommentSectionProps) {
  // Check auth state
  const userSupabase = await createServerSupabase()
  const { data: { user } } = await userSupabase.auth.getUser()

  let userInfo: { id: string; tier: SubscriptionTier | null } | null = null
  if (user) {
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
    userInfo = {
      id: user.id,
      tier: (profile?.subscription_tier as SubscriptionTier | null) ?? null,
    }
  }

  // Fetch first page of comments using service role
  const { data: rawComments, count } = await adminSupabase
    .from('comments')
    .select(
      '*, author:profiles!author_id(id, display_name, avatar_url, subscription_tier)',
      { count: 'exact' },
    )
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .is('parent_id', null)
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .range(0, PER_PAGE - 1)

  const topComments = rawComments ?? []
  const total = count ?? 0

  // Build CommentWithAuthor objects
  let comments: CommentWithAuthor[] = []

  if (topComments.length > 0) {
    const commentIds = topComments.map((c) => c.id as string)

    const [repliesResult, reactionsResult, ranksResult, userReactionsResult] = await Promise.all([
      adminSupabase
        .from('comments')
        .select('*, author:profiles!author_id(id, display_name, avatar_url, subscription_tier)')
        .in('parent_id', commentIds)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true }),

      adminSupabase
        .from('comment_reactions')
        .select('comment_id, reaction_type')
        .in('comment_id', commentIds),

      adminSupabase
        .from('investigator_stats')
        .select('user_id, current_rank'),

      userInfo
        ? adminSupabase
            .from('comment_reactions')
            .select('comment_id, reaction_type')
            .eq('user_id', userInfo.id)
            .in('comment_id', commentIds)
        : Promise.resolve({ data: [] }),
    ])

    const replies = repliesResult.data ?? []
    const replyIds = replies.map((r) => r.id as string)

    const [replyReactionsResult, replyUserReactionsResult] = replyIds.length > 0
      ? await Promise.all([
          adminSupabase
            .from('comment_reactions')
            .select('comment_id, reaction_type')
            .in('comment_id', replyIds),
          userInfo
            ? adminSupabase
                .from('comment_reactions')
                .select('comment_id, reaction_type')
                .eq('user_id', userInfo.id)
                .in('comment_id', replyIds)
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }]

    // Build lookup maps
    const rankMap = new Map<string, string>()
    for (const r of ranksResult.data ?? []) {
      rankMap.set(r.user_id as string, r.current_rank as string)
    }

    function buildReactionCounts(reactions: { comment_id: string; reaction_type: string }[]): Map<string, CommentReactionCounts> {
      const map = new Map<string, CommentReactionCounts>()
      for (const r of reactions) {
        if (!map.has(r.comment_id)) {
          map.set(r.comment_id, { helpful: 0, insightful: 0, disagree: 0 })
        }
        const counts = map.get(r.comment_id)!
        counts[r.reaction_type as CommentReactionType]++
      }
      return map
    }

    function buildUserReactions(reactions: { comment_id: string; reaction_type: string }[]): Map<string, CommentReactionType[]> {
      const map = new Map<string, CommentReactionType[]>()
      for (const r of reactions) {
        if (!map.has(r.comment_id)) map.set(r.comment_id, [])
        map.get(r.comment_id)!.push(r.reaction_type as CommentReactionType)
      }
      return map
    }

    function buildAuthor(raw: Record<string, unknown>): CommentAuthor {
      const authorRaw = raw.author as Record<string, unknown> | null
      const authorId = authorRaw?.id as string ?? raw.author_id as string
      return {
        id: authorId,
        display_name: (authorRaw?.display_name as string | null) ?? null,
        avatar_url: (authorRaw?.avatar_url as string | null) ?? null,
        subscription_tier: (authorRaw?.subscription_tier as SubscriptionTier | null) ?? null,
        current_rank: rankMap.get(authorId) as InvestigatorRank | null ?? null,
      }
    }

    const reactionCounts = buildReactionCounts(
      (reactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )
    const userReactions = buildUserReactions(
      (userReactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )
    const replyReactionCounts = buildReactionCounts(
      (replyReactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )
    const replyUserReactions = buildUserReactions(
      (replyUserReactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )

    // Build reply map
    const replyMap = new Map<string, CommentWithAuthor[]>()
    for (const reply of replies) {
      const parentId = reply.parent_id as string
      if (!replyMap.has(parentId)) replyMap.set(parentId, [])
      replyMap.get(parentId)!.push({
        id: reply.id as string,
        content_type: reply.content_type as CommentContentType,
        content_id: reply.content_id as string,
        parent_id: parentId,
        author_id: reply.author_id as string,
        body: reply.body as string,
        is_hidden: reply.is_hidden as boolean,
        is_deleted: reply.is_deleted as boolean,
        flag_count: reply.flag_count as number,
        created_at: reply.created_at as string,
        updated_at: reply.updated_at as string,
        author: buildAuthor(reply as Record<string, unknown>),
        reactions: replyReactionCounts.get(reply.id as string) ?? { helpful: 0, insightful: 0, disagree: 0 },
        user_reactions: replyUserReactions.get(reply.id as string) ?? [],
        replies: [],
      })
    }

    comments = topComments.map((c) => ({
      id: c.id as string,
      content_type: c.content_type as CommentContentType,
      content_id: c.content_id as string,
      parent_id: null,
      author_id: c.author_id as string,
      body: c.body as string,
      is_hidden: c.is_hidden as boolean,
      is_deleted: c.is_deleted as boolean,
      flag_count: c.flag_count as number,
      created_at: c.created_at as string,
      updated_at: c.updated_at as string,
      author: buildAuthor(c as Record<string, unknown>),
      reactions: reactionCounts.get(c.id as string) ?? { helpful: 0, insightful: 0, disagree: 0 },
      user_reactions: userReactions.get(c.id as string) ?? [],
      replies: replyMap.get(c.id as string) ?? [],
    }))
  }

  return (
    <div className="mt-12 pt-8 border-t-2 border-text-primary">
      <h2 className="font-display text-lg font-semibold text-text-primary mb-1">
        Discussion
      </h2>
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-5">
        Community comments
      </p>

      <CommentThread
        initialComments={comments}
        initialTotal={total}
        contentType={contentType}
        contentId={contentId}
        perPage={PER_PAGE}
        user={userInfo}
        currentPath={currentPath}
      />
    </div>
  )
}
