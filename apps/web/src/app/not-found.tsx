import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      data-theme="publication"
      className="flex min-h-screen items-center justify-center bg-background px-6"
    >
      <div className="text-center max-w-lg">
        {/* Publication header */}
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-accent-red">
          The Epstein Record
        </p>

        {/* 404 */}
        <h1 className="mt-6 font-display text-7xl font-[900] text-text-primary sm:text-8xl">
          404
        </h1>

        <div className="mt-2 h-px w-24 mx-auto bg-border-default" />

        <h2 className="mt-4 font-display text-xl font-semibold text-text-primary">
          Document Not Found
        </h2>

        <p className="mt-3 font-body text-sm text-text-secondary leading-relaxed">
          The file you requested does not exist in this archive,
          has been redacted, or was never entered into evidence.
        </p>

        {/* Navigation options */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-text-primary text-background font-mono text-xs font-semibold uppercase tracking-wider px-6 py-3 hover:bg-accent-red transition-colors"
          >
            Return to Newsroom
          </Link>
          <Link
            href="/evidence"
            className="inline-flex items-center gap-2 border border-border-default font-mono text-xs font-semibold uppercase tracking-wider px-6 py-3 text-text-secondary hover:border-accent-red hover:text-accent-red transition-colors"
          >
            Search Evidence Room
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-12 font-mono text-[9px] text-text-muted uppercase tracking-wider">
          If you believe this is an error, the document may have been reclassified.
        </p>
      </div>
    </div>
  )
}
