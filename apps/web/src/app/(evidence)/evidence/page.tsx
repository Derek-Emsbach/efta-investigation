import type { Metadata } from 'next'
import { SearchInterface } from '@/components/evidence-room/search-interface'
import { StatsBar } from '@/components/evidence-room/stats-bar'
import { DatasetJsonLd } from '@/components/publication/json-ld'

export const metadata: Metadata = {
  title: 'Evidence Room — The Epstein Crimes',
  description: 'Search 1.38 million documents from DOJ Epstein Files disclosures. Full-text search across the complete EFTA corpus.',
  openGraph: {
    title: 'Evidence Room — The Epstein Crimes',
    description: 'Search 1.38 million documents from DOJ Epstein Files disclosures. Full-text search across the complete EFTA corpus.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Evidence%20Room&subtitle=Search%201.38%20million%20EFTA%20documents&type=evidence'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Evidence Room — The Epstein Crimes',
    description: 'Search 1.38 million documents from DOJ Epstein Files disclosures.',
  },
}

export default function EvidenceRoomPage() {
  return (
    <>
    <DatasetJsonLd />
    <div className="evidence-grid-bg min-h-[calc(100vh-48px)]">
      {/* Hero */}
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-10">
        <div className="text-center">
          <p className="font-mono text-[11px] font-semibold tracking-[0.3em] text-critical uppercase">
            <span className="inline-block w-1.5 h-1.5 bg-critical mr-2 animate-[pulse_2s_ease-in-out_infinite]" />
            Evidence Room
          </p>
          <h1 className="mt-4 font-display text-4xl font-[900] text-text-primary sm:text-5xl">
            Search the Archive
          </h1>
          <p className="mt-4 font-body text-text-secondary max-w-xl mx-auto">
            Full-text search across the complete EFTA corpus.
            Every document released under the Epstein Files Transparency Act.
          </p>
        </div>

        {/* Search */}
        <div className="mt-10">
          <SearchInterface />
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-6">
        <StatsBar />
      </div>
    </div>
    </>
  )
}
