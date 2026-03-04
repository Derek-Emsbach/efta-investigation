import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/account — soft-delete: anonymize profile data, then delete auth user
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Anonymize the profile row before deleting the auth user
  // Comments authored by this user will show "Deleted Account" (display_name = null)
  await supabase
    .from('profiles')
    .update({
      display_name: null,
      email: null,
      bio_short: null,
      avatar_url: null,
      is_public: false,
      subscription_tier: null,
    })
    .eq('id', user.id)

  // Delete the auth user — this cascade-deletes the profiles row via FK
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
