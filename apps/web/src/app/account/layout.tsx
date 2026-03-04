import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?from=/account')
  }

  return (
    <div data-theme="publication" className="min-h-screen bg-background text-text-primary font-body">
      {children}
    </div>
  )
}
