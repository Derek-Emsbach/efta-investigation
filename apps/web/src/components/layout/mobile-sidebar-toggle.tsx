'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/lib/sidebar-context'

interface MobileSidebarToggleProps {
  children: React.ReactNode
}

export default function MobileSidebarToggle({ children }: MobileSidebarToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { collapsed } = useSidebar()

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close on Escape key + prevent body scroll
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={toggle}
        className="fixed top-4 left-4 z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-surface border border-border-default text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Open navigation"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer wrapper */}
      <div
        className={`
          fixed left-0 top-0 z-50 h-screen
          transition-all duration-200 ease-in-out
          md:translate-x-0
          ${collapsed ? 'md:w-16' : 'md:w-60'}
          ${isOpen ? 'translate-x-0 w-60' : '-translate-x-full w-60'}
        `}
      >
        {/* Close button inside drawer — mobile only */}
        <button
          onClick={close}
          className="absolute top-4 right-3 z-10 md:hidden rounded-md p-1.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close navigation"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {children}
      </div>
    </>
  )
}
