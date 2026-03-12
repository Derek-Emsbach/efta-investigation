import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theepsteincrimes.com'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all published content slugs in parallel
  const [entitiesResult, storiesResult, caseFilesResult] = await Promise.all([
    supabase
      .from('entities')
      .select('slug, updated_at')
      .eq('profile_published', true)
      .not('slug', 'is', null)
      .order('name'),

    supabase
      .from('stories')
      .select('slug, updated_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false }),

    supabase
      .from('case_files')
      .select('slug, updated_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false }),
  ])

  const entities = entitiesResult.data ?? []
  const stories = storiesResult.data ?? []
  const caseFiles = caseFilesResult.data ?? []

  const entries: MetadataRoute.Sitemap = [
    // Static pages
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/evidence`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/evidence/images`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/disclaimer`,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/network`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/stories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/entities`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/case-files`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/support`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: 'monthly',
      priority: 0.2,
    },

    // Entity profiles
    ...entities.map((e) => ({
      url: `${SITE_URL}/entities/${e.slug}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    // Stories
    ...stories.map((s) => ({
      url: `${SITE_URL}/stories/${s.slug}`,
      lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),

    // Case files
    ...caseFiles.map((cf) => ({
      url: `${SITE_URL}/case-files/${cf.slug}`,
      lastModified: cf.updated_at ? new Date(cf.updated_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]

  return entries
}
