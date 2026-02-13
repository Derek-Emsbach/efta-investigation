import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkThresholds } from '@/lib/notifications/check-thresholds'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('notification_alerts')
    .select('*')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data })
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await checkThresholds(supabase)

  return NextResponse.json({ results })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, is_read, dismissed } = body as {
    id: string
    is_read?: boolean
    dismissed?: boolean
  }

  if (!id) {
    return NextResponse.json(
      { error: 'Missing notification id' },
      { status: 400 },
    )
  }

  const update: Record<string, unknown> = {}
  if (is_read !== undefined) update.is_read = is_read
  if (dismissed !== undefined) update.dismissed = dismissed

  const { error } = await supabase
    .from('notification_alerts')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
