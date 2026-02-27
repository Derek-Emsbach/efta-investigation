import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theepsteinrecord.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/entities/', '/stories/', '/case-files/', '/evidence/', '/about', '/disclaimer', '/privacy', '/terms'],
        disallow: ['/dashboard/', '/api/', '/login'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
