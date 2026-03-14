'use client'

import { useEffect, useRef, useCallback } from 'react'

interface TurnstileProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/**
 * Cloudflare Turnstile CAPTCHA widget.
 * Only renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * When not configured, the component renders nothing and
 * immediately calls onVerify with a bypass token.
 */
export function Turnstile({ onVerify, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !SITE_KEY) return
    if (widgetIdRef.current) return // Already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      'expired-callback': onExpire,
      theme: 'auto',
      size: 'normal',
    })
  }, [onVerify, onExpire])

  useEffect(() => {
    if (!SITE_KEY) {
      // No Turnstile configured — auto-verify with bypass
      onVerify('__bypass__')
      return
    }

    // Load Turnstile script if not already present
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
      script.async = true
      window.onTurnstileLoad = renderWidget
      document.head.appendChild(script)
    } else if (window.turnstile) {
      renderWidget()
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderWidget, onVerify])

  if (!SITE_KEY) return null

  return <div ref={containerRef} className="my-3" />
}
