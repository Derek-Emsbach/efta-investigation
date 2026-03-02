import { PublicHeader } from '@/components/publication/public-header'
import { PublicFooter } from '@/components/publication/public-footer'
import { DonateBar } from '@/components/publication/donate-bar'

export default function PublicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div data-theme="publication" className="min-h-screen bg-background text-text-primary font-body">
      <DonateBar variant="top" />
      <PublicHeader />
      <main>{children}</main>
      <DonateBar variant="bottom" />
      <PublicFooter />
    </div>
  )
}
