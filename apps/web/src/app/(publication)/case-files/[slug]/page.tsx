import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Case File — The Epstein Record',
}

export default async function CaseFilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs text-accent-red font-mono uppercase tracking-wider">Case File</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-text-primary">
        {slug.replace(/-/g, ' ')}
      </h1>
      <p className="mt-6 text-text-secondary">
        This case file is under development.
      </p>
    </div>
  )
}
