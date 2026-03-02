import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production with a DSN configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',

  // Capture 100% of errors, 10% of performance traces (free tier: 5K events/mo)
  tracesSampleRate: 0.1,

  // Filter out common browser noise
  ignoreErrors: [
    // ResizeObserver loop errors (benign, from layout shifts)
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors from ad blockers / extensions
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // Browser extension noise
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
  ],

  // Don't send PII
  sendDefaultPii: false,
})
