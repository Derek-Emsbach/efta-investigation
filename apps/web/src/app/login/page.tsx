"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded border border-border-default bg-surface p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
              EFTA
            </p>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Investigation Platform
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Secure access required
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
                placeholder="analyst@efta.gov"
                className="w-full rounded border border-border-default bg-elevated px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-info focus:outline-none focus:ring-2 focus:ring-info/50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted"
              >
                Password
              </label>
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

            {/* Error message */}
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
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 border-t border-border-default pt-4">
            <p className="text-center text-xs text-text-muted">
              Authorized personnel only. All access is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
