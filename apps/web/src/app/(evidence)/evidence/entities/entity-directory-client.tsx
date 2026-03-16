'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { TierBadge } from '@/components/ui/tier-badge'
import { EntityPlaceholder } from '@/components/ui/entity-placeholder'
import type { Tier } from '@efta/shared'

interface PublicEntity {
  id: string
  name: string
  slug: string
  entity_type: string
  tier: number | null
  category: string | null
  bio: string | null
  status: string | null
  aliases: string[] | null
  datasets_appeared: number[] | null
  profile_image_url: string | null
}

const TIER_FILTERS = [1, 2, 3, 4, 5, 6] as const
const TYPE_FILTERS = ['person', 'organization', 'location'] as const

function formatLabel(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function EntityDirectoryClient() {
  const [entities, setEntities] = useState<PublicEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTiers, setActiveTiers] = useState<Set<number>>(new Set(TIER_FILTERS))
  const [activeType, setActiveType] = useState<string>('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/public/entities')
        if (!res.ok) return
        const json = await res.json()
        setEntities(json.entities ?? [])
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const toggleTier = useCallback((tier: number) => {
    setActiveTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (e.tier && !activeTiers.has(e.tier)) return false
      if (activeType && e.entity_type !== activeType) return false
      if (search) {
        const q = search.toLowerCase()
        const nameMatch = e.name.toLowerCase().includes(q)
        const aliasMatch = e.aliases?.some((a) => a.toLowerCase().includes(q))
        if (!nameMatch && !aliasMatch) return false
      }
      return true
    })
  }, [entities, activeTiers, activeType, search])

  return (
    <div className="min-h-[calc(100vh-120px)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Entity Directory
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {loading ? 'Loading...' : `${filtered.length} of ${entities.length} documented entities`}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or alias..."
              className="w-full bg-surface border border-border-default rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-critical/30 focus:border-critical transition-colors font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Tier filters */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-mono mr-1">TIER</span>
              {TIER_FILTERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => toggleTier(tier)}
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded border transition-colors font-mono ${
                    activeTiers.has(tier)
                      ? 'bg-critical/10 border-critical/30 text-critical'
                      : 'bg-surface border-border-default text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-mono mr-1">TYPE</span>
              <button
                onClick={() => setActiveType('')}
                className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
                  !activeType
                    ? 'bg-critical/10 border-critical/30 text-critical'
                    : 'bg-surface border-border-default text-text-muted hover:text-text-secondary'
                }`}
              >
                All
              </button>
              {TYPE_FILTERS.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(activeType === type ? '' : type)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
                    activeType === type
                      ? 'bg-critical/10 border-critical/30 text-critical'
                      : 'bg-surface border-border-default text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {formatLabel(type)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-14 bg-surface border border-border-default rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted font-mono text-sm">No entities match your filters</p>
          </div>
        )}

        {/* Entity table */}
        {!loading && filtered.length > 0 && (
          <div className="border border-border-default rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px] sm:grid-cols-[1fr_100px_100px_120px] gap-4 px-4 py-2.5 bg-elevated/50 border-b border-border-default text-xs font-mono text-text-muted uppercase tracking-wider">
              <span>Name</span>
              <span className="hidden sm:block">Type</span>
              <span>Tier</span>
              <span className="hidden sm:block">Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border-default">
              {filtered.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/evidence/entities/${entity.slug}`}
                  className="grid grid-cols-[1fr_80px] sm:grid-cols-[1fr_100px_100px_120px] gap-4 px-4 py-3 hover:bg-elevated/30 transition-colors group items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {entity.profile_image_url ? (
                      <div className="w-7 h-7 border border-border-default overflow-hidden shrink-0 relative rounded-sm">
                        <Image
                          src={entity.profile_image_url}
                          alt=""
                          fill
                          sizes="28px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <EntityPlaceholder
                        name={entity.name}
                        entityType={entity.entity_type}
                        size={28}
                        className="border border-border-default rounded-sm"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate group-hover:text-critical transition-colors">
                        {entity.name}
                      </p>
                      {entity.bio && (
                        <p className="text-xs text-text-muted truncate mt-0.5">{entity.bio}</p>
                      )}
                    </div>
                  </div>
                  <span className="hidden sm:block text-xs text-text-secondary font-mono">
                    {formatLabel(entity.entity_type)}
                  </span>
                  <span>
                    {entity.tier && <TierBadge tier={entity.tier as Tier} size="sm" />}
                  </span>
                  <span className={`hidden sm:block text-xs font-mono ${
                    entity.status === 'confirmed' ? 'text-neon-green' :
                    entity.status === 'under_investigation' ? 'text-neon-blue' :
                    'text-text-muted'
                  }`}>
                    {entity.status ? formatLabel(entity.status) : '—'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
