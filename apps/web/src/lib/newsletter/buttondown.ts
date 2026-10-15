/**
 * Minimal Buttondown client. Docs: https://docs.buttondown.com
 * Auth: `Authorization: Token <BUTTONDOWN_API_KEY>`.
 *
 * Subscribers are created with Buttondown's default double opt-in (they get a
 * confirmation email) — better deliverability and clean consent records.
 * No tags: tags require a paid Buttondown plan and return 403 on free.
 */
const API = 'https://api.buttondown.com/v1'

function apiKey(): string | null {
  return process.env.BUTTONDOWN_API_KEY?.trim() || null
}

export function buttondownEnabled(): boolean {
  return apiKey() !== null
}

/** Best effort: never throws. Returns true when Buttondown accepted or already had the address. */
export async function addButtondownSubscriber(email: string, source: string | null): Promise<boolean> {
  const key = apiKey()
  if (!key) return false
  try {
    const res = await fetch(`${API}/subscribers`, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: email,
        referrer_url: 'https://www.theepsteincrimes.com',
        metadata: { signup_source: source ?? 'unknown' },
      }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (res.ok) return true
    // 400 for an existing address is expected; anything else is worth a log line.
    const text = await res.text()
    if (res.status === 400 && /already|exists|collision/i.test(text)) return true
    console.error(`[buttondown] subscriber create ${res.status}: ${text.slice(0, 300)}`)
    return false
  } catch (err) {
    console.error('[buttondown] subscriber create failed:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function createButtondownDraft(input: {
  subject: string
  body: string
  slug: string
  description: string
}): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const key = apiKey()
  if (!key) return { ok: false, status: 0, error: 'BUTTONDOWN_API_KEY not set' }
  const res = await fetch(`${API}/emails`, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, status: 'draft' }),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 500) }
  let id = ''
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null && 'id' in parsed) id = String((parsed as { id: unknown }).id)
  } catch {
    // ignore — draft was created
  }
  return { ok: true, id }
}
