import Image from 'next/image'
import { EvidenceHeader } from '@/components/evidence-room/evidence-header'
import { DonateBar } from '@/components/publication/donate-bar'
import { CyclopsPromo } from '@/components/publication/promo/cyclops-promo'

export default function EvidenceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div data-theme="evidence-room" className="min-h-screen bg-background text-text-primary font-body">
      <EvidenceHeader />
      <main>{children}</main>
      <DonateBar variant="bottom" />
      <CyclopsPromo variant="footer-banner" />
      <footer className="border-t border-border-default py-4">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
          <a
            href="https://cyclops-digital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            <Image
              src="/images/cyclops-digital/CyclopsDigitalHorizontalLight.svg"
              alt="Built by Cyclops Digital"
              width={120}
              height={24}
              className="h-5 w-auto"
            />
          </a>
          <a href="/" className="hover:text-text-secondary transition-colors">
            Back to The Epstein Crimes
          </a>
        </div>
      </footer>
    </div>
  )
}
