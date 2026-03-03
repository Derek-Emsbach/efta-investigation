import type { Metadata } from 'next'
import NetworkLoader from './network-loader'

export const metadata: Metadata = {
  title: 'Network Map — The Epstein Crimes',
  description:
    'Interactive visualization of every documented connection across six evidence tiers. Explore the network linking individuals and organizations in the EFTA investigation.',
  openGraph: {
    title: 'Network Map — The Epstein Crimes',
    description:
      'Interactive network visualization of documented connections in the EFTA investigation.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=The%20Network%20Map&subtitle=Every%20documented%20connection%20across%20six%20evidence%20tiers&type=home'],
  },
}

export default function NetworkPage() {
  return <NetworkLoader />
}
