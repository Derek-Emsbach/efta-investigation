import type { Metadata } from "next"
import { TIER_CONFIG, REDACTION_CATEGORIES, type Tier } from "@efta/shared"
import { TierBadge } from "@/components/ui/tier-badge"

export const metadata: Metadata = {
  title: "About — EFTA Investigation Platform",
}

const REDACTION_DESCRIPTIONS: Record<string, string> = {
  A: "Protects victim identity, privacy, and safety. These redactions are legitimate under EFTA and should be preserved.",
  B: "Covers attorney-client privilege, grand jury material, and ongoing investigations. Legitimacy must be verified case-by-case.",
  C: "Protects institutional reputation or conceals government misconduct. Often violates EFTA Section 2(b) prohibition on embarrassment-based redactions.",
  D: "Conceals perpetrator identity or criminal conduct. No EFTA exemption permits this. Highest scrutiny required.",
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-display text-3xl font-semibold text-text-primary sm:text-4xl">
        About the EFTA Investigation Platform
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Systematic analysis of DOJ Epstein Files disclosures
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-text-secondary">
        {/* What This Is */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            What This Is
          </h2>
          <p>
            The EFTA Investigation Platform is a full-stack investigative
            research tool for analyzing the ~3.5 million pages of DOJ
            disclosures released pursuant to the{" "}
            <strong className="text-text-primary">
              Epstein Files Transparency Act (EFTA)
            </strong>
            . We systematically examine these documents to uncover operational
            patterns, evidence of prosecutorial failures, and accountability
            gaps that enabled decades of exploitation.
          </p>
          <p className="mt-3">
            This platform replaces manual spreadsheets and project files with a
            searchable, linked, visual database &mdash; making it possible to
            trace connections, build timelines, and surface evidence at scale.
          </p>
        </section>

        {/* How the Platform Works */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            How the Platform Works
          </h2>
          <p>
            Documents released by the DOJ are uploaded to the platform and
            processed through a multi-stage pipeline:
          </p>
          <ol className="mt-4 ml-5 list-decimal space-y-3">
            <li>
              <strong className="text-text-primary">Ingestion</strong> &mdash;
              PDFs are uploaded to cloud storage. Page counts, file sizes, and
              Bates numbers are recorded.
            </li>
            <li>
              <strong className="text-text-primary">Text Extraction</strong>{" "}
              &mdash; PyMuPDF extracts text content, and forensic metadata
              (PDF producer, creation dates, modification history) is captured.
            </li>
            <li>
              <strong className="text-text-primary">Classification</strong>{" "}
              &mdash; Each document is assigned a type (email, FBI 302,
              financial record, etc.) and severity level based on content
              analysis.
            </li>
            <li>
              <strong className="text-text-primary">Redaction Analysis</strong>{" "}
              &mdash; Redacted regions are detected page-by-page, categorized
              (A&ndash;D), and flagged when patterns suggest misuse.
            </li>
            <li>
              <strong className="text-text-primary">
                Entity Cross-Referencing
              </strong>{" "}
              &mdash; Named entities are matched against the curated entity
              database. Documents are linked to entities, events, and other
              documents.
            </li>
            <li>
              <strong className="text-text-primary">Human Review</strong>{" "}
              &mdash; High-value documents are reviewed by investigators with
              assistance from an AI copilot (Archer) that surfaces key entities,
              quotes, and connections.
            </li>
          </ol>
        </section>

        {/* How Entities Were Populated */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            How Entities Were Populated
          </h2>
          <p>
            The entity database was built through a combination of methods,
            with every record verified by human investigators:
          </p>
          <ul className="mt-4 ml-5 list-disc space-y-3">
            <li>
              <strong className="text-text-primary">Document Forensics</strong>{" "}
              &mdash; Manual extraction from court records, FBI 302 interview
              reports, flight logs, financial documents, and victim journals.
            </li>
            <li>
              <strong className="text-text-primary">
                AI-Assisted Analysis
              </strong>{" "}
              &mdash; Claude AI is used to parse lengthy documents, identify
              entity mentions, suggest relationships, and surface patterns
              across large document sets.
            </li>
            <li>
              <strong className="text-text-primary">Manual Curation</strong>{" "}
              &mdash; Every entity, tier assignment, connection, and evidence
              item is verified by human investigators before being committed to
              the database. AI suggestions require explicit approval.
            </li>
          </ul>
        </section>

        {/* Evidence Tier System */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            The Evidence Tier System
          </h2>
          <p>
            Entities are classified into{" "}
            <strong className="text-text-primary">
              six tiers based on evidence strength
            </strong>
            , not guilt. Presence in the database does not establish criminal
            conduct. These tiers help prioritize investigation and reflect the
            quality and volume of documentation:
          </p>
          <div className="mt-4 space-y-3">
            {([1, 2, 3, 4, 5, 6] as Tier[]).map((tier) => {
              const config = TIER_CONFIG[tier]
              return (
                <div
                  key={tier}
                  className="flex items-start gap-3 rounded-lg border border-border-default bg-surface p-4"
                >
                  <div className="shrink-0 pt-0.5">
                    <TierBadge tier={tier} />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">
                      {config.label}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {config.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Redaction Framework */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            The Redaction Framework
          </h2>
          <p>
            Redactions in DOJ documents are categorized into four types to
            identify potential misuse and prioritize review:
          </p>
          <div className="mt-4 space-y-3">
            {(Object.keys(REDACTION_CATEGORIES) as Array<keyof typeof REDACTION_CATEGORIES>).map(
              (cat) => {
                const config = REDACTION_CATEGORIES[cat]
                return (
                  <div
                    key={cat}
                    className="rounded-lg border border-border-default bg-surface p-4"
                    style={{ borderLeftWidth: "4px", borderLeftColor: config.color }}
                  >
                    <p className="font-semibold text-text-primary">
                      Category {cat}: {config.label}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {REDACTION_DESCRIPTIONS[cat]}
                    </p>
                  </div>
                )
              }
            )}
          </div>
        </section>

        {/* Data Sources */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            Data Sources
          </h2>
          <p>
            All documents on this platform are publicly released government
            records:
          </p>
          <ul className="mt-4 ml-5 list-disc space-y-3">
            <li>
              <strong className="text-text-primary">DOJ EFTA Releases</strong>{" "}
              &mdash; 12 datasets totaling ~3.5 million pages released pursuant
              to the Epstein Files Transparency Act. Dataset 11 alone contains
              331,655 individual PDFs.
            </li>
            <li>
              <strong className="text-text-primary">Court Records</strong>{" "}
              &mdash; Giuffre v. Maxwell filings, SDNY prosecution memos (US v.
              Epstein, 19 Cr. 490), and related court documents.
            </li>
            <li>
              <strong className="text-text-primary">Public Reporting</strong>{" "}
              &mdash; Investigative journalism from the Miami Herald, ProPublica,
              and other outlets that have contributed to public understanding of
              this case.
            </li>
          </ul>
        </section>

        {/* The Five Systems */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            The Five Systems
          </h2>
          <p>
            The investigation is organized around five operational systems that
            enabled the Epstein enterprise:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                name: "Recruitment Pipeline",
                desc: "Pyramid scheme model, channels via schools, agencies, existing victims",
              },
              {
                name: "Logistics Network",
                desc: "Aviation fleet, 6+ properties, 70-person staff infrastructure",
              },
              {
                name: "Financial Infrastructure",
                desc: "Wire payments, shell entities, estate transfers, victim settlements",
              },
              {
                name: "Protection Apparatus",
                desc: "2007 NPA / blanket immunity, prosecutorial failures, political access",
              },
              {
                name: "Inner Circle",
                desc: "97+ persons cataloged across 6 evidence tiers",
              },
            ].map((system) => (
              <div
                key={system.name}
                className="rounded-lg border border-border-default bg-surface p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {system.name}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {system.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Team & Credits */}
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-text-primary">
            Team &amp; Credits
          </h2>
          <p>
            This platform was designed and built by{" "}
            <strong className="text-text-primary">Cyclops Digital LLC</strong>{" "}
            as a research tool for investigative journalists, researchers, and
            advocates seeking accountability.
          </p>
          <p className="mt-3">
            Built with Next.js, React, Tailwind CSS, Supabase, Cloudflare R2,
            Python, and Claude AI.
          </p>
          <p className="mt-3 text-text-muted">
            Special thanks to the survivors who made their stories public, the
            investigative journalists who refused to look away, and the
            legislators who passed the EFTA to force transparency.
          </p>
        </section>
      </div>
    </div>
  )
}
