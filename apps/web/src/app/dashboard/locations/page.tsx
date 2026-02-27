'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { FilterBar, type FilterDef } from '@/components/ui/filter-bar'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { LocationSummaryCards } from '@/components/locations/location-summary-cards'
import type { Location } from '@efta/shared'

const PAGE_SIZE = 25

const TYPE_OPTIONS = [
  { value: 'property', label: 'Property' },
  { value: 'airport', label: 'Airport' },
  { value: 'office', label: 'Office' },
  { value: 'court', label: 'Court' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'school', label: 'School' },
  { value: 'other', label: 'Other' },
]

const FILTER_DEFS: FilterDef[] = [
  { key: 'location_type', label: 'Type', options: TYPE_OPTIONS },
]

interface LocationRow extends Record<string, unknown> {
  id: string
  name: string
  location_type: string | null
  city: string | null
  state: string | null
  country: string | null
  owner: { id: string; name: string } | null
  sighting_count: number
  entity_count: number
}

interface ApiResponse {
  data: (Location & { owner: { id: string; name: string } | null; sighting_count: number; entity_count: number })[]
  count: number
  page: number
  limit: number
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-text-muted">&mdash;</span>

  const colorMap: Record<string, string> = {
    property: 'bg-warning/10 text-warning',
    airport: 'bg-info/10 text-info',
    office: 'bg-text-secondary/10 text-text-secondary',
    court: 'bg-critical/10 text-critical',
    restaurant: 'bg-success/10 text-success',
    hotel: 'bg-info/10 text-info',
    school: 'bg-warning/10 text-warning',
    other: 'bg-text-muted/10 text-text-muted',
  }

  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded capitalize ${colorMap[type] ?? colorMap.other}`}>
      {type}
    </span>
  )
}

const columns: Column<LocationRow>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    render: (row) => (
      <span className="font-display font-medium text-text-primary">{row.name}</span>
    ),
  },
  {
    key: 'location_type',
    header: 'Type',
    sortable: true,
    render: (row) => <TypeBadge type={row.location_type} />,
  },
  {
    key: 'city',
    header: 'Location',
    sortable: true,
    render: (row) => {
      const parts = [row.city, row.state, row.country].filter(Boolean)
      return (
        <span className="text-xs text-text-secondary">
          {parts.length > 0 ? parts.join(', ') : '\u2014'}
        </span>
      )
    },
  },
  {
    key: 'owner',
    header: 'Owner',
    render: (row) => {
      const owner = row.owner as { id: string; name: string } | null
      return owner ? (
        <span className="text-xs text-text-secondary">{owner.name}</span>
      ) : (
        <span className="text-text-muted">&mdash;</span>
      )
    },
  },
  {
    key: 'sighting_count',
    header: 'Sightings',
    sortable: false,
    render: (row) => (
      <span className="text-xs font-medium text-text-primary">{row.sighting_count}</span>
    ),
  },
  {
    key: 'entity_count',
    header: 'Entities',
    sortable: false,
    render: (row) => (
      <span className="text-xs font-medium text-text-primary">{row.entity_count}</span>
    ),
  },
]

export default function LocationsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string | string[]>>({
    location_type: '',
  })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LocationRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLocations = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      if (search) params.set('search', search)
      if (filters.location_type && typeof filters.location_type === 'string') params.set('location_type', filters.location_type)

      const response = await fetch(`/api/locations?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch locations')

      const result: ApiResponse = await response.json()
      const rows: LocationRow[] = result.data.map((loc) => ({
        id: loc.id,
        name: loc.name,
        location_type: loc.location_type,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        owner: loc.owner,
        sighting_count: loc.sighting_count,
        entity_count: loc.entity_count,
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
    void fetchLocations()
  }, [fetchLocations])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleRowClick = useCallback(
    (row: LocationRow) => {
      router.push(`/dashboard/locations/${row.id}`)
    },
    [router]
  )

  return (
    <MainContent>
      <PageHeader
        title="Locations"
        subtitle="Properties, airports, offices, and other locations referenced in EFTA documents"
      />

      {/* Summary cards */}
      <LocationSummaryCards />

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <FilterBar filters={FILTER_DEFS} values={filters} onChange={handleFilterChange} />
        <SearchInput placeholder="Search locations by name, address, or city..." onSearch={handleSearch} />
      </div>

      {/* Data table */}
      <DataTable<LocationRow>
        columns={columns}
        data={data}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            }
            title="No locations found"
            description="No locations match your current filters. Try adjusting your search criteria."
          />
        }
      />

      <Pagination
        page={page}
        totalPages={Math.ceil(totalCount / PAGE_SIZE)}
        onPageChange={setPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        noun="locations"
      />
    </MainContent>
  )
}
