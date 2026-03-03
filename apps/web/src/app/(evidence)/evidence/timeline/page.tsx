import type { Metadata } from 'next'
import { EvidenceTimelineClient } from './timeline-client'

export const metadata: Metadata = {
  title: 'Timeline — Evidence Room — The Epstein Crimes',
  description: 'Chronological timeline of documented events in the EFTA investigation.',
  openGraph: {
    title: 'Timeline — Evidence Room — The Epstein Crimes',
    description: 'Chronological timeline of documented events.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Timeline&subtitle=Evidence%20Room&type=evidence'],
  },
}

export default function EvidenceTimelinePage() {
  return <EvidenceTimelineClient />
}
