'use client'

import { useCallback, useEffect, useState } from 'react'
import { StoryCard } from '@/components/dashboard/stories/story-card'
import type { EditorialStatus, StorySection } from '@efta/shared'

interface StoryListItem {
  id: string
  slug: string
  title: string
  deck: string | null
  section: StorySection | null
  byline: string
  reading_time_minutes: number | null
  hero_image_url: string | null
  editorial_status: EditorialStatus
  editorial_notes: string | null
  updated_at: string
  published_at: string | null
  entity_count: number
  citation_count: number
  word_count: number
}

type Tab = 'review' | 'draft' | 'published'

export default function MyDeskPage() {
  const [stories, setStories] = useState<StoryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('review')

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/stories')
      if (!res.ok) throw new Error('Failed to fetch stories')
      const data = await res.json()
      setStories(data.stories ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  const handleStatusChange = async (id: string, action: 'publish' | 'unpublish' | 'review') => {
    try {
      let url: string
      let method = 'POST'
      let body: string | undefined

      if (action === 'publish') {
        url = `/api/stories/${id}/publish`
      } else if (action === 'unpublish') {
        url = `/api/stories/${id}/unpublish`
      } else {
        url = `/api/stories/${id}`
        method = 'PATCH'
        body = JSON.stringify({ editorial_status: 'review' })
      }

      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })

      if (!res.ok) throw new Error('Action failed')

      await fetchStories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const filtered = stories.filter((s) => s.editorial_status === activeTab)

  const counts = {
    review: stories.filter((s) => s.editorial_status === 'review').length,
    draft: stories.filter((s) => s.editorial_status === 'draft').length,
    published: stories.filter((s) => s.editorial_status === 'published').length,
  }

  const missingHero = stories.filter((s) => !s.hero_image_url && s.editorial_status === 'published').length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'review', label: 'Review', count: counts.review },
    { key: 'draft', label: 'Drafts', count: counts.draft },
    { key: 'published', label: 'Published', count: counts.published },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-mono text-lg font-bold tracking-wide text-text-primary">My Desk</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Review, edit, and publish stories
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-4 flex items-center gap-4 text-[10px] font-mono text-text-muted">
        <span>{counts.review} in review</span>
        <span className="text-border-default">|</span>
        <span>{counts.draft} drafts</span>
        <span className="text-border-default">|</span>
        <span>{counts.published} published</span>
        {missingHero > 0 && (
          <>
            <span className="text-border-default">|</span>
            <span className="text-warning">{missingHero} missing hero images</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border-default mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-mono transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'border-critical text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-[10px] text-text-muted">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-text-muted border-t-critical" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <p className="text-sm">
            {activeTab === 'review' ? 'No stories awaiting review' :
             activeTab === 'draft' ? 'No draft stories' :
             'No published stories'}
          </p>
          <p className="text-xs mt-1">
            {activeTab === 'review' ? 'Seed stories with --draft flag to add them here' :
             activeTab === 'published' ? 'Click "Edit" on any story to open the editor' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
