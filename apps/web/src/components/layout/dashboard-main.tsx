'use client'

import { useSidebar } from '@/lib/sidebar-context'

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <main
      id="main-content"
      className={`min-h-screen transition-all duration-200 ${
        collapsed ? 'md:ml-16' : 'md:ml-60'
      }`}
    >
      {children}
    </main>
  )
}
