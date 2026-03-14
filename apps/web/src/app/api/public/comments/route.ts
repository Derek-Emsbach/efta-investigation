import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import type {
  CommentContentType,
  CommentWithAuthor,
  CommentReactionCounts,
  CommentReactionType,
  CommentAuthor,
  SubscriptionTier,
  InvestigatorRank,
} from '@efta/shared'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const VALID_CONTENT_TYPES: CommentContentType[] = ['story', 'case_file', 'entity']
const MAX_PER_PAGE = 50
const DEFAULT_PER_PAGE = 20

export async function GET(request: NextRequest) {
  const rateLimited = checkRateLimit(request)
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('content_type') as CommentContentType | null
    const contentId = searchParams.get('content_id')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(searchParams.get('per_page') ?? String(DEFAULT_PER_PAGE), 10)))
    const userId = searchParams.get('user_id') // optional: for marking user's own reactions

    if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 })
    }
    if (!contentId) {
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 })
    }

    // Fetch top-level comments with author info
    const offset = (page - 1) * perPage
    const { data: rawComments, error: commentsError, count } = await supabase
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
      .range(offset, offset + perPage - 1)

    if (commentsError) {
      throw new Error(`Failed to fetch comments: ${commentsError.message}`)
    }

    const comments = rawComments ?? []
    const total = count ?? 0

    if (comments.length === 0) {
      return NextResponse.json({
        comments: [],
        total,
        page,
        per_page: perPage,
        has_more: false,
      }, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120' },
      })
    }

    const commentIds = comments.map((c) => c.id as string)

    // Fetch replies, reactions, and investigator ranks in parallel
    const [repliesResult, reactionsResult, ranksResult, userReactionsResult] = await Promise.all([
      // Replies for these top-level comments
      supabase
        .from('comments')
        .select('*, author:profiles!author_id(id, display_name, avatar_url, subscription_tier)')
        .in('parent_id', commentIds)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true }),

      // Reaction counts per comment (top-level + replies will be fetched together)
      supabase
        .from('comment_reactions')
        .select('comment_id, reaction_type')
        .in('comment_id', commentIds),

      // Investigator ranks for comment authors
      supabase
        .from('investigator_stats')
        .select('user_id, current_rank'),

      // Current user's reactions (if user_id provided)
      userId
        ? supabase
            .from('comment_reactions')
            .select('comment_id, reaction_type')
            .eq('user_id', userId)
            .in('comment_id', commentIds)
        : Promise.resolve({ data: [] }),
    ])

    const replies = repliesResult.data ?? []
    const replyIds = replies.map((r) => r.id as string)

    // Fetch reactions for replies too
    const [replyReactionsResult, replyUserReactionsResult] = replyIds.length > 0
      ? await Promise.all([
          supabase
            .from('comment_reactions')
            .select('comment_id, reaction_type')
            .in('comment_id', replyIds),
          userId
            ? supabase
                .from('comment_reactions')
                .select('comment_id, reaction_type')
                .eq('user_id', userId)
                .in('comment_id', replyIds)
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }]

    // Build rank lookup
    const rankMap = new Map<string, string>()
    for (const r of ranksResult.data ?? []) {
      rankMap.set(r.user_id as string, r.current_rank as string)
    }

    // Build reaction count maps
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
        if (!map.has(r.comment_id)) {
          map.set(r.comment_id, [])
        }
        map.get(r.comment_id)!.push(r.reaction_type as CommentReactionType)
      }
      return map
    }

    const reactionCounts = buildReactionCounts([
      ...(reactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    ])
    const userReactions = buildUserReactions(
      (userReactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )

    const replyReactionCounts = buildReactionCounts(
      (replyReactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )
    const replyUserReactions = buildUserReactions(
      (replyUserReactionsResult.data ?? []) as { comment_id: string; reaction_type: string }[],
    )

    // Build author helper
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

    // Build reply map
    const replyMap = new Map<string, CommentWithAuthor[]>()
    for (const reply of replies) {
      const parentId = reply.parent_id as string
      if (!replyMap.has(parentId)) {
        replyMap.set(parentId, [])
      }
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

    // Assemble final comments
    const result: CommentWithAuthor[] = comments.map((c) => ({
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

    return NextResponse.json({
      comments: result,
      total,
      page,
      per_page: perPage,
      has_more: offset + perPage < total,
    }, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
