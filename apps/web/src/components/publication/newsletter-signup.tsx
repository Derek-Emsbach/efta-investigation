'use client'

import { useState } from 'react'

interface NewsletterSignupProps {
  source: 'home' | 'story' | 'support' | 'footer' | 'news'
  variant?: 'band' | 'inline'
}

export function NewsletterSignup({ source, variant = 'band' }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    try {
      const res = await fetch('/api/public/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, company }),
      })
      const data: { ok?: boolean; confirm?: boolean; error?: string } = await res.json()
      if (!res.ok || !data.ok) {
        setState('error')
        setMessage(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setState('done')
      setMessage(data.confirm
        ? 'Almost done: check your inbox and click the confirmation link.'
        : "You're in. Watch for the weekly briefing.")
    } catch {
      setState('error')
      setMessage('Connection failed. Try again.')
    }
  }

  const form = (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
      <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
      <input
        id={`nl-${source}`}
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'loading' || state === 'done'}
        className="flex-1 min-w-0 border border-border-default bg-white px-4 py-3 font-sans text-sm text-ink placeholder:text-text-muted focus:outline-none focus:border-accent-gold"
      />
      {/* Honeypot: hidden from humans, bots fill it */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        name="company"
      />
      <button
        type="submit"
        disabled={state === 'loading' || state === 'done'}
        className="shrink-0 font-sans text-sm font-bold uppercase tracking-[0.08em] bg-ink text-background px-6 py-3 hover:bg-ink/90 transition-colors disabled:opacity-60"
      >
        {state === 'loading' ? 'Joining…' : state === 'done' ? 'Subscribed' : 'Get the briefing'}
      </button>
    </form>
  )

  if (variant === 'inline') {
    return (
      <div>
        {form}
        {message && (
          <p className={`mt-2 font-sans text-xs ${state === 'error' ? 'text-accent-red' : 'text-text-secondary'}`}>{message}</p>
        )}
      </div>
    )
  }

  return (
    <section className="border-y border-border-default bg-elevated/30">
      <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold mb-2">
            The Weekly Briefing
          </p>
          <h2 className="font-display text-2xl font-bold text-text-primary">
            New documents, court rulings, and our latest findings. One email a week.
          </h2>
          <p className="mt-2 font-body text-sm text-text-secondary">Free. No spam. Unsubscribe anytime.</p>
        </div>
        <div>
          {form}
          {message && (
            <p className={`mt-2 font-sans text-xs ${state === 'error' ? 'text-accent-red' : 'text-text-secondary'}`}>{message}</p>
          )}
        </div>
      </div>
    </section>
  )
}
