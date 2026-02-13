'use client'

import Link from "next/link";
import { useSidebar } from "@/lib/sidebar-context";

export default function Footer() {
  const { collapsed } = useSidebar();

  return (
    <footer
      className={`border-t border-border-default bg-surface px-6 py-6 transition-all duration-200 ${
        collapsed ? "md:ml-16" : "md:ml-60"
      }`}
    >
      {/* Disclaimer */}
      <p className="max-w-3xl text-xs leading-relaxed text-text-muted">
        This platform compiles publicly available evidence and documents released
        under the Epstein Files Transparency Act (EFTA). All entity
        classifications reflect evidence strength, not established guilt. All
        persons referenced are presumed innocent unless convicted in a court of
        law.
      </p>

      {/* Links + Copyright */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-4 text-[11px]" aria-label="Legal">
          <Link
            href="/disclaimer"
            className="text-text-muted transition-colors hover:text-text-secondary"
          >
            Disclaimer
          </Link>
          <Link
            href="/terms"
            className="text-text-muted transition-colors hover:text-text-secondary"
          >
            Terms of Use
          </Link>
          <Link
            href="/privacy"
            className="text-text-muted transition-colors hover:text-text-secondary"
          >
            Privacy Policy
          </Link>
          <Link
            href="/about"
            className="text-text-muted transition-colors hover:text-text-secondary"
          >
            About
          </Link>
        </nav>
        <p className="text-[11px] text-text-muted">
          &copy; {new Date().getFullYear()} Cyclops Digital LLC. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
