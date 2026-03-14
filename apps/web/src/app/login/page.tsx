"use client";

import { useState, useCallback, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Turnstile } from "@/components/ui/turnstile";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

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

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Honour ?from= redirect (within this origin only)
      if (from && from.startsWith("/")) {
        router.push(from);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, subscription_tier")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "admin") {
        router.push("/dashboard");
      } else if (profile?.subscription_tier === "investigator") {
        router.push("/investigate");
      } else {
        router.push("/account");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded border border-border-default bg-surface p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
              The Epstein Crimes
            </p>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Sign In
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-info hover:underline">
                Create one
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted"
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
                className="w-full rounded border border-border-default bg-elevated px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/50"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wider text-text-muted"
                >
                  Password
                </label>
                <Link
                  href="/reset-password"
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded border border-border-default bg-elevated px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/50"
              />
            </div>

            <Turnstile onVerify={handleTurnstileVerify} />

            {/* Error message */}
            {error && (
              <div className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full rounded bg-critical px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-critical/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 border-t border-border-default pt-5">
            <p className="text-center text-sm text-text-muted">
              New here?{" "}
              <Link href="/signup" className="font-medium text-info hover:underline">
                Join as Subscriber or Investigator →
              </Link>
            </p>
          </div>
        </div>

        {/* Copyright */}
        <a
          href="https://cyclops-digital.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <img
            src="/images/cyclops-digital/CyclopsDigitalLogoOnly.svg"
            alt="Cyclops Digital"
            width={14}
            height={14}
          />
          <span className="text-[10px] text-text-muted/50">
            &copy; {new Date().getFullYear()} Cyclops Digital LLC
          </span>
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="text-text-muted text-sm">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
