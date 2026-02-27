import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
          CLASSIFIED
        </p>
        <h1 className="mt-4 font-display text-5xl font-bold text-text-primary">
          404
        </h1>
        <p className="mt-2 font-display text-xl text-text-secondary">
          Document Not Found
        </p>
        <p className="mt-4 max-w-md text-sm text-text-muted">
          The file you requested does not exist in this archive, has been
          redacted, or was never entered into evidence.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded border border-border-default bg-elevated px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
