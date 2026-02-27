import { PublicHeader } from '@/components/publication/public-header'
import { PublicFooter } from '@/components/publication/public-footer'

export default function PublicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div data-theme="publication" className="min-h-screen bg-background text-text-primary font-body">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
