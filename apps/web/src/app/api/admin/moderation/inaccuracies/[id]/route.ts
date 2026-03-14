import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { createClient } from '@supabase/supabase-js'
import type { InaccuracyFlagStatus } from '@efta/shared'

const VALID_STATUSES: InaccuracyFlagStatus[] = ['pending', 'under_review', 'resolved', 'dismissed']

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
  const { user } = result
  const body = await request.json()
  const status = body.status as InaccuracyFlagStatus
  const notes = (body.notes as string | null) ?? null

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status,
    reviewer_id: user.id,
  }

  if (notes) {
    update.reviewer_notes = notes
  }

  if (status === 'resolved' || status === 'dismissed') {
    update.resolved_at = new Date().toISOString()
  }

  const { error } = await adminSupabase
    .from('inaccuracy_flags')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
