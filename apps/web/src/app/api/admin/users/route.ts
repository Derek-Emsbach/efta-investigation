import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

/** GET: List all user profiles (admin only) */
export async function GET() {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { supabase } = result

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}

/** PATCH: Update a user's role (admin only, cannot self-demote) */
export async function PATCH(request: Request) {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result
  const { user, supabase } = result

  const body = await request.json()
  const { user_id, role } = body

  if (!user_id || !role) {
    return NextResponse.json({ error: 'user_id and role required' }, { status: 400 })
  }

  if (!['admin', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Prevent self-demotion
  if (user_id === user.id && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, user_id, role })
}
