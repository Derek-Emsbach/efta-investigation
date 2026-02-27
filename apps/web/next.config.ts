import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@efta/shared"],

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

export default nextConfig;
