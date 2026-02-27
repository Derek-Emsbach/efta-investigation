import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — EFTA Investigation Platform",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-display text-3xl font-semibold text-text-primary">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Last updated: January 2025
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-secondary">
        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            1. Introduction
          </h2>
          <p>
            This Privacy Policy describes how Cyclops Digital LLC
            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses,
            and protects information when you use the EFTA Investigation
            Platform (&quot;Platform&quot;). We are committed to protecting your
            privacy and handling your data responsibly.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            2. Information We Collect
          </h2>
          <h3 className="mb-1 mt-3 text-sm font-medium text-text-primary">
            Account Information
          </h3>
          <p>
            When your account is created, we collect your email address and
            authentication credentials. Accounts are created by administrators
            — there is no self-registration.
          </p>

          <h3 className="mb-1 mt-3 text-sm font-medium text-text-primary">
            Usage Data
          </h3>
          <p>
            We automatically collect information about your use of the Platform,
            including: pages visited, search queries, documents viewed, features
            used, timestamps of activity, and IP addresses. This data is used
            for security monitoring and platform improvement.
          </p>

          <h3 className="mb-1 mt-3 text-sm font-medium text-text-primary">
            Research Activity
          </h3>
          <p>
            Interactions with the AI research assistant (Detective) are logged,
            including queries, conversations, and suggested actions. This data
            is stored to maintain conversation history and improve research
            capabilities.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            3. How We Use Your Information
          </h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Authenticating your identity and managing access</li>
            <li>Providing and improving Platform functionality</li>
            <li>Maintaining security and detecting unauthorized access</li>
            <li>Preserving research session history</li>
            <li>Generating anonymized usage analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            4. Data Sharing
          </h2>
          <p>
            We do not sell, rent, or share your personal information with third
            parties for marketing purposes. Your data may be shared only in the
            following circumstances:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <span className="font-medium text-text-primary">
                Service providers:
              </span>{" "}
              We use Supabase for database and authentication services, and
              Cloudflare for document storage and delivery. These providers
              process data on our behalf under their respective privacy policies.
            </li>
            <li>
              <span className="font-medium text-text-primary">
                AI processing:
              </span>{" "}
              Research assistant queries are processed through Anthropic&apos;s
              Claude API. Query content is sent to Anthropic for processing and
              is subject to Anthropic&apos;s data usage policies.
            </li>
            <li>
              <span className="font-medium text-text-primary">
                Legal requirements:
              </span>{" "}
              We may disclose information if required by law, subpoena, or
              government request.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            5. Data Storage and Security
          </h2>
          <p>
            Your data is stored on secure servers provided by Supabase (database
            and authentication) and Cloudflare R2 (document storage). We
            implement appropriate technical and organizational measures to
            protect your data, including encryption in transit (TLS), row-level
            security policies, and access logging.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            6. Cookies and Session Data
          </h2>
          <p>
            The Platform uses essential cookies for authentication session
            management only. We do not use advertising cookies, tracking pixels,
            or third-party analytics cookies. Your session cookie is necessary
            for the Platform to function and expires when you log out or after a
            period of inactivity.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            7. Data Retention
          </h2>
          <p>
            Account information is retained for the duration of your account.
            Usage logs and research activity are retained for security and
            research continuity purposes. Upon account deletion, your personal
            data will be removed, though anonymized usage data may be retained.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            8. Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Request access to your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact Cyclops Digital LLC.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of significant changes by updating the &quot;Last updated&quot;
            date. Continued use of the Platform after changes are posted
            constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text-primary">
            10. Contact
          </h2>
          <p>
            For privacy-related questions or requests, contact Cyclops Digital
            LLC.
          </p>
        </section>
      </div>
    </div>
  );
}
