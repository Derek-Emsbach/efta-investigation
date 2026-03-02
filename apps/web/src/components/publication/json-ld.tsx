/**
 * JSON-LD structured data components for SEO.
 * Renders invisible <script type="application/ld+json"> tags.
 */

interface ArticleJsonLdProps {
  title: string
  description: string
  datePublished?: string
  dateModified?: string
  authorName?: string
  section?: string
  slug: string
}

export function ArticleJsonLd({
  title,
  description,
  datePublished,
  dateModified,
  authorName,
  section,
  slug,
}: ArticleJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theepsteincrimes.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    ...(authorName && {
      author: { '@type': 'Person', name: authorName },
    }),
    ...(section && { articleSection: section }),
    publisher: {
      '@type': 'Organization',
      name: 'The Epstein Crimes',
      url: siteUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/stories/${slug}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

interface PersonJsonLdProps {
  name: string
  description?: string
  slug: string
}

export function PersonJsonLd({ name, description, slug }: PersonJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theepsteincrimes.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    ...(description && { description }),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/entities/${slug}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export function DatasetJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theepsteincrimes.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'EFTA Document Archive',
    description:
      'Complete archive of documents released under the Epstein Files Transparency Act. 1.38 million documents across 12 DOJ dataset releases.',
    url: `${siteUrl}/evidence`,
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    creator: {
      '@type': 'Organization',
      name: 'U.S. Department of Justice',
    },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: `${siteUrl}/evidence`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
