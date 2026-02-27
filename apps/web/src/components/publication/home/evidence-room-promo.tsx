import Link from 'next/link'

export function EvidenceRoomPromo() {
  return (
    <section className="py-12 text-center">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[10px] font-semibold text-accent-red uppercase tracking-[0.2em] mb-3">
          Full-Text Search
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">
          Search 1.38 Million Documents
        </h2>
        <p className="mt-3 font-body text-text-secondary">
          Every document released under the Epstein Files Transparency Act.
          12 DOJ dataset releases. 2.77 million pages. Fully searchable.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/evidence"
            className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white font-mono text-xs font-semibold uppercase tracking-wider px-6 py-3 hover:bg-accent-red transition-colors"
          >
            Enter Evidence Room
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
