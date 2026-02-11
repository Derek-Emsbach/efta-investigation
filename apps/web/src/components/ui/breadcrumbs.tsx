"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  entities: "Entities",
  documents: "Documents",
  timeline: "Timeline",
  search: "Search",
  network: "Network",
  datasets: "Datasets",
  hierarchy: "Hierarchy",
  upload: "Upload",
  processing: "Processing",
  review: "Review",
  assistant: "Detective",
  disclaimer: "Disclaimer",
  terms: "Terms of Use",
  privacy: "Privacy Policy",
};

interface BreadcrumbsProps {
  /** Override the last breadcrumb label (e.g. entity name instead of UUID) */
  current?: string;
}

export default function Breadcrumbs({ current }: BreadcrumbsProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    const label =
      isLast && current
        ? current
        : ROUTE_LABELS[segment] ?? decodeURIComponent(segment);

    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-xs text-text-muted">
        <li>
          <Link
            href="/"
            className="transition-colors hover:text-text-secondary"
          >
            Dashboard
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-border-light">
              /
            </span>
            {crumb.isLast ? (
              <span className="text-text-secondary" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-text-secondary"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
