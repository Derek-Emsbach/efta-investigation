"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded border border-border-default bg-surface p-8">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
              The Epstein Crimes
            </p>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Reset Password
            </h1>
          </div>

          {sent ? (
            <div className="text-center">
              <p className="text-text-secondary">
                If an account exists for <strong>{email}</strong>, you&apos;ll receive a
                reset link shortly.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-block text-sm text-info hover:underline"
              >
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded border border-border-default bg-elevated px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/50"
                />
              </div>

              {error && (
                <div className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-critical px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-critical/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-text-muted/50">
          &copy; {new Date().getFullYear()} Cyclops Digital LLC
        </p>
      </div>
    </div>
  );
}
