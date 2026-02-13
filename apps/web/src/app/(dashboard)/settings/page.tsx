import type { Metadata } from "next"
import MainContent from "@/components/layout/main-content"
import { PageHeader } from "@/components/ui/page-header"
import { SettingsForm } from "@/components/settings/settings-form"

export const metadata: Metadata = {
  title: "Settings — EFTA Investigation Platform",
}

export default function SettingsPage() {
  return (
    <MainContent>
      <PageHeader
        title="Settings"
        subtitle="Customize your experience"
      />

      <div className="mx-auto mt-8 max-w-2xl">
        <SettingsForm />
      </div>
    </MainContent>
  )
}
