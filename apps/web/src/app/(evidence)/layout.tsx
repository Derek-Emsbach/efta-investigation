import { EvidenceHeader } from '@/components/evidence-room/evidence-header'

export default function EvidenceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div data-theme="evidence-room" className="min-h-screen bg-background text-text-primary font-body">
      <EvidenceHeader />
      <main>{children}</main>
    </div>
  )
}
