"use client"

import { useState } from "react"

interface ExpandableSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function ExpandableSection({
  title,
  children,
  defaultOpen = false,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border-default">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-elevated"
      >
        <span className="font-display text-base font-semibold text-text-primary">
          {title}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className={open ? "px-4 pb-4" : "hidden"}>
        {children}
      </div>
    </div>
  )
}
