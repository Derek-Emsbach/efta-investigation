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
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between text-xs text-text-muted">
          <span>
            Built by{' '}
            <a
              href="https://cyclops-digital.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Cyclops Digital
            </a>
          </span>
          <a href="/" className="hover:text-text-secondary transition-colors">
            Back to The Epstein Crimes
          </a>
        </div>
      </footer>
    </div>
  )
}
