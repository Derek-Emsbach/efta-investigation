'use client'

import { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight > 0) {
        setProgress(Math.min(100, (scrollTop / docHeight) * 100))
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div data-component="reading-progress" className="fixed top-0 left-0 right-0 h-[3px] z-50">
      <div
        className="h-full bg-accent-red transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
