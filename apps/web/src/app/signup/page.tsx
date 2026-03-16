"use client";

import { useState, useCallback, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Turnstile } from "@/components/ui/turnstile";

function SignupContent() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the captcha verification.");
      return;
    }

    setLoading(true);

    // Verify captcha + enforce auth rate limit server-side
    try {
      const captchaRes = await fetch("/api/auth/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      if (!captchaRes.ok) {
        const captchaData = await captchaRes.json();
        setError(captchaData.error || "Verification failed. Please try again.");
        setLoading(false);
        return;
      }
    } catch {
      setError("Verification failed. Please try again.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div data-theme="publication" className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded border border-border-default bg-surface p-10">
            <div className="mb-4 text-4xl">&#9993;&#65039;</div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Check your email
            </h1>
            <p className="mt-3 text-text-secondary">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account, then come back to sign in.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded bg-accent-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-red/90 transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="publication" className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md">
        {/* Site name */}
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-xl font-bold text-text-primary hover:text-accent-red transition-colors">
            The Epstein Crimes
          </Link>
          <p className="mt-1 text-sm text-text-muted">
            Citizen investigation platform
          </p>
        </div>

        <div className="rounded-lg border border-border-default bg-surface p-8">
          <h1 className="mb-6 font-display text-2xl font-bold text-text-primary">
            Create your account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="displayName"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={2}
                maxLength={40}
                placeholder="Your public name"
                className="w-full rounded border border-border-default bg-background px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-accent-red focus:outline-none focus:ring-2 focus:ring-accent-red/20"
              />
              <p className="mt-1 text-[11px] text-text-muted">
                This is shown publicly on your comments and profile.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded border border-border-default bg-background px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-accent-red focus:outline-none focus:ring-2 focus:ring-accent-red/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="w-full rounded border border-border-default bg-background px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-accent-red focus:outline-none focus:ring-2 focus:ring-accent-red/20"
              />
            </div>

            <Turnstile onVerify={handleTurnstileVerify} />

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full rounded bg-accent-red px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-red/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] text-text-muted">
            Free account. Upgrade to Supporter or Investigator anytime via{" "}
            <Link href="/support" className="text-accent-red hover:underline">
              donations
            </Link>.
          </p>

          <p className="mt-5 text-center text-xs text-text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-red hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <a
          href="https://cyclops-digital.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <img
            src="/images/cyclops-digital/CyclopsDigitalLogoOnly.svg"
            alt="Cyclops Digital"
            width={14}
            height={14}
          />
          <span className="text-[10px] text-text-muted/60">
            &copy; {new Date().getFullYear()} Cyclops Digital LLC
          </span>
        </a>
        <p className="mt-1 text-center text-[10px] text-text-muted/60">
          All persons referenced are presumed innocent unless convicted in a court of law.
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="text-text-muted text-sm">Loading&hellip;</div></div>}>
      <SignupContent />
    </Suspense>
  );
}
