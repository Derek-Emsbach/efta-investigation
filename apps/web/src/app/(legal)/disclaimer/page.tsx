import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer — EFTA Investigation Platform",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-display text-3xl font-semibold text-text-primary">
        Disclaimer
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Last updated: January 2025
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-secondary">
        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Purpose of This Platform
          </h2>
          <p>
            The EFTA Investigation Platform is a research and analysis tool
            developed by Cyclops Digital LLC for the systematic examination of
            documents released by the U.S. Department of Justice pursuant to the
            Epstein Files Transparency Act (EFTA). This platform is designed to
            organize, cross-reference, and analyze publicly available records to
            support investigative journalism and public accountability research.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Presumption of Innocence
          </h2>
          <p>
            All individuals referenced on this platform are presumed innocent
            unless and until proven guilty in a court of law. The inclusion of
            any person&apos;s name, image, or information on this platform does
            not imply guilt, criminal conduct, or wrongdoing of any kind. Entity
            classifications and tier assignments reflect the strength and volume
            of publicly available evidence — they are analytical categories, not
            determinations of culpability.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Nature of Information
          </h2>
          <p>
            The information presented on this platform is compiled from publicly
            released government documents, court records, and other
            publicly available sources. While every effort is made to ensure
            accuracy, the platform&apos;s content represents analytical
            interpretations and compilations of source material — not
            independent findings of fact.
          </p>
          <p className="mt-2">
            Allegations, claims, and statements referenced in documents are
            attributed to their sources and should not be treated as established
            facts. The distinction between documented evidence, alleged
            connections, and circumstantial information is maintained throughout
            the platform through evidence strength classifications.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Entity Tier Classifications
          </h2>
          <p>
            Entities on this platform are organized into tiers (1–6) based on
            the strength, volume, and nature of publicly available evidence
            connecting them to the subject matter. These tiers are analytical
            tools for research prioritization and do not represent legal
            conclusions, accusations, or determinations of guilt. A higher tier
            reflects greater evidentiary documentation, not greater culpability.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Victim Privacy
          </h2>
          <p>
            This platform takes victim privacy seriously. Information about
            victims and survivors is restricted and only displayed when the
            individual has made their identity publicly known. Redacted
            information is preserved as redacted. Users must not attempt to
            identify protected individuals.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Not Legal Advice
          </h2>
          <p>
            Nothing on this platform constitutes legal advice, legal analysis,
            or a legal opinion. The platform is a research tool, not a legal
            resource. Users should consult qualified legal professionals for any
            legal questions arising from the information presented here.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Limitation of Liability
          </h2>
          <p>
            Cyclops Digital LLC provides this platform on an &quot;as is&quot;
            basis without warranties of any kind, express or implied. Cyclops
            Digital LLC shall not be liable for any damages arising from the use
            of, or reliance on, information presented on this platform. Users
            are responsible for independently verifying any information before
            acting upon it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Source Materials
          </h2>
          <p>
            Source documents referenced on this platform are the property of
            the United States Government and were released under the Epstein
            Files Transparency Act. The platform&apos;s organization, analysis,
            and presentation of these materials is the intellectual property of
            Cyclops Digital LLC.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            Contact
          </h2>
          <p>
            For questions about this disclaimer or the platform, contact Cyclops
            Digital LLC.
          </p>
        </section>
      </div>
    </div>
  );
}
