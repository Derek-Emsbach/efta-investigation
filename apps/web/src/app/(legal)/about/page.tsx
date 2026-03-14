import type { Metadata } from "next"
import Link from "next/link"
import { TIER_CONFIG, REDACTION_CATEGORIES, type Tier } from "@efta/shared"
import { TierBadge } from "@/components/ui/tier-badge"
import { ExpandableSection } from "@/components/ui/expandable-section"

export const metadata: Metadata = {
  title: "About This Investigation — The Epstein Crimes",
  description:
    "How we systematically analyze 3.5 million pages of DOJ Epstein Files releases. Our methodology, AI partnership model, and commitment to source-documented accountability.",
}

const REDACTION_DESCRIPTIONS: Record<string, string> = {
  A: "Protects victim identity, privacy, and safety. These redactions are legitimate under EFTA and should be preserved.",
  B: "Covers attorney-client privilege, grand jury material, and ongoing investigations. Legitimacy must be verified case-by-case.",
  C: "Protects institutional reputation or conceals government misconduct. Often violates EFTA Section 2(b) prohibition on embarrassment-based redactions.",
  D: "Conceals perpetrator identity or criminal conduct. No EFTA exemption permits this. Highest scrutiny required.",
}

const STATS = [
  { value: "~3.5M", label: "Pages Released", accent: true },
  { value: "1.37M+", label: "Documents Indexed", accent: false },
  { value: "115+", label: "Entities Tracked", accent: false },
  { value: "14", label: "Stories Published", accent: false },
  { value: "190+", label: "Source Citations", accent: false },
  { value: "44", label: "Open Questions", accent: false },
]

const PUBLICATIONS = [
  {
    title: "Investigative Stories",
    description:
      "Long-form reporting organized into four sections: The Cover-Up, The Network, Follow the Money, and The Operation. Each story is built on primary source documents with numbered citations you can verify.",
    stat: "14 published, 190+ citations",
    href: "/stories",
  },
  {
    title: "Case Files",
    description:
      "Structured investigation dossiers that track specific threads — from the 2007 non-prosecution agreement to financial networks. Each case file catalogs evidence, entities involved, and open questions still under investigation.",
    stat: "6 active, 44 open questions",
    href: "/case-files",
  },
  {
    title: "Entity Profiles",
    description:
      "Detailed dossiers on individuals and organizations connected to the Epstein network, classified by evidence strength — not guilt. Each profile links to source documents, known connections, and timeline events.",
    stat: "32 published, 115+ tracked",
    href: "/entities",
  },
  {
    title: "Evidence Room",
    description:
      "A public, searchable interface to the full document corpus. Full-text search across 1.37 million documents, an interactive network graph of entity connections, and a chronological timeline of events.",
    stat: "1.37M+ searchable documents",
    href: "/evidence",
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {/* 1. Hero / Mission Statement */}
      <h1 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">
        About This Investigation
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        An independent analysis of the largest document release in DOJ history
      </p>

      <div className="mt-10 space-y-14 text-sm leading-relaxed text-text-secondary">
        <section>
          <p>
            In late 2025, the{" "}
            <strong className="text-text-primary">
              Epstein Files Transparency Act (EFTA)
            </strong>{" "}
            compelled the Department of Justice to release approximately 3.5
            million pages of documents related to Jeffrey Epstein &mdash;
            spanning FBI interviews, financial records, flight logs, legal
            correspondence, and internal communications across twelve separate
            datasets.
          </p>
          <div className="mt-4 border-l-4 border-critical pl-4">
            <p>
              These documents reveal systematic failures: prosecutorial
              misconduct, institutional cover-ups, and an accountability gap
              that spans decades. This investigation exists to ensure those
              documents are not buried by their own volume &mdash; to read what
              was released, connect what was separated, and surface what was
              meant to stay hidden.
            </p>
          </div>
          <p className="mt-4">
            We are not a news organization. We are independent researchers
            building a structured, searchable, evidence-linked database from
            raw government disclosures &mdash; making it possible to trace
            connections, build timelines, and verify claims against primary
            sources at a scale that manual review cannot achieve.
          </p>
        </section>

        {/* 2. What We Publish */}
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">
            What We Publish
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PUBLICATIONS.map((pub) => (
              <div
                key={pub.title}
                className="rounded-lg border border-border-default bg-surface p-5"
              >
                <p className="font-display text-base font-semibold text-text-primary">
                  {pub.title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {pub.description}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-text-muted">{pub.stat}</span>
                  <Link
                    href={pub.href}
                    className="text-xs text-info transition-colors hover:underline"
                  >
                    Browse &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. By the Numbers */}
        <section>
          <div className="rounded-lg border border-border-default bg-surface p-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <p
                    className={`font-display text-2xl font-bold ${stat.accent ? "text-critical" : "text-text-primary"}`}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. How We Work — Human-AI Partnership */}
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">
            How We Work
          </h2>
          <div className="border-l-4 border-critical pl-4">
            <p className="font-semibold text-text-primary">
              AI helps us read 3.5 million pages. Humans make every judgment
              call.
            </p>
          </div>
          <p className="mt-4">
            This investigation uses{" "}
            <strong className="text-text-primary">Claude AI</strong> (Anthropic)
            as a research partner &mdash; not an autonomous decision-maker. AI
            assists with document analysis, research synthesis, and initial
            article drafting. The collaboration works across three layers:
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <p className="font-semibold text-text-primary">
                Document Processing
              </p>
              <p className="mt-1">
                AI-assisted classification, entity extraction, and redaction
                detection across the corpus. Documents are typed (FBI 302,
                email, financial record), severity-scored, and cross-referenced
                against the entity database. Every AI output is flagged for
                human review before it enters the database.
              </p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">
                Archer: Document Review Copilot
              </p>
              <p className="mt-1">
                When a human reviewer opens a document, Archer surfaces entity
                mentions, key quotes, and connections to other documents in the
                corpus. It highlights patterns the reviewer might miss across
                hundreds of pages &mdash; but the reviewer decides what matters
                and what gets recorded.
              </p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">
                Detective: Research Assistant
              </p>
              <p className="mt-1">
                A read-only AI assistant with access to the full database. It
                answers research questions, finds missed connections between
                entities, and surfaces patterns across thousands of documents.
                It can query but never modify the data.
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs text-text-muted">
            Every article is reviewed, fact-checked, and edited by the named
            editor before publication. Every factual claim is traced to a
            specific EFTA document identified by Bates number. AI suggestions
            require explicit approval before any database change. Articles are
            marked with an &ldquo;AI-Assisted&rdquo; indicator in their
            metadata.
          </p>
        </section>

        {/* 5. Methodology Reference (Expandable) */}
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">
            Methodology
          </h2>
          <div className="space-y-3">
            <ExpandableSection title="Evidence Tier System">
              <p className="mb-3 text-text-secondary">
                Entities are classified into six tiers based on evidence
                strength, not guilt. Presence in the database does not establish
                criminal conduct.
              </p>
              <div className="space-y-2">
                {([1, 2, 3, 4, 5, 6] as Tier[]).map((tier) => {
                  const config = TIER_CONFIG[tier]
                  return (
                    <div
                      key={tier}
                      className="flex items-start gap-3 rounded border border-border-default bg-background p-3"
                    >
                      <div className="shrink-0 pt-0.5">
                        <TierBadge tier={tier} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">
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
            </ExpandableSection>

            <ExpandableSection title="Redaction Framework">
              <p className="mb-3 text-text-secondary">
                Redactions in DOJ documents are categorized into four types to
                identify potential misuse and prioritize review.
              </p>
              <div className="space-y-2">
                {(
                  Object.keys(REDACTION_CATEGORIES) as Array<
                    keyof typeof REDACTION_CATEGORIES
                  >
                ).map((cat) => {
                  const config = REDACTION_CATEGORIES[cat]
                  return (
                    <div
                      key={cat}
                      className="rounded border border-border-default bg-background p-3"
                      style={{
                        borderLeftWidth: "4px",
                        borderLeftColor: config.color,
                      }}
                    >
                      <p className="text-xs font-semibold text-text-primary">
                        Category {cat}: {config.label}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {REDACTION_DESCRIPTIONS[cat]}
                      </p>
                    </div>
                  )
                })}
              </div>
            </ExpandableSection>

            <ExpandableSection title="Data Sources">
              <ul className="space-y-3 text-text-secondary">
                <li>
                  <strong className="text-text-primary">
                    DOJ EFTA Releases
                  </strong>{" "}
                  &mdash; 12 datasets totaling ~3.5 million pages released
                  pursuant to the Epstein Files Transparency Act.
                </li>
                <li>
                  <strong className="text-text-primary">Court Records</strong>{" "}
                  &mdash; Giuffre v. Maxwell filings, SDNY prosecution memos
                  (US v. Epstein, 19 Cr. 490), and related court documents.
                </li>
                <li>
                  <strong className="text-text-primary">
                    Public Reporting
                  </strong>{" "}
                  &mdash; Investigative journalism from the Miami Herald,
                  ProPublica, and other outlets.
                </li>
                <li>
                  <strong className="text-text-primary">
                    Research Databases
                  </strong>{" "}
                  &mdash; Community-built databases by{" "}
                  <a
                    href="https://github.com/rhowardstone/Epstein-research-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 transition-colors hover:text-text-primary"
                  >
                    rhowardstone
                  </a>{" "}
                  covering DOJ concordance metadata (1.38M docs), document
                  alteration records (212K change units), image analysis (92K
                  images), and handwriting analysis (54 pages).
                </li>
              </ul>
            </ExpandableSection>
          </div>
        </section>

        {/* 6. For Researchers & Journalists */}
        <section>
          <div className="rounded-lg border border-border-default bg-surface p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              For Researchers &amp; Journalists
            </h2>
            <ul className="mt-4 space-y-2 text-text-secondary">
              <li>
                The Evidence Room is publicly accessible &mdash; no account
                required to search documents, explore the network graph, or
                browse the timeline.
              </li>
              <li>
                Every claim in every story links to a source document with a
                Bates number you can independently verify.
              </li>
              <li>
                This data is available for independent research, journalism,
                academic study, and legal advocacy.
              </li>
              <li>
                Interested in collaborating or have information to share?
                Reach us at{" "}
                <a
                  href="mailto:info@cyclopsdigital.net"
                  className="text-info underline underline-offset-2 transition-colors hover:text-text-primary"
                >
                  info@cyclopsdigital.net
                </a>
              </li>
            </ul>
            <div className="mt-5">
              <Link
                href="/evidence"
                className="inline-flex items-center gap-2 border-2 border-text-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-primary transition-all hover:bg-text-primary hover:text-background"
              >
                Enter the Evidence Room &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* 7. Credits */}
        <section className="border-t border-border-default pt-8">
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">Derek Emsbach</strong>,
            Editor &mdash; responsible for editorial direction, fact-checking,
            and final review of all published content.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            This platform was designed and built by{" "}
            <strong className="text-text-secondary">Cyclops Digital LLC</strong>{" "}
            as a research tool for investigative journalists, researchers, and
            advocates seeking accountability.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            Special thanks to the survivors who made their stories public, the
            investigative journalists who refused to look away, and the
            legislators who passed the EFTA to force transparency.
          </p>
          <div className="mt-4 flex gap-4 text-xs text-text-muted">
            <Link
              href="/disclaimer"
              className="transition-colors hover:text-text-secondary"
            >
              Disclaimer
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-text-secondary"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-text-secondary"
            >
              Terms
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
