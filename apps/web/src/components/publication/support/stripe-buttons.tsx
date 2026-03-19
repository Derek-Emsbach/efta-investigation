"use client"

import { useState } from "react"

type DonationType = "supporter" | "supporter_monthly" | "investigator"

interface StripeButtonProps {
  type: DonationType
  isAuthenticated: boolean
}

const LABELS: Record<DonationType, string> = {
  supporter: "Make a Donation",
  supporter_monthly: "Subscribe Monthly",
  investigator: "Subscribe Monthly",
}

export function StripeButton({ type, isAuthenticated }: StripeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!isAuthenticated) {
      window.location.href = `/login?from=/support`
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Something went wrong")
        setLoading(false)
        return
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch {
      setError("Connection failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full font-sans text-sm font-bold uppercase tracking-[0.08em] bg-accent-gold text-ink px-8 py-3.5 hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Redirecting..." : LABELS[type]}
      </button>
      {error && (
        <p className="mt-2 text-xs text-accent-red">{error}</p>
      )}
      {!isAuthenticated && (
        <p className="mt-2 text-[11px] text-text-muted">
          You&apos;ll need to sign in first
        </p>
      )}
    </div>
  )
}
