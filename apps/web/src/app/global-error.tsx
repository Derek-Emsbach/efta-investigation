'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: '#0A0E17',
          color: '#E5E7EB',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
          padding: '2rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '1.5rem' }}>
            An unexpected error occurred. The error has been reported automatically.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#DC2626',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
