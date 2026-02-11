import SidebarNav from "@/components/layout/sidebar-nav";
import LogoutButton from "@/components/auth/logout-button";

interface SidebarProps {
  userEmail: string;
}

const investigationItems = [
  { label: "Dashboard", href: "/", icon: "home" as const },
  { label: "Entities", href: "/entities", icon: "users" as const },
  { label: "Documents", href: "/documents", icon: "file-text" as const },
  { label: "Timeline", href: "/timeline", icon: "clock" as const },
  { label: "Search", href: "/search", icon: "search" as const },
  { label: "Network", href: "/network", icon: "network" as const },
  { label: "Datasets", href: "/datasets", icon: "database" as const },
  { label: "Hierarchy", href: "/hierarchy", icon: "sitemap" as const },
];

const adminItems = [
  { label: "Upload", href: "/upload", icon: "upload" as const },
  { label: "Processing", href: "/processing", icon: "loader" as const },
  { label: "Review", href: "/review", icon: "check-circle" as const },
  { label: "Detective", href: "/assistant", icon: "sparkles" as const },
];

export default function Sidebar({ userEmail }: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border-default bg-surface">
      {/* Branding */}
      <div className="border-b border-border-default px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
          EFTA
        </p>
        <h1 className="mt-1 font-display text-lg font-semibold text-text-primary">
          Investigation Platform
        </h1>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Investigation section */}
        <div className="mb-6">
          <p className="mb-2 px-5 text-xs font-medium uppercase tracking-wider text-text-muted">
            Investigation
          </p>
          <SidebarNav items={investigationItems} />
        </div>

        {/* Admin section */}
        <div>
          <p className="mb-2 px-5 text-xs font-medium uppercase tracking-wider text-text-muted">
            Admin
          </p>
          <SidebarNav items={adminItems} />
        </div>
      </div>

      {/* User section */}
      <div className="border-t border-border-default px-5 py-4">
        <p
          className="mb-1 truncate text-sm text-text-secondary"
          title={userEmail}
        >
          {userEmail}
        </p>
        <LogoutButton />
        <p className="mt-3 text-[10px] text-text-muted">
          Developed by Cyclops Digital LLC
        </p>
      </div>
    </aside>
  );
}
