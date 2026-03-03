import type { Metadata } from 'next'
import { EntityDetailClient } from './entity-detail-client'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const label = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    title: `${label} — Evidence Room — The Epstein Crimes`,
    description: `Evidence profile for ${label}. Documents, connections, timeline, and linked stories.`,
    openGraph: {
      title: `${label} — Evidence Room`,
      description: `Evidence profile for ${label}.`,
      type: 'website',
      siteName: 'The Epstein Crimes',
      images: [`/api/og?title=${encodeURIComponent(label)}&subtitle=Entity%20Profile&type=evidence`],
    },
  }
}

export default async function EvidenceEntityDetailPage({ params }: Props) {
  const { slug } = await params
  return <EntityDetailClient slug={slug} />
}
