import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Entity Profile — The Epstein Record',
}

export default async function EntityProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs text-text-muted font-mono uppercase tracking-wider">Entity Dossier</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-text-primary capitalize">
        {slug.replace(/-/g, ' ')}
      </h1>
      <p className="mt-6 text-text-secondary">
        This entity profile is under development.
      </p>
    </div>
  )
}
