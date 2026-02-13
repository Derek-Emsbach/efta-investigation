import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebarToggle from "@/components/layout/mobile-sidebar-toggle";
import Footer from "@/components/layout/footer";
import { SidebarProvider } from "@/lib/sidebar-context";
import { DashboardMain } from "@/components/layout/dashboard-main";

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
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        {/* Skip to content — visible on Tab focus */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-info focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>

        <MobileSidebarToggle>
          <Sidebar userEmail={user.email ?? "Unknown"} />
        </MobileSidebarToggle>
        <DashboardMain>{children}</DashboardMain>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
