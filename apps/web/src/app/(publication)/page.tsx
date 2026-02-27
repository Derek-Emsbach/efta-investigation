import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Epstein Record — Investigative Journalism',
  description: 'Systematic investigation of DOJ disclosures released under the Epstein Files Transparency Act. 1.38 million documents. 99 entities. The evidence speaks.',
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="text-center">
        <h1 className="font-display text-5xl font-bold text-text-primary sm:text-7xl">
          The Epstein Record
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto font-body">
          A systematic investigation of 1.38 million pages of DOJ disclosures released
          under the Epstein Files Transparency Act.
        </p>
        <p className="mt-8 text-sm text-text-muted">
          Coming soon.
        </p>
      </div>
    </div>
  )
}
