'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { FilterBar, type FilterDef } from '@/components/ui/filter-bar'
import { DataTable, type Column } from '@/components/ui/data-table'
import { TierBadge } from '@/components/ui/tier-badge'
import { TIER_CONFIG } from '@efta/shared'
import type { Entity, Tier } from '@efta/shared'

const PAGE_SIZE = 25

const TIER_FILTER_OPTIONS = ([1, 2, 3, 4, 5, 6] as Tier[]).map((tier) => ({
  value: String(tier),
  label: `Tier ${tier}: ${TIER_CONFIG[tier].label}`,
}))

const CATEGORY_OPTIONS = [
  { value: 'abuser', label: 'Abuser' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'judge', label: 'Judge' },
  { value: 'prosecutor', label: 'Prosecutor' },
  { value: 'victim', label: 'Victim' },
  { value: 'staff', label: 'Staff' },
  { value: 'witness', label: 'Witness' },
  { value: 'recruiter', label: 'Recruiter' },
]

const TYPE_OPTIONS = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'trust', label: 'Trust' },
  { value: 'agency', label: 'Agency' },
]

const FILTER_DEFS: FilterDef[] = [
  { key: 'tier', label: 'Tiers', options: TIER_FILTER_OPTIONS },
  { key: 'category', label: 'Categories', options: CATEGORY_OPTIONS },
  { key: 'entity_type', label: 'Types', options: TYPE_OPTIONS },
]

interface EntityRow extends Record<string, unknown> {
  id: string
  name: string
  tier: Tier | null
  category: string | null
  status: string | null
  entity_type: string
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-text-muted">&mdash;</span>

  const colorMap: Record<string, string> = {
    convicted: 'bg-critical/10 text-critical',
    not_investigated: 'bg-warning/10 text-warning',
    settled: 'bg-info/10 text-info',
    identified: 'bg-text-secondary/10 text-text-secondary',
    deceased: 'bg-text-muted/10 text-text-muted',
    active: 'bg-success/10 text-success',
    unknown: 'bg-text-muted/10 text-text-muted',
  }

  return (
    <span
      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${colorMap[status] ?? 'bg-text-muted/10 text-text-muted'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const columns: Column<EntityRow>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    render: (row) => (
      <span className="font-display font-medium text-text-primary">{row.name}</span>
    ),
  },
  {
    key: 'tier',
    header: 'Tier',
    sortable: true,
    render: (row) =>
      row.tier ? <TierBadge tier={row.tier} /> : <span className="text-text-muted">&mdash;</span>,
  },
  {
    key: 'category',
    header: 'Category',
    sortable: true,
    render: (row) => (
      <span className="uppercase text-xs text-text-muted tracking-wider">
        {row.category ? row.category.replace(/_/g, ' ') : '\u2014'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'entity_type',
    header: 'Type',
    sortable: true,
    render: (row) => (
      <span className="text-xs text-text-secondary capitalize">{row.entity_type}</span>
    ),
  },
]

interface ApiResponse {
  data: Entity[]
  count: number
  page: number
  limit: number
}

export default function EntitiesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({
    tier: '',
    category: '',
    entity_type: '',
  })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<EntityRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEntities = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      if (search) params.set('search', search)
      if (filters.tier) params.set('tier', filters.tier)
      if (filters.category) params.set('category', filters.category)
      if (filters.entity_type) params.set('entity_type', filters.entity_type)

      const response = await fetch(`/api/entities?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch entities')
      }

      const result: ApiResponse = await response.json()
      const rows: EntityRow[] = result.data.map((entity) => ({
        id: entity.id,
        name: entity.name,
        tier: entity.tier,
        category: entity.category,
        status: entity.status,
        entity_type: entity.entity_type,
      }))
      setData(rows)
      setTotalCount(result.count)
    } catch {
      setData([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, filters])

  useEffect(() => {
    void fetchEntities()
  }, [fetchEntities])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleRowClick = useCallback(
    (row: EntityRow) => {
      router.push(`/entities/${row.id}`)
    },
    [router]
  )

  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <MainContent>
      <PageHeader
        title="Entities"
        subtitle="97+ persons, organizations, and properties identified across EFTA datasets"
      />

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <FilterBar filters={FILTER_DEFS} values={filters} onChange={handleFilterChange} />
        <SearchInput placeholder="Search entities by name..." onSearch={handleSearch} />
      </div>

      {/* Data Table */}
      <DataTable<EntityRow>
        columns={columns}
        data={data}
        onRowClick={handleRowClick}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-text-muted">
            Showing {rangeStart}&ndash;{rangeEnd} of {totalCount.toLocaleString()} entities
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm font-medium rounded border border-border-default bg-elevated text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-text-muted px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded border border-border-default bg-elevated text-text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </MainContent>
  )
}
