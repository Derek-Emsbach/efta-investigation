import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Evidence Room — The Epstein Record',
  description: 'Search 1.38 million documents from DOJ Epstein Files disclosures.',
}

export default function EvidenceRoomPage() {
  return (
    <div className="evidence-grid-bg min-h-[calc(100vh-48px)]">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-critical uppercase">
            Evidence Room
          </p>
          <h1 className="mt-4 font-mono text-4xl font-bold text-text-primary sm:text-5xl">
            Search the Archive
          </h1>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            1.38 million documents. 2.77 million pages. 12 DOJ dataset releases.
            Full-text search across the complete EFTA corpus.
          </p>
          <div className="mt-10 mx-auto max-w-2xl">
            <div className="flex items-center rounded-lg border border-border-default bg-surface px-4 py-3">
              <svg className="w-5 h-5 text-text-muted shrink-0 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="font-mono text-sm text-text-muted">
                Search coming soon...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
