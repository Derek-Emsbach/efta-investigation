'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const toggle = useCallback((value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }, [selected, onChange])

  const selectAll = () => onChange(options.map((o) => o.value))
  const clearAll = () => onChange([])

  const hasSelection = selected.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`appearance-none bg-elevated border rounded text-sm px-3 py-2 pr-8 transition-colors cursor-pointer inline-flex items-center gap-2 ${
          hasSelection
            ? 'border-info/50 text-text-primary'
            : 'border-border-default text-text-primary'
        }`}
      >
        <span>{hasSelection ? `${label} (${selected.length})` : `All ${label}`}</span>
      </button>
      {/* Dropdown arrow */}
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>

      {open && (
        <div className="absolute z-30 mt-1 w-56 bg-elevated border border-border-default rounded-lg shadow-lg overflow-hidden">
          {/* Select all / Clear */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default text-xs text-text-muted">
            <button onClick={selectAll} className="hover:text-info transition-colors">
              Select all
            </button>
            <button onClick={clearAll} className="hover:text-critical transition-colors">
              Clear
            </button>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => {
              const checked = selected.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-surface/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    className="w-3.5 h-3.5 rounded border-border-default text-info focus:ring-info/30 bg-surface"
                  />
                  <span className="text-sm text-text-primary capitalize">
                    {opt.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
