import type { Metadata } from 'next'
import { EvidenceNetworkLoader } from './network-loader'

export const metadata: Metadata = {
  title: 'Network — Evidence Room — The Epstein Crimes',
  description: 'Interactive network graph of documented entity connections across all evidence tiers.',
  openGraph: {
    title: 'Network — Evidence Room — The Epstein Crimes',
    description: 'Interactive network graph of documented entity connections.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Network%20Graph&subtitle=Evidence%20Room&type=evidence'],
  },
}

export default function EvidenceNetworkPage() {
  return <EvidenceNetworkLoader />
}
