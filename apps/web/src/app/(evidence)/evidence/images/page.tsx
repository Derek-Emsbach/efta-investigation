import type { Metadata } from 'next'
import { ImageGalleryClient } from './image-gallery-client'

export const metadata: Metadata = {
  title: 'Document Images — Evidence Room — The Epstein Crimes',
  description: 'Browse images extracted from EFTA document releases. Photos, graphics, signatures, and more from 3.5 million pages.',
  openGraph: {
    title: 'Document Images — Evidence Room',
    description: 'Browse images extracted from EFTA document releases.',
    type: 'website',
    siteName: 'The Epstein Crimes',
    images: ['/api/og?title=Document%20Images&subtitle=Evidence%20Room&type=evidence'],
  },
}

export default function EvidenceImagesPage() {
  return <ImageGalleryClient />
}
