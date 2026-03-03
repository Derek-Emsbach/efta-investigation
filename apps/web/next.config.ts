import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  transpilePackages: ["@efta/shared"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },

  async redirects() {
    return [
      // Dashboard-only paths — permanent redirects from old URLs
      ...[
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
        '/network',
        '/investigations',
        '/locations',
        '/search',
      ].map((path) => ({
        source: `${path}/:path*`,
        destination: `/dashboard${path}/:path*`,
        permanent: true,
      })),
      // Also redirect the bare paths (without trailing subpaths)
      ...[
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
        '/network',
        '/investigations',
        '/locations',
        '/search',
      ].map((path) => ({
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
