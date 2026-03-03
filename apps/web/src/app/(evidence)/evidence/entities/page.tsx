import type { Metadata } from 'next'
import { EntityDirectoryClient } from './entity-directory-client'

export const metadata: Metadata = {
  title: 'Entities — Evidence Room — The Epstein Crimes',
  description: 'Browse all documented entities in the EFTA investigation. Filter by tier, type, and category.',
  openGraph: {
    title: 'Entities — Evidence Room — The Epstein Crimes',
    description: 'Browse all documented entities in the EFTA investigation.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Entity%20Directory&subtitle=Evidence%20Room&type=evidence'],
  },
}

export default function EvidenceEntitiesPage() {
  return <EntityDirectoryClient />
}
