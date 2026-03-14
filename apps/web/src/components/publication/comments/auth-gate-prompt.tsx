import Link from 'next/link'

interface AuthGatePromptProps {
  currentPath: string
}

export function AuthGatePrompt({ currentPath }: AuthGatePromptProps) {
  const loginUrl = `/login?from=${encodeURIComponent(currentPath)}`
  const signupUrl = `/signup?from=${encodeURIComponent(currentPath)}`

  return (
    <div className="border border-border-default bg-surface/50 p-6 text-center">
      <p className="font-body text-sm text-text-secondary mb-3">
        Join the discussion
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href={loginUrl}
          className="font-mono text-xs uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
        >
          Sign In
        </Link>
        <span className="text-border-default">|</span>
        <Link
          href={signupUrl}
          className="font-mono text-xs uppercase tracking-wider text-accent-red hover:text-accent-red/80 transition-colors"
        >
          Create Account
        </Link>
      </div>
    </div>
  )
}
