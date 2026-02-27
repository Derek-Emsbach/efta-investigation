import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — EFTA Investigation Platform",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-display text-3xl font-semibold text-text-primary">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Last updated: January 2025
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-secondary">
        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing and using the EFTA Investigation Platform
            (&quot;Platform&quot;), you agree to be bound by these Terms of Use.
            If you do not agree to these terms, you must not access or use the
            Platform. The Platform is operated by Cyclops Digital LLC
            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            2. Authorized Use
          </h2>
          <p>
            Access to the Platform is restricted to authorized users who have
            been granted credentials. You may not share your login credentials
            with any third party. You are responsible for all activity that
            occurs under your account. All access is logged for security
            purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            3. Permitted Use
          </h2>
          <p>The Platform may be used for:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-text-secondary">
            <li>
              Research and analysis of publicly released EFTA documents
            </li>
            <li>Investigative journalism and public accountability work</li>
            <li>Academic research and study</li>
            <li>Legal research in connection with related proceedings</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            4. Prohibited Use
          </h2>
          <p>You may not:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-text-secondary">
            <li>
              Redistribute, republish, or commercially exploit Platform content
              without written permission
            </li>
            <li>
              Attempt to identify protected victims or individuals whose
              information has been redacted
            </li>
            <li>
              Use Platform data to harass, threaten, or defame any individual
            </li>
            <li>
              Present entity tier classifications or analytical categories as
              legal findings or determinations of guilt
            </li>
            <li>
              Scrape, crawl, or use automated tools to extract data from the
              Platform
            </li>
            <li>
              Attempt to circumvent access controls, authentication mechanisms,
              or security features
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            5. Evidence-Based Analysis
          </h2>
          <p>
            The Platform presents evidence-based analysis of publicly available
            documents. All entity classifications, connections, and assessments
            are analytical interpretations based on source materials — they are
            not legal findings, accusations, or determinations of fact. Users
            must exercise their own judgment when interpreting Platform content
            and should independently verify information before relying on it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            6. Intellectual Property
          </h2>
          <p>
            The Platform&apos;s design, code, organization, analysis, and
            presentation are the intellectual property of Cyclops Digital LLC.
            Source documents referenced on the Platform are the property of the
            United States Government and were publicly released under the
            Epstein Files Transparency Act. Our analysis and presentation of
            these materials does not claim ownership of the underlying
            government records.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            7. Accuracy and Completeness
          </h2>
          <p>
            While we strive for accuracy, we do not warrant that Platform
            content is complete, current, or error-free. The EFTA document
            releases are ongoing, and our analysis evolves as new materials
            become available. Information may be updated, corrected, or revised
            at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            8. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, Cyclops Digital LLC shall
            not be liable for any direct, indirect, incidental, consequential,
            or punitive damages arising from your use of, or inability to use,
            the Platform. This includes but is not limited to damages for loss
            of data, revenue, or reputation.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            9. Indemnification
          </h2>
          <p>
            You agree to indemnify and hold harmless Cyclops Digital LLC, its
            officers, directors, employees, and agents from any claims,
            damages, or expenses arising from your use of the Platform or
            violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            10. Termination
          </h2>
          <p>
            We reserve the right to suspend or terminate your access to the
            Platform at any time, with or without cause, and with or without
            notice. Upon termination, your right to use the Platform ceases
            immediately.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            11. Modifications
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. Continued
            use of the Platform after changes are posted constitutes acceptance
            of the revised Terms. We encourage you to review these Terms
            periodically.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            12. Governing Law
          </h2>
          <p>
            These Terms are governed by and construed in accordance with the
            laws of the United States. Any disputes arising from these Terms or
            your use of the Platform shall be resolved in accordance with
            applicable law.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            13. Contact
          </h2>
          <p>
            For questions about these Terms, contact Cyclops Digital LLC.
          </p>
        </section>
      </div>
    </div>
  );
}
