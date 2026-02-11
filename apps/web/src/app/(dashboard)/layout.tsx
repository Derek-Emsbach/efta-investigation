import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebarToggle from "@/components/layout/mobile-sidebar-toggle";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileSidebarToggle>
        <Sidebar userEmail={user.email ?? "Unknown"} />
      </MobileSidebarToggle>
      <main className="md:ml-60 min-h-screen">{children}</main>
    </div>
  );
}
