import Link from 'next/link'

export function EvidenceRoomPromo() {
  return (
    <section className="py-10">
      <div className="bg-elevated border border-border-default p-10 text-center">
        <p className="font-mono text-[10px] font-semibold text-accent-red uppercase tracking-[0.2em] mb-3">
          Full-Text Search
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">
          Search 1.38 Million Documents
        </h2>
        <p className="mt-3 font-body text-text-secondary max-w-xl mx-auto leading-relaxed">
          Every document released under the Epstein Files Transparency Act.
          12 DOJ dataset releases. 2.77 million pages. Fully searchable.
        </p>
        <div className="mt-6">
          <Link
            href="/evidence"
            className="inline-flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.1em] text-text-primary border-2 border-text-primary px-7 py-3.5 hover:bg-text-primary hover:text-background transition-all duration-300"
          >
            Enter Evidence Room
            <span>→</span>
          </Link>
        </div>

        {/* Search preview */}
        <div className="flex items-center max-w-md mx-auto mt-6 border border-border-default bg-white overflow-hidden">
          <div className="flex-1 px-4 py-3 font-sans text-sm text-text-muted text-left">
            Search names, Bates numbers, keywords...
          </div>
          <div className="px-5 py-3 bg-text-primary text-background font-sans text-[11px] font-semibold uppercase tracking-[0.1em]">
            Search
          </div>
        </div>
      </div>
    </section>
  )
}
