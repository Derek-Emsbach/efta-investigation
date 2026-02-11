"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-critical">
          SYSTEM ERROR
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold text-text-primary">
          Something Went Wrong
        </h1>
        <p className="mt-4 max-w-md text-sm text-text-muted">
          An unexpected error occurred while processing your request. This
          incident has been logged.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded border border-border-default bg-elevated px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
          >
            Try Again
          </button>
          <a
            href="/"
            className="rounded bg-critical px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-critical/90"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
