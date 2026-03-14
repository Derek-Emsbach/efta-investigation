/**
 * Server-side Cloudflare Turnstile token verification.
 * Calls the Turnstile siteverify endpoint.
 *
 * Returns `{ success: true }` or `{ success: false, error: string }`.
 */
export async function verifyTurnstileToken(
  token: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  // If no secret configured, accept the bypass token from the client component
  if (!secret) {
    if (token === '__bypass__') {
      return { success: true }
    }
    // No secret but a real token — can't verify, allow through
    return { success: true }
  }

  // Reject bypass tokens when Turnstile is configured
  if (token === '__bypass__') {
    return { success: false, error: 'Invalid captcha token' }
  }

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: token }),
      },
    )

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }

    if (!data.success) {
      return { success: false, error: 'Captcha verification failed' }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Captcha verification unavailable' }
  }
}
