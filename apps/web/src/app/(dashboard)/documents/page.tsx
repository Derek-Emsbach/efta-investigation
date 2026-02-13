'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { FilterBar, type FilterDef } from '@/components/ui/filter-bar'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { SeverityMarker } from '@/components/ui/severity-marker'
import { SeveritySummaryBlocks } from '@/components/documents/severity-summary-blocks'
import type { Document, Severity, ProcessingStatus } from '@efta/shared'

const PAGE_SIZE = 25

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'fbi_302', label: 'FBI 302' },
  { value: 'financial', label: 'Financial' },
  { value: 'photo', label: 'Photo' },
  { value: 'memo', label: 'Memo' },
  { value: 'prosecution_memo', label: 'Prosecution Memo' },
  { value: 'court_filing', label: 'Court Filing' },
  { value: 'victim_journal', label: 'Victim Journal' },
  { value: 'senate_letter', label: 'Senate Letter' },
  { value: 'legal_report', label: 'Legal Report' },
  { value: 'call_notes', label: 'Call Notes' },
  { value: 'blank', label: 'Blank' },
]

const SEVERITY_OPTIONS = [
  { value: 'extreme_critical', label: 'Extreme Critical' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'routine', label: 'Routine' },
]

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'extracted', label: 'Extracted' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'published', label: 'Published' },
]

const FILTER_DEFS: FilterDef[] = [
  { key: 'document_type', label: 'Document Types', options: DOCUMENT_TYPE_OPTIONS },
  { key: 'severity', label: 'Severity', options: SEVERITY_OPTIONS },
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
]

interface DocumentRow extends Record<string, unknown> {
  id: string
  bates_number: string | null
  document_type: string | null
  original_date: string | null
  severity: Severity | null
  page_count: number | null
  processing_status: ProcessingStatus
}

function ProcessingStatusBadge({ status }: { status: ProcessingStatus }) {
  const colorMap: Record<ProcessingStatus, string> = {
    queued: 'bg-text-muted/10 text-text-muted',
    processing: 'bg-info/10 text-info',
    extracted: 'bg-info/10 text-info',
    needs_review: 'bg-warning/10 text-warning',
    reviewed: 'bg-success/10 text-success',
    published: 'bg-success/10 text-success',
    failed: 'bg-critical/10 text-critical',
  }

  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${colorMap[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const columns: Column<DocumentRow>[] = [
  {
    key: 'bates_number',
    header: 'Bates #',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-sm text-text-primary">
        {row.bates_number ?? '\u2014'}
      </span>
    ),
  },
  {
    key: 'document_type',
    header: 'Type',
    sortable: true,
    render: (row) =>
      row.document_type ? (
        <span className="inline-flex text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-elevated text-text-secondary">
          {row.document_type.replace(/_/g, ' ')}
        </span>
      ) : (
        <span className="text-text-muted">&mdash;</span>
      ),
  },
  {
    key: 'original_date',
    header: 'Date',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-text-secondary">{formatDate(row.original_date)}</span>
    ),
  },
  {
    key: 'severity',
    header: 'Severity',
    sortable: true,
    render: (row) =>
      row.severity ? (
        <SeverityMarker severity={row.severity} />
      ) : (
        <span className="text-text-muted">&mdash;</span>
      ),
  },
  {
    key: 'page_count',
    header: 'Pages',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-text-muted">
        {row.page_count !== null ? row.page_count : '\u2014'}
      </span>
    ),
  },
  {
    key: 'processing_status',
    header: 'Status',
    sortable: true,
    render: (row) => <ProcessingStatusBadge status={row.processing_status} />,
  },
]

interface ApiResponse {
  data: Document[]
  count: number
  page: number
  limit: number
}

export default function DocumentsPage() {
  const router = useRouter()
  const urlParams = useSearchParams()
  const datasetFilter = urlParams.get('dataset') ?? ''
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string | string[]>>({
    document_type: '',
    severity: '',
    status: '',
  })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DocumentRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      if (search) params.set('search', search)
      if (datasetFilter) params.set('dataset_id', datasetFilter)
      if (filters.document_type && typeof filters.document_type === 'string') params.set('document_type', filters.document_type)
      if (filters.severity && typeof filters.severity === 'string') params.set('severity', filters.severity)
      if (filters.status && typeof filters.status === 'string') params.set('status', filters.status)

      const response = await fetch(`/api/documents?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }

      const result: ApiResponse = await response.json()
      const rows: DocumentRow[] = result.data.map((doc) => ({
        id: doc.id,
        bates_number: doc.bates_number,
        document_type: doc.document_type,
        original_date: doc.original_date,
        severity: doc.severity,
        page_count: doc.page_count,
        processing_status: doc.processing_status,
      }))
      setData(rows)
      setTotalCount(result.count)
    } catch {
      setData([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, filters, datasetFilter])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const handleRowClick = useCallback(
    (row: DocumentRow) => {
      router.push(`/documents/${row.id}`)
    },
    [router]
  )

  return (
    <MainContent>
      <PageHeader
        title="Documents"
        subtitle="Source documents from EFTA dataset releases, indexed and classified by severity"
      />

      {/* Severity summary blocks */}
      <SeveritySummaryBlocks />

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <FilterBar filters={FILTER_DEFS} values={filters} onChange={handleFilterChange} />
        <SearchInput placeholder="Search documents by content or bates number..." onSearch={handleSearch} />
      </div>

      {/* Data Table */}
      <DataTable<DocumentRow>
        columns={columns}
        data={data}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
            title="No documents found"
            description="No documents match your current filters. Try broadening your search criteria."
          />
        }
      />

      <Pagination
        page={page}
        totalPages={Math.ceil(totalCount / PAGE_SIZE)}
        onPageChange={setPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        noun="documents"
      />
    </MainContent>
  )
}
