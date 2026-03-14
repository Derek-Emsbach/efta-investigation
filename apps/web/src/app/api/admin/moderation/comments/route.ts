import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  // Fetch flagged and hidden comments
  const { data: comments, error } = await adminSupabase
    .from('comments')
    .select('*, author:profiles!author_id(id, display_name, email)')
    .or('flag_count.gt.0,is_hidden.eq.true')
    .eq('is_deleted', false)
    .order('flag_count', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch flags for these comments
  const commentIds = (comments ?? []).map((c) => c.id as string)
  const { data: flags } = commentIds.length > 0
    ? await adminSupabase
        .from('comment_flags')
        .select('*, user:profiles!user_id(display_name)')
        .in('comment_id', commentIds)
    : { data: [] }

  // Group flags by comment
  const allFlags = (flags ?? []) as Record<string, unknown>[]
  const flagMap = new Map<string, Record<string, unknown>[]>()
  for (const flag of allFlags) {
    const cid = flag.comment_id as string
    if (!flagMap.has(cid)) flagMap.set(cid, [])
    flagMap.get(cid)!.push(flag)
  }

  const enriched = (comments ?? []).map((c) => ({
    ...c,
    flags: flagMap.get(c.id as string) ?? [],
  }))

  return NextResponse.json({ comments: enriched })
}
