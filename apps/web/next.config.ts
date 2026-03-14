import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  transpilePackages: ["@efta/shared"],
  serverExternalPackages: ["better-sqlite3"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },

  async redirects() {
    // Paths that are dashboard-only — redirect bare URLs to /dashboard/*
    // NOTE: /network is NOT here because (publication)/network is a public page
    const dashboardOnlyPaths = [
      '/upload',
      '/processing',
      '/review',
      '/assistant',
      '/admin',
      '/settings',
      '/forensics',
      '/hierarchy',
      '/datasets',
      '/photos',
      '/investigations',
      '/locations',
    ]
    return [
      ...dashboardOnlyPaths.map((path) => ({
        source: `${path}/:path*`,
        destination: `/dashboard${path}/:path*`,
        permanent: true,
      })),
      ...dashboardOnlyPaths.map((path) => ({
        source: path,
        destination: `/dashboard${path}`,
        permanent: true,
      })),
    ]
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Suppress source map upload warnings when no auth token is set
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Only upload source maps when auth token is available
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Disable Sentry telemetry
  telemetry: false,
});
