'use client'

import Link from "next/link";
import SidebarNav from "@/components/layout/sidebar-nav";
import LogoutButton from "@/components/auth/logout-button";
import ThemeToggle from "@/components/ui/theme-toggle";
import NotificationBell from "@/components/layout/notification-bell";
import { useSidebar } from "@/lib/sidebar-context";
import type { UserRole } from "@efta/shared";

interface SidebarProps {
  userEmail: string;
  userRole: UserRole;
}

const investigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: "home" as const },
  { label: "Entities", href: "/dashboard/entities", icon: "users" as const },
  { label: "Documents", href: "/dashboard/documents", icon: "file-text" as const },
  { label: "Timeline", href: "/dashboard/timeline", icon: "clock" as const },
  { label: "Search", href: "/dashboard/search", icon: "search" as const },
  { label: "Network", href: "/dashboard/network", icon: "network" as const },
  { label: "Datasets", href: "/dashboard/datasets", icon: "database" as const },
  { label: "Hierarchy", href: "/dashboard/hierarchy", icon: "sitemap" as const },
  { label: "Forensics", href: "/dashboard/forensics", icon: "microscope" as const },
  { label: "Photos", href: "/dashboard/photos", icon: "image" as const },
  { label: "Locations", href: "/dashboard/locations", icon: "map-pin" as const },
  { label: "Investigations", href: "/dashboard/investigations", icon: "briefcase" as const },
];

const adminItems = [
  { label: "Upload", href: "/dashboard/upload", icon: "upload" as const },
  { label: "Processing", href: "/dashboard/processing", icon: "loader" as const },
  { label: "Review", href: "/dashboard/review", icon: "check-circle" as const },
  { label: "Detective", href: "/dashboard/assistant", icon: "sparkles" as const },
  { label: "Admin", href: "/dashboard/admin", icon: "gauge" as const },
];

export default function Sidebar({ userEmail, userRole }: SidebarProps) {
  const { collapsed, toggle } = useSidebar();
  const isAdmin = userRole === "admin";

  return (
    <aside
      className={`flex h-screen flex-col border-r border-border-default bg-surface transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Branding + collapse toggle */}
      <div className="relative border-b border-border-default px-5 py-5">
        {collapsed ? (
          <p className="text-center font-display text-lg font-bold text-text-primary">
            E
          </p>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-text-muted">
              EFTA
            </p>
            <h1 className="mt-1 font-display text-lg font-semibold text-text-primary">
              Investigation Platform
            </h1>
          </>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggle}
          className="absolute -right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-surface border border-border-default text-text-muted hover:text-text-primary hover:border-text-secondary transition-colors z-10"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Investigation section */}
        <div className="mb-6">
          {!collapsed && (
            <p className="mb-2 px-5 text-xs font-medium uppercase tracking-wider text-text-muted">
              Investigation
            </p>
          )}
          <SidebarNav items={investigationItems} collapsed={collapsed} />
        </div>

        {/* Admin section — visible to admins only */}
        {isAdmin && (
          <div>
            {!collapsed && (
              <p className="mb-2 px-5 text-xs font-medium uppercase tracking-wider text-text-muted">
                Admin
              </p>
            )}
            <SidebarNav items={adminItems} collapsed={collapsed} />
          </div>
        )}
      </div>

      {/* User section */}
      <div className="border-t border-border-default px-3 py-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <NotificationBell collapsed />
            <SettingsGear collapsed />
            <LogoutButton />
            <ThemeToggle />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-2 mb-1">
              <p
                className="truncate text-sm text-text-secondary"
                title={userEmail}
              >
                {userEmail}
              </p>
              <span
                className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  isAdmin
                    ? "bg-critical/10 text-critical"
                    : "bg-info/10 text-info"
                }`}
              >
                {userRole}
              </span>
            </div>
            <div className="flex items-center justify-between px-2">
              <LogoutButton />
              <div className="flex items-center gap-1">
                <NotificationBell />
                <SettingsGear />
                <ThemeToggle />
              </div>
            </div>
            <p className="mt-3 text-[10px] text-text-muted px-2">
              &copy; {new Date().getFullYear()} Cyclops Digital LLC
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function SettingsGear({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard/settings"
      className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-elevated/50 transition-colors"
      title="Settings"
      aria-label="Settings"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </Link>
  );
}
