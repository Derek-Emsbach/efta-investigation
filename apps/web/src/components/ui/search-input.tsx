'use client'

import { useState, useEffect, useRef } from 'react'

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  defaultValue?: string
}

export function SearchInput({
  placeholder = 'Search...',
  onSearch,
  defaultValue = '',
}: SearchInputProps) {
  const [value, setValue] = useState(defaultValue)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const timer = setTimeout(() => {
      onSearch(value)
    }, 300)

    return () => clearTimeout(timer)
  }, [value, onSearch])

  return (
    <div className="relative">
      {/* Search icon */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-elevated border border-border-default rounded-lg text-text-primary text-sm pl-10 pr-4 py-2.5 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info transition-colors"
      />
    </div>
  )
}
