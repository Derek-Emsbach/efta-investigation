'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as d3 from 'd3'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import { TierBadge } from '@/components/ui/tier-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { TIER_LABELS, type Tier } from '@efta/shared'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  slug: string | null
  entity_type: string
  tier: Tier | null
  category: string | null
  status: string | null
  bio: string | null
  profile_image_url: string | null
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  id: string
  entity_a: string
  entity_b: string
  relationship_type: string
  evidence_strength: string | null
  description: string | null
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

type ViewMode = 'graph' | 'table'
type LayoutMode = 'force' | 'radial'
type SortKey = 'entity_a' | 'entity_b' | 'relationship' | 'strength'
type SortDir = 'asc' | 'desc'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const TIER_COLORS: Record<number, string> = {
  1: '#DC2626',
  2: '#F59E0B',
  3: '#F97316',
  4: '#6B7280',
  5: '#14B8A6',
  6: '#64748B',
}

const DEFAULT_COLOR = '#4B5563'

const STRENGTH_OPACITY: Record<string, number> = {
  documented: 0.8,
  alleged: 0.5,
  circumstantial: 0.3,
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  employed_by: 'Employed by',
  trafficked_by: 'Trafficked by',
  trafficked_for: 'Trafficked for',
  represented_by: 'Represented by',
  investigated_by: 'Investigated by',
  paid_by: 'Paid by',
  connected_to: 'Connected to',
  family_of: 'Family of',
  victim_of: 'Victim of',
  attorney_for: 'Attorney for',
  hired_by: 'Hired by',
  referred_by: 'Referred by',
  subsidiary_of: 'Subsidiary of',
  owned_by: 'Owned by',
  co_accused: 'Co-accused',
  financial: 'Financial',
  social: 'Social',
  professional: 'Professional',
  associated_with: 'Associated with',
  protected_by: 'Protected by',
}

const STRENGTH_COLORS: Record<string, string> = {
  documented: '#10B981',
  alleged: '#F59E0B',
  circumstantial: '#6B7280',
}

const STATUS_LABELS: Record<string, string> = {
  convicted: 'Convicted',
  settled: 'Settled',
  not_investigated: 'Not Investigated',
  identified: 'Identified',
  deceased: 'Deceased',
  active: 'Active',
  unknown: 'Unknown',
  immunized: 'Immunized',
}

// Edge colors by relationship category (dashboard palette)
type EdgeCategory = 'criminal' | 'financial' | 'legal' | 'personal' | 'other'

const EDGE_CATEGORY_MAP: Record<string, EdgeCategory> = {
  co_accused: 'criminal',
  trafficked_by: 'criminal',
  trafficked_for: 'criminal',
  financial: 'financial',
  employed_by: 'financial',
  hired_by: 'financial',
  paid_by: 'financial',
  attorney_for: 'legal',
  investigated_by: 'legal',
  protected_by: 'legal',
  referred_by: 'legal',
  family_of: 'personal',
  social: 'personal',
  associated_with: 'other',
  professional: 'other',
  connected_to: 'other',
}

const EDGE_CATEGORY_COLORS: Record<EdgeCategory, string> = {
  criminal: '#DC2626',
  financial: '#10B981',
  legal: '#3B82F6',
  personal: '#8B5CF6',
  other: '#6B7280',
}

const EDGE_CATEGORY_LABELS: Record<EdgeCategory, string> = {
  criminal: 'Criminal',
  financial: 'Financial',
  legal: 'Legal',
  personal: 'Personal',
  other: 'Other',
}

// Cluster positions by entity category
type ClusterGroup = 'inner_circle' | 'financial' | 'legal_political' | 'operations' | 'peripheral'

const CATEGORY_CLUSTER: Record<string, ClusterGroup> = {
  'co-conspirator': 'inner_circle',
  associate: 'inner_circle',
  'inner-circle': 'inner_circle',
  financier: 'financial',
  financial_institution: 'financial',
  trust: 'financial',
  shell_company: 'financial',
  bank: 'financial',
  attorney: 'legal_political',
  prosecutor: 'legal_political',
  politician: 'legal_political',
  government: 'legal_political',
  'law-enforcement': 'legal_political',
  recruiter: 'operations',
  staff: 'operations',
  pilot: 'operations',
  property: 'operations',
  employee: 'operations',
}

function getClusterGroup(category: string | null): ClusterGroup {
  if (!category) return 'peripheral'
  return CATEGORY_CLUSTER[category] ?? 'peripheral'
}

function getEdgeColor(type: string): string {
  const cat = EDGE_CATEGORY_MAP[type] ?? 'other'
  return EDGE_CATEGORY_COLORS[cat]
}

function getEdgeCategory(type: string): EdgeCategory {
  return EDGE_CATEGORY_MAP[type] ?? 'other'
}

function shouldShowPhoto(d: GraphNode, selectedId: string | null, connectedIds: Set<string>): boolean {
  if (!d.profile_image_url) return false
  if ((d.tier ?? 6) <= 2) return true
  if (d.id === selectedId || connectedIds.has(d.id)) return true
  return false
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function NetworkClient() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force')
  const [showLegend, setShowLegend] = useState(true)

  // Filter state (shared between views)
  const [activeTiers, setActiveTiers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]))
  const [activeRelationships, setActiveRelationships] = useState<Set<string>>(new Set())
  const [activeStrengths, setActiveStrengths] = useState<Set<string>>(
    new Set(['documented', 'alleged', 'circumstantial']),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Path-finding state (graph view only)
  const [showPathFinder, setShowPathFinder] = useState(false)
  const [pathFrom, setPathFrom] = useState<string | null>(null)
  const [pathTo, setPathTo] = useState<string | null>(null)
  const [pathFromSearch, setPathFromSearch] = useState('')
  const [pathToSearch, setPathToSearch] = useState('')

  // Table sort state
  const [sortKey, setSortKey] = useState<SortKey>('entity_a')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Escape key to deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNodeId(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Initialize relationship filter options from data
  useEffect(() => {
    if (data && activeRelationships.size === 0) {
      const types = new Set(data.edges.map((e) => e.relationship_type))
      setActiveRelationships(types)
    }
  }, [data, activeRelationships.size])

  // Fetch graph data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/network')
        if (!res.ok) throw new Error('Failed to load')
        const json: GraphData = await res.json()
        setData(json)
      } catch {
        setData({ nodes: [], edges: [] })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  // Track container size (graph view only)
  useEffect(() => {
    if (viewMode !== 'graph') return
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        if (width > 0) {
          setDimensions({ width, height: Math.max(600, Math.min(width * 0.7, 800)) })
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [viewMode])

  // Derive relationship types from data for filter UI
  const relationshipTypes = useMemo(() => {
    if (!data) return []
    const types = new Set(data.edges.map((e) => e.relationship_type))
    return Array.from(types).sort()
  }, [data])

  // Derive tier counts from data for filter UI
  const tierCounts = useMemo(() => {
    if (!data) return new Map<number, number>()
    const counts = new Map<number, number>()
    for (const node of data.nodes) {
      const tier = node.tier ?? 0
      counts.set(tier, (counts.get(tier) ?? 0) + 1)
    }
    return counts
  }, [data])

  // Client-side filtered data
  const filteredData = useMemo(() => {
    if (!data) return null

    const filteredNodes = data.nodes.filter((n) => activeTiers.has(n.tier ?? 0))
    const nodeIds = new Set(filteredNodes.map((n) => n.id))

    const filteredEdges = data.edges.filter((e) => {
      if (!nodeIds.has(e.entity_a) || !nodeIds.has(e.entity_b)) return false
      if (!activeRelationships.has(e.relationship_type)) return false
      if (!activeStrengths.has(e.evidence_strength ?? 'circumstantial')) return false
      return true
    })

    const connectedIds = new Set<string>()
    for (const e of filteredEdges) {
      connectedIds.add(e.entity_a)
      connectedIds.add(e.entity_b)
    }
    const visibleNodes = filteredNodes.filter((n) => connectedIds.has(n.id))

    return { nodes: visibleNodes, edges: filteredEdges }
  }, [data, activeTiers, activeRelationships, activeStrengths])

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !data) return []
    const q = searchQuery.toLowerCase()
    return data.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 8)
  }, [searchQuery, data])

  // Compute shortest path
  const pathResult = useMemo(() => {
    if (!pathFrom || !pathTo || !data) return null
    return findShortestPath(data.edges, pathFrom, pathTo)
  }, [pathFrom, pathTo, data])

  // Path search matches
  const pathFromMatches = useMemo(() => {
    if (!pathFromSearch.trim() || !data) return []
    return data.nodes.filter((n) => n.name.toLowerCase().includes(pathFromSearch.toLowerCase())).slice(0, 6)
  }, [pathFromSearch, data])

  const pathToMatches = useMemo(() => {
    if (!pathToSearch.trim() || !data) return []
    return data.nodes.filter((n) => n.name.toLowerCase().includes(pathToSearch.toLowerCase())).slice(0, 6)
  }, [pathToSearch, data])

  // Entity summary for selection panel
  const selectedEntitySummary = useMemo(() => {
    if (!selectedNodeId || !filteredData) return null
    const node = filteredData.nodes.find((n) => n.id === selectedNodeId)
    if (!node) return null

    const connectedEdges = filteredData.edges.filter(
      (e) => e.entity_a === selectedNodeId || e.entity_b === selectedNodeId,
    )

    const categoryCounts: Record<EdgeCategory, number> = { criminal: 0, financial: 0, legal: 0, personal: 0, other: 0 }
    for (const e of connectedEdges) {
      const cat = getEdgeCategory(e.relationship_type)
      categoryCounts[cat]++
    }

    const connectedNodes = connectedEdges
      .map((e) => {
        const otherId = e.entity_a === selectedNodeId ? e.entity_b : e.entity_a
        return filteredData.nodes.find((n) => n.id === otherId)
      })
      .filter((n): n is GraphNode => n != null)
      .sort((a, b) => {
        const tierDiff = (a.tier ?? 6) - (b.tier ?? 6)
        return tierDiff !== 0 ? tierDiff : a.name.localeCompare(b.name)
      })

    return { node, connectedEdges, categoryCounts, connectedNodes, totalConnections: connectedEdges.length }
  }, [selectedNodeId, filteredData])

  // Handlers
  const handleSearchSelect = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId)
    setSearchQuery('')
  }, [])

  const clearHighlight = useCallback(() => setHighlightedNodeId(null), [])

  const clearPath = useCallback(() => {
    setPathFrom(null)
    setPathTo(null)
    setPathFromSearch('')
    setPathToSearch('')
  }, [])

  const toggleTier = useCallback((tier: number) => {
    setActiveTiers((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }, [])

  const toggleRelationship = useCallback((type: string) => {
    setActiveRelationships((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const toggleStrength = useCallback((strength: string) => {
    setActiveStrengths((prev) => {
      const next = new Set(prev)
      if (next.has(strength)) next.delete(strength)
      else next.add(strength)
      return next
    })
  }, [])

  const selectAllTiers = useCallback(() => {
    setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))
  }, [])

  const selectAllRelationships = useCallback(() => {
    if (data) {
      setActiveRelationships(new Set(data.edges.map((e) => e.relationship_type)))
    }
  }, [data])

  // Table sort handler
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
  }, [])

  // Sorted table rows
  const tableRows = useMemo(() => {
    if (!filteredData || !data) return []

    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]))
    const q = searchQuery.trim().toLowerCase()

    const rows = filteredData.edges
      .map((edge) => {
        const nodeA = nodeMap.get(edge.entity_a)
        const nodeB = nodeMap.get(edge.entity_b)
        return {
          id: edge.id,
          entityA: nodeA,
          entityB: nodeB,
          relationship: edge.relationship_type,
          strength: edge.evidence_strength ?? 'circumstantial',
          description: edge.description,
        }
      })
      .filter((row) => {
        if (!row.entityA || !row.entityB) return false
        if (!q) return true
        return (
          row.entityA.name.toLowerCase().includes(q) ||
          row.entityB.name.toLowerCase().includes(q) ||
          row.relationship.toLowerCase().includes(q)
        )
      })

    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'entity_a':
          cmp = (a.entityA?.name ?? '').localeCompare(b.entityA?.name ?? '')
          break
        case 'entity_b':
          cmp = (a.entityB?.name ?? '').localeCompare(b.entityB?.name ?? '')
          break
        case 'relationship':
          cmp = a.relationship.localeCompare(b.relationship)
          break
        case 'strength':
          cmp = a.strength.localeCompare(b.strength)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [filteredData, data, searchQuery, sortKey, sortDir])

  // --- D3 force simulation ---
  useEffect(() => {
    if (viewMode !== 'graph') return
    if (!filteredData || !svgRef.current || filteredData.nodes.length === 0 || dimensions.width === 0) {
      if (svgRef.current) d3.select(svgRef.current).selectAll('*').remove()
      return
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions
    const cx = width / 2
    const cy = height / 2

    // Compute degree for node sizing
    const degreeMap = new Map<string, number>()
    for (const edge of filteredData.edges) {
      degreeMap.set(edge.entity_a, (degreeMap.get(edge.entity_a) ?? 0) + 1)
      degreeMap.set(edge.entity_b, (degreeMap.get(edge.entity_b) ?? 0) + 1)
    }

    // Count parallel edges for curve offset
    const edgePairCount = new Map<string, number>()
    const edgePairIndex = new Map<string, number>()
    for (const e of filteredData.edges) {
      const pairKey = [e.entity_a, e.entity_b].sort().join('|')
      const count = (edgePairCount.get(pairKey) ?? 0) + 1
      edgePairCount.set(pairKey, count)
      edgePairIndex.set(e.id, count - 1)
    }

    // Determine which nodes are connected to the selected node
    const selectedConnIds = new Set<string>()
    if (selectedNodeId) {
      selectedConnIds.add(selectedNodeId)
      for (const e of filteredData.edges) {
        if (e.entity_a === selectedNodeId) selectedConnIds.add(e.entity_b)
        if (e.entity_b === selectedNodeId) selectedConnIds.add(e.entity_a)
      }
    }

    const nodes: GraphNode[] = filteredData.nodes.map((n) => ({ ...n }))
    const edges: GraphEdge[] = filteredData.edges.map((e) => ({
      ...e,
      source: e.entity_a,
      target: e.entity_b,
    }))

    // Defs for clip paths
    const defs = svg.append('defs')
    for (const n of nodes) {
      if (n.profile_image_url) {
        const r = getNodeRadius(degreeMap.get(n.id) ?? 0)
        defs.append('clipPath')
          .attr('id', `clip-${n.id.replace(/[^a-zA-Z0-9]/g, '')}`)
          .append('circle')
          .attr('r', r)
      }
    }

    const g = svg.append('g')

    // Track zoom level for progressive labels
    let currentZoom = 1

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        currentZoom = event.transform.k
        updateLabelVisibility()
      })

    svg.call(zoom)

    // Cluster positions
    const clusterAngle: Record<ClusterGroup, number> = {
      inner_circle: 0,
      financial: Math.PI / 4,
      legal_political: -Math.PI / 4 + Math.PI,
      operations: Math.PI / 2 + Math.PI / 4,
      peripheral: -Math.PI / 2 - Math.PI / 4,
    }
    const clusterRadius = Math.min(width, height) * 0.25

    function getClusterX(category: string | null): number {
      const group = getClusterGroup(category)
      if (group === 'inner_circle') return cx
      return cx + Math.cos(clusterAngle[group]) * clusterRadius
    }

    function getClusterY(category: string | null): number {
      const group = getClusterGroup(category)
      if (group === 'inner_circle') return cy
      return cy + Math.sin(clusterAngle[group]) * clusterRadius
    }

    // Simulation — wider spacing
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(200))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(cx, cy).strength(0.03))
      .force('collision', d3.forceCollide().radius((d) => {
        const node = d as GraphNode
        return getNodeRadius(degreeMap.get(node.id) ?? 0) + 14
      }))
      .velocityDecay(0.45)
      .alphaDecay(0.03)

    if (layoutMode === 'force') {
      simulation
        .force('clusterX', d3.forceX<GraphNode>((d) => getClusterX(d.category)).strength(0.04))
        .force('clusterY', d3.forceY<GraphNode>((d) => getClusterY(d.category)).strength(0.04))
    } else {
      const tierRadius: Record<number, number> = { 1: 0, 2: 150, 3: 280, 4: 400, 5: 500, 6: 500 }
      simulation
        .force('radial', d3.forceRadial<GraphNode>(
          (d) => tierRadius[d.tier ?? 6] ?? 500,
          cx, cy,
        ).strength(0.8))
        .force('clusterX', null)
        .force('clusterY', null)
        .force('center', null)
    }

    // Pre-compute layout
    simulation.alpha(1).stop()
    for (let i = 0; i < 150; i++) simulation.tick()

    // Edges (curved paths)
    const linkGroup = g.append('g').attr('class', 'edges')

    const link = linkGroup
      .selectAll<SVGPathElement, GraphEdge>('path')
      .data(edges)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        if (pathResult?.edgeIds.has(d.id)) return '#10B981'
        return getEdgeColor(d.relationship_type)
      })
      .attr('stroke-width', (d) => {
        if (pathResult?.edgeIds.has(d.id)) return 3
        const cat = getEdgeCategory(d.relationship_type)
        return cat === 'criminal' ? 1.5 : 1
      })
      .attr('stroke-opacity', (d) => {
        if (pathResult) return pathResult.edgeIds.has(d.id) ? 0.9 : 0.04
        return 0.35
      })
      .style('cursor', 'pointer')

    // Edge hover areas
    const linkHitArea = linkGroup
      .selectAll<SVGPathElement, GraphEdge>('.edge-hit')
      .data(edges)
      .join('path')
      .attr('class', 'edge-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .style('cursor', 'pointer')

    // Edge labels
    const linkLabel = g.append('g')
      .selectAll<SVGTextElement, GraphEdge>('text')
      .data(edges)
      .join('text')
      .text((d) => RELATIONSHIP_LABELS[d.relationship_type] ?? formatRelationship(d.relationship_type))
      .attr('font-size', '9px')
      .attr('fill', (d) => getEdgeColor(d.relationship_type))
      .attr('text-anchor', 'middle')
      .attr('dy', -6)
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.7)')

    // Node groups (for photo support)
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const nodeG = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')

    // Background circle (always present)
    nodeG.append('circle')
      .attr('class', 'node-bg')
      .attr('r', (d) => {
        if (pathResult?.nodeIds.has(d.id)) return getNodeRadius(degreeMap.get(d.id) ?? 0) + 2
        return getNodeRadius(degreeMap.get(d.id) ?? 0)
      })
      .attr('fill', (d) => {
        if (shouldShowPhoto(d, selectedNodeId, selectedConnIds)) return '#0A0E17'
        if (pathResult && !pathResult.nodeIds.has(d.id)) return DEFAULT_COLOR
        return TIER_COLORS[d.tier ?? 0] ?? DEFAULT_COLOR
      })
      .attr('stroke', (d) => {
        if (d.id === pathFrom || d.id === pathTo) return '#10B981'
        if (pathResult?.nodeIds.has(d.id)) return '#10B981'
        if (d.id === highlightedNodeId || d.id === selectedNodeId) return '#FFFFFF'
        if ((d.tier ?? 6) <= 2) return TIER_COLORS[d.tier ?? 1]
        return '#0A0E17'
      })
      .attr('stroke-width', (d) => {
        if (d.id === pathFrom || d.id === pathTo) return 3
        if (pathResult?.nodeIds.has(d.id)) return 2.5
        if (d.id === highlightedNodeId || d.id === selectedNodeId) return 3
        if ((d.tier ?? 6) <= 2) return 2
        return 1.5
      })
      .attr('opacity', (d) => {
        if (pathResult) return pathResult.nodeIds.has(d.id) ? 1 : 0.1
        return 1
      })

    // Photo images (only for nodes with profile_image_url)
    nodeG.each(function (d) {
      if (!d.profile_image_url) return
      const r = getNodeRadius(degreeMap.get(d.id) ?? 0)
      const clipId = `clip-${d.id.replace(/[^a-zA-Z0-9]/g, '')}`
      const show = shouldShowPhoto(d, selectedNodeId, selectedConnIds)

      const el = d3.select(this)
      el.append('image')
        .attr('class', 'node-photo')
        .attr('href', d.profile_image_url)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('x', -r)
        .attr('y', -r)
        .attr('clip-path', `url(#${clipId})`)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('opacity', show ? 1 : 0)
        .style('pointer-events', 'none')

      // Stroke ring over photo
      el.append('circle')
        .attr('class', 'node-ring')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', d.id === selectedNodeId ? '#FFFFFF' : (TIER_COLORS[d.tier ?? 0] ?? DEFAULT_COLOR))
        .attr('stroke-width', show ? 2.5 : 0)
        .style('pointer-events', 'none')
    })

    // Highlight ring
    if (highlightedNodeId) {
      const hn = nodes.find((n) => n.id === highlightedNodeId)
      if (hn) {
        g.append('g')
          .append('circle')
          .datum(hn)
          .attr('r', getNodeRadius(degreeMap.get(hn.id) ?? 0) + 8)
          .attr('fill', 'none')
          .attr('stroke', '#3B82F6')
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '4,3')
          .attr('class', 'highlight-ring')
          .style('pointer-events', 'none')
      }
    }

    // Labels
    const label = g.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .text((d) => truncateName(d.name))
      .attr('font-size', (d) => {
        if (pathResult?.nodeIds.has(d.id) || d.id === highlightedNodeId || d.id === selectedNodeId) return '12px'
        if ((d.tier ?? 6) <= 2) return '12px'
        if ((d.tier ?? 6) === 3) return '11px'
        return '10px'
      })
      .attr('font-weight', (d) => {
        if (pathResult?.nodeIds.has(d.id) || d.id === highlightedNodeId || d.id === selectedNodeId) return '600'
        if ((d.tier ?? 6) <= 2) return '600'
        return 'normal'
      })
      .attr('font-family', 'var(--font-body)')
      .attr('fill', (d) => {
        if (pathResult?.nodeIds.has(d.id) || d.id === highlightedNodeId || d.id === selectedNodeId) return '#FFFFFF'
        if ((d.tier ?? 6) <= 2) return '#F9FAFB'
        return '#D1D5DB'
      })
      .attr('opacity', (d) => {
        if (pathResult) return pathResult.nodeIds.has(d.id) ? 1 : 0
        if ((d.tier ?? 6) <= 2) return 1
        return 0
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(degreeMap.get(d.id) ?? 0) + 14)
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)')

    function updateLabelVisibility() {
      if (pathResult || selectedNodeId) return
      label.attr('opacity', (d) => {
        const tier = d.tier ?? 6
        if (tier <= 2) return 1
        if (tier === 3 && currentZoom >= 1.0) return 0.9
        if (tier === 4 && currentZoom >= 1.5) return 0.8
        if ((tier === 5 || tier === 6) && currentZoom >= 2.0) return 0.7
        return 0
      })
    }

    updateLabelVisibility()

    // Edge path generator
    function edgePath(d: GraphEdge): string {
      const src = d.source as GraphNode
      const tgt = d.target as GraphNode
      const x1 = src.x ?? 0, y1 = src.y ?? 0
      const x2 = tgt.x ?? 0, y2 = tgt.y ?? 0

      const pairKey = [d.entity_a, d.entity_b].sort().join('|')
      const totalEdges = edgePairCount.get(pairKey) ?? 1
      const idx = edgePairIndex.get(d.id) ?? 0

      if (totalEdges === 1) {
        const dx = x2 - x1, dy = y2 - y1
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const offset = Math.min(12, dist * 0.08)
        const mx = (x1 + x2) / 2 - (dy / dist) * offset
        const my = (y1 + y2) / 2 + (dx / dist) * offset
        return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
      }

      const dx = x2 - x1, dy = y2 - y1
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const spread = 18
      const offsetMag = spread * (idx - (totalEdges - 1) / 2)
      const mx = (x1 + x2) / 2 - (dy / dist) * offsetMag
      const my = (y1 + y2) / 2 + (dx / dist) * offsetMag
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
    }

    // Compute fit-all transform
    function computeFitAllTransform(): d3.ZoomTransform {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of nodes) {
        if (n.x != null && n.y != null) {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
          maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y)
        }
      }
      if (minX >= Infinity) return d3.zoomIdentity
      const padding = 60
      const bw = maxX - minX + padding * 2
      const bh = maxY - minY + padding * 2
      const scale = Math.min(width / bw, height / bh, 1.5)
      const tx = width / 2 - (minX + maxX) / 2 * scale
      const ty = height / 2 - (minY + maxY) / 2 * scale
      return d3.zoomIdentity.translate(tx, ty).scale(scale)
    }

    // Zoom to subgraph around a node
    function zoomToSubgraph(nodeId: string) {
      const connIds = new Set<string>([nodeId])
      for (const e of edges) {
        const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
        const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
        if (src === nodeId) connIds.add(tgt as string)
        if (tgt === nodeId) connIds.add(src as string)
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of nodes) {
        if (connIds.has(n.id) && n.x != null && n.y != null) {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
          maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y)
        }
      }

      if (minX >= Infinity) return
      const padding = 80
      const bw = maxX - minX + padding * 2
      const bh = maxY - minY + padding * 2
      const scale = Math.min(width / bw, height / bh, 2.0)
      const tx = width / 2 - (minX + maxX) / 2 * scale
      const ty = height / 2 - (minY + maxY) / 2 * scale
      svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }

    // Drag
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null
      })
    nodeG.call(drag)

    // Interaction helpers
    function highlightConnections(nodeId: string, animate = false) {
      const connIds = new Set<string>([nodeId])
      const connEdgeIds = new Set<string>()

      for (const e of edges) {
        const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
        const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
        if (src === nodeId || tgt === nodeId) {
          connIds.add(src as string)
          connIds.add(tgt as string)
          connEdgeIds.add(e.id)
        }
      }

      const dur = animate ? 400 : 0

      // Edge styling
      if (animate) {
        link.transition().duration(dur)
          .attr('stroke-opacity', (e) => connEdgeIds.has(e.id) ? 0.8 : 0.04)
          .attr('stroke-width', (e) => connEdgeIds.has(e.id) ? 2.5 : 1)
      } else {
        link
          .attr('stroke-opacity', (e) => connEdgeIds.has(e.id) ? 0.8 : 0.04)
          .attr('stroke-width', (e) => connEdgeIds.has(e.id) ? 2.5 : 1)
      }

      // Animated dash flow on connected edges
      if (animate) {
        link.filter((e) => connEdgeIds.has(e.id))
          .attr('stroke-dasharray', '6,3')
          .each(function animateEdge() {
            const el = d3.select(this)
            function runAnimation() {
              el.attr('stroke-dashoffset', 0)
                .transition().duration(1500).ease(d3.easeLinear)
                .attr('stroke-dashoffset', -18)
                .on('end', runAnimation)
            }
            runAnimation()
          })
        link.filter((e) => !connEdgeIds.has(e.id))
          .attr('stroke-dasharray', null)
          .interrupt()
      }

      linkLabel.style('opacity', (e) => connEdgeIds.has(e.id) ? 1 : 0)

      // Node opacity
      if (animate) {
        nodeG.select('.node-bg').transition().duration(dur)
          .attr('opacity', (n) => connIds.has((n as GraphNode).id) ? 1 : 0.08)
      } else {
        nodeG.select('.node-bg')
          .attr('opacity', (n) => connIds.has((n as GraphNode).id) ? 1 : 0.08)
      }

      // Show/hide photos on connected nodes
      nodeG.select('.node-photo')
        .transition().duration(dur)
        .attr('opacity', function () {
          const d = d3.select((this as SVGElement).parentElement as unknown as SVGGElement).datum() as GraphNode
          return shouldShowPhoto(d, nodeId, connIds) ? 1 : 0
        })
      nodeG.select('.node-ring')
        .attr('stroke-width', function () {
          const d = d3.select((this as SVGElement).parentElement as unknown as SVGGElement).datum() as GraphNode
          return shouldShowPhoto(d, nodeId, connIds) ? 2.5 : 0
        })

      // Label visibility for connected nodes
      label
        .attr('opacity', (n) => connIds.has(n.id) ? 1 : 0)
        .attr('font-size', (n) => connIds.has(n.id) && n.id !== nodeId ? '11px' : (n.id === nodeId ? '13px' : '10px'))
    }

    function resetHighlight(animate = false) {
      if (selectedNodeId) { highlightConnections(selectedNodeId, animate); return }

      const dur = animate ? 400 : 0

      // Remove dash animations
      link.interrupt()
        .attr('stroke-dasharray', null)

      const strokeFn = (d: GraphEdge) => pathResult?.edgeIds.has(d.id) ? '#10B981' : getEdgeColor(d.relationship_type)
      const opacityFn = (d: GraphEdge) => pathResult ? (pathResult.edgeIds.has(d.id) ? 0.9 : 0.04) : 0.35
      const widthFn = (d: GraphEdge) => pathResult?.edgeIds.has(d.id) ? 3 : (getEdgeCategory(d.relationship_type) === 'criminal' ? 1.5 : 1)
      if (animate) {
        link.transition().duration(dur)
          .attr('stroke', strokeFn)
          .attr('stroke-opacity', opacityFn)
          .attr('stroke-width', widthFn)
      } else {
        link
          .attr('stroke', strokeFn)
          .attr('stroke-opacity', opacityFn)
          .attr('stroke-width', widthFn)
      }

      linkLabel.style('opacity', 0)

      if (animate) {
        nodeG.select('.node-bg').transition().duration(dur)
          .attr('opacity', (d) => {
            if (pathResult) return pathResult.nodeIds.has((d as GraphNode).id) ? 1 : 0.1
            return 1
          })
      } else {
        nodeG.select('.node-bg')
          .attr('opacity', (d) => {
            if (pathResult) return pathResult.nodeIds.has((d as GraphNode).id) ? 1 : 0.1
            return 1
          })
      }

      // Reset photo visibility to default (T1-T2 only)
      nodeG.select('.node-photo')
        .transition().duration(dur)
        .attr('opacity', function () {
          const d = d3.select((this as SVGElement).parentElement as unknown as SVGGElement).datum() as GraphNode
          return shouldShowPhoto(d, null, new Set()) ? 1 : 0
        })
      nodeG.select('.node-ring')
        .attr('stroke-width', function () {
          const d = d3.select((this as SVGElement).parentElement as unknown as SVGGElement).datum() as GraphNode
          return shouldShowPhoto(d, null, new Set()) ? 2.5 : 0
        })

      updateLabelVisibility()
    }

    // Node hover & click
    nodeG
      .on('mouseover', function (_event, d) {
        setHoveredNode(d)
        if (!selectedNodeId) {
          highlightConnections(d.id)
          // Hover scale-up
          d3.select(this).raise()
            .transition().duration(150)
            .attr('transform', `translate(${d.x ?? 0},${d.y ?? 0}) scale(1.12)`)
        }
      })
      .on('mouseout', function (_event, d) {
        setHoveredNode(null)
        if (!selectedNodeId) {
          resetHighlight()
          d3.select(this)
            .transition().duration(150)
            .attr('transform', `translate(${d.x ?? 0},${d.y ?? 0}) scale(1)`)
        }
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        if (selectedNodeId === d.id) {
          setSelectedNodeId(null)
          resetHighlight(true)
          svg.transition().duration(600).call(zoom.transform, computeFitAllTransform())
        } else {
          setSelectedNodeId(d.id)
          highlightConnections(d.id, true)
          zoomToSubgraph(d.id)
        }
      })
      .on('dblclick', (_event, d) => {
        router.push(`/dashboard/entities/${d.id}`)
      })

    // Edge hover
    linkHitArea
      .on('mouseover', (_event, d) => {
        setHoveredEdge(d)
        link.attr('stroke-opacity', (e) => e.id === d.id ? 0.9 : 0.1)
        linkLabel.style('opacity', (e) => e.id === d.id ? 1 : 0)
      })
      .on('mouseout', () => {
        setHoveredEdge(null)
        if (selectedNodeId) highlightConnections(selectedNodeId)
        else resetHighlight()
      })

    // Background click — deselect + zoom back
    svg.on('click', () => {
      setSelectedNodeId(null)
      setHoveredEdge(null)
      resetHighlight(true)
      svg.transition().duration(600).call(zoom.transform, computeFitAllTransform())
    })

    // Start simulation gently after pre-computation
    simulation.alpha(0.3).restart()

    simulation.on('tick', () => {
      link.attr('d', edgePath)
      linkHitArea.attr('d', edgePath)

      linkLabel
        .attr('x', (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2)

      nodeG
        .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

      label
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => d.y ?? 0)

      svg.select('.highlight-ring')
        .attr('cx', (d) => (d as GraphNode).x ?? 0)
        .attr('cy', (d) => (d as GraphNode).y ?? 0)
    })

    // Auto-fit after settling
    simulation.on('end', () => {
      if (highlightedNodeId) {
        const hn = nodes.find((n) => n.id === highlightedNodeId)
        if (hn && hn.x != null && hn.y != null) {
          const scale = 1.8
          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(width / 2 - hn.x * scale, height / 2 - hn.y * scale).scale(scale),
          )
        }
      } else if (selectedNodeId) {
        zoomToSubgraph(selectedNodeId)
        highlightConnections(selectedNodeId, true)
      } else {
        svg.transition().duration(600).call(zoom.transform, computeFitAllTransform())
      }
    })

    return () => { simulation.stop() }
  }, [viewMode, filteredData, dimensions, router, highlightedNodeId, pathResult, pathFrom, pathTo, layoutMode, selectedNodeId])

  // --- Export helpers ---

  const exportSvg = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'network-graph.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportPng = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = dimensions.width * 2
      canvas.height = dimensions.height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(2, 2)
      ctx.fillStyle = '#0A0E17'
      ctx.fillRect(0, 0, dimensions.width, dimensions.height)
      ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = 'network-graph.png'
        a.click()
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [dimensions])

  // --- Render ---

  return (
    <MainContent>
      <PageHeader
        title="Network Graph"
        subtitle="Entity connections — click to pin, double-click to navigate, drag to rearrange"
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-border-default overflow-hidden">
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  viewMode === 'graph'
                    ? 'bg-info/10 text-info'
                    : 'bg-elevated text-text-muted hover:text-text-secondary'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="18" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M8.5 8.5l7 7M8.5 6h7" />
                </svg>
                Graph
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  viewMode === 'table'
                    ? 'bg-info/10 text-info'
                    : 'bg-elevated text-text-muted hover:text-text-secondary'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18" />
                </svg>
                Table
              </button>
            </div>

            {/* Layout mode toggle (graph only) */}
            {viewMode === 'graph' && (
              <div className="flex rounded-lg border border-border-default overflow-hidden">
                <button
                  onClick={() => setLayoutMode('force')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    layoutMode === 'force'
                      ? 'bg-info/10 text-info'
                      : 'bg-elevated text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Force
                </button>
                <button
                  onClick={() => setLayoutMode('radial')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    layoutMode === 'radial'
                      ? 'bg-info/10 text-info'
                      : 'bg-elevated text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Radial
                </button>
              </div>
            )}

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                showFilters
                  ? 'bg-info/10 text-info border border-info/30'
                  : 'bg-elevated border border-border-default text-text-muted hover:text-text-secondary'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filters
              {(activeTiers.size < 6 || activeStrengths.size < 3 || (data && activeRelationships.size < new Set(data.edges.map((e) => e.relationship_type)).size)) && (
                <span className="w-1.5 h-1.5 rounded-full bg-info" />
              )}
            </button>
          </div>
        }
      />

      {/* Search + graph-specific actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value.trim()) setHighlightedNodeId(null)
            }}
            placeholder={viewMode === 'graph' ? 'Find entity...' : 'Search connections...'}
            className="w-full sm:w-52 bg-elevated border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
          />
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {viewMode === 'graph' && searchQuery.trim() && searchMatches.length > 0 && (
            <div className="absolute top-full mt-1 right-0 w-64 bg-elevated border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
              {searchMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => handleSearchSelect(match.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[match.tier ?? 0] ?? DEFAULT_COLOR }} />
                  <span className="truncate">{match.name}</span>
                  {match.tier && <span className="text-xs text-text-muted ml-auto shrink-0">T{match.tier}</span>}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'graph' && searchQuery.trim() && searchMatches.length === 0 && (
            <div className="absolute top-full mt-1 right-0 w-64 bg-elevated border border-border-default rounded-lg shadow-lg z-50 px-3 py-2">
              <p className="text-xs text-text-muted">No entities found</p>
            </div>
          )}
        </div>

        {highlightedNodeId && data && (
          <button
            onClick={clearHighlight}
            className="flex items-center gap-1.5 bg-info/10 border border-info/30 rounded-lg px-2.5 py-1.5 text-xs text-info hover:bg-info/20 transition-colors"
          >
            <span className="font-medium">
              {data.nodes.find((n) => n.id === highlightedNodeId)?.name ?? 'Entity'}
            </span>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {viewMode === 'graph' && (
          <>
            <button
              onClick={() => {
                setShowPathFinder(!showPathFinder)
                if (showPathFinder) clearPath()
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                showPathFinder
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-elevated border border-border-default text-text-muted hover:text-text-secondary'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M13 6l6 6-6 6" />
                <path strokeLinecap="round" d="M5 6l6 6-6 6" />
              </svg>
              Find Path
              {pathResult && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
            </button>

            <button
              onClick={exportSvg}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-elevated border border-border-default text-text-muted hover:text-text-secondary transition-colors"
              title="Export as SVG"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              SVG
            </button>

            <button
              onClick={exportPng}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-elevated border border-border-default text-text-muted hover:text-text-secondary transition-colors"
              title="Export as PNG"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PNG
            </button>
          </>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface border border-border-default rounded-lg p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Entity Tiers</p>
                <button onClick={selectAllTiers} className="text-[10px] text-info hover:text-info/80 transition-colors">
                  Select all
                </button>
              </div>
              <div className="space-y-1.5">
                {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
                  <label key={tier} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={activeTiers.has(tier)} onChange={() => toggleTier(tier)} className="sr-only" />
                    <span
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                        activeTiers.has(tier) ? 'border-transparent' : 'border-border-default'
                      }`}
                      style={{ backgroundColor: activeTiers.has(tier) ? TIER_COLORS[tier] : 'transparent' }}
                    >
                      {activeTiers.has(tier) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                      T{tier}: {TIER_LABELS[tier]}
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">{tierCounts.get(tier) ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Relationship type filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Relationship Types</p>
                <button onClick={selectAllRelationships} className="text-[10px] text-info hover:text-info/80 transition-colors">
                  Select all
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {relationshipTypes.map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={activeRelationships.has(type)} onChange={() => toggleRelationship(type)} className="sr-only" />
                    <span
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                        activeRelationships.has(type) ? 'bg-info border-info' : 'border-border-default'
                      }`}
                    >
                      {activeRelationships.has(type) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2.5 h-0.5 rounded shrink-0" style={{ backgroundColor: getEdgeColor(type) }} />
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize">
                      {RELATIONSHIP_LABELS[type] ?? formatRelationship(type)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Evidence strength filters */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">Evidence Strength</p>
              <div className="space-y-1.5">
                {(['documented', 'alleged', 'circumstantial'] as const).map((strength) => (
                  <label key={strength} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={activeStrengths.has(strength)} onChange={() => toggleStrength(strength)} className="sr-only" />
                    <span
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                        activeStrengths.has(strength) ? 'bg-info border-info' : 'border-border-default'
                      }`}
                    >
                      {activeStrengths.has(strength) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize">{strength}</span>
                    <span className="ml-auto w-8 h-0.5 rounded" style={{ backgroundColor: '#374151', opacity: STRENGTH_OPACITY[strength] }} />
                  </label>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-border-default">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">Quick Filters</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      setActiveTiers(new Set([1, 2, 3]))
                      setActiveStrengths(new Set(['documented', 'alleged', 'circumstantial']))
                    }}
                    className="text-[11px] px-2 py-1 rounded bg-elevated border border-border-default text-text-muted hover:text-text-secondary hover:border-border-default/80 transition-colors"
                  >
                    High-risk only
                  </button>
                  <button
                    onClick={() => {
                      setActiveStrengths(new Set(['documented']))
                      setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))
                    }}
                    className="text-[11px] px-2 py-1 rounded bg-elevated border border-border-default text-text-muted hover:text-text-secondary hover:border-border-default/80 transition-colors"
                  >
                    Documented only
                  </button>
                  <button
                    onClick={() => {
                      setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))
                      setActiveStrengths(new Set(['documented', 'alleged', 'circumstantial']))
                      if (data) setActiveRelationships(new Set(data.edges.map((e) => e.relationship_type)))
                    }}
                    className="text-[11px] px-2 py-1 rounded bg-elevated border border-border-default text-text-muted hover:text-text-secondary hover:border-border-default/80 transition-colors"
                  >
                    Reset all
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Path finder panel */}
      {viewMode === 'graph' && showPathFinder && (
        <div className="bg-surface border border-border-default rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M13 6l6 6-6 6" />
              <path strokeLinecap="round" d="M5 6l6 6-6 6" />
            </svg>
            <p className="text-sm font-medium text-text-primary">Find Shortest Path Between Entities</p>
            {pathResult && (
              <button onClick={clearPath} className="ml-auto text-xs text-text-muted hover:text-text-secondary transition-colors">
                Clear path
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <label className="text-xs text-text-muted mb-1 block">From</label>
              {pathFrom && data ? (
                <div className="flex items-center gap-2 bg-elevated border border-success/30 rounded px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[data.nodes.find((n) => n.id === pathFrom)?.tier ?? 0] ?? DEFAULT_COLOR }} />
                  <span className="text-sm text-text-primary truncate">{data.nodes.find((n) => n.id === pathFrom)?.name}</span>
                  <button onClick={() => { setPathFrom(null); setPathFromSearch('') }} className="ml-auto shrink-0 text-text-muted hover:text-text-secondary">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={pathFromSearch}
                    onChange={(e) => setPathFromSearch(e.target.value)}
                    placeholder="Search entity..."
                    className="w-full bg-elevated border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-success focus:outline-none"
                  />
                  {pathFromSearch.trim() && pathFromMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
                      {pathFromMatches.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setPathFrom(m.id); setPathFromSearch('') }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[m.tier ?? 0] ?? DEFAULT_COLOR }} />
                          <span className="truncate">{m.name}</span>
                          <span className="text-xs text-text-muted ml-auto capitalize shrink-0">{m.entity_type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="hidden sm:flex items-center pt-5">
              <svg className="w-6 h-6 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </div>

            <div className="flex-1 relative">
              <label className="text-xs text-text-muted mb-1 block">To</label>
              {pathTo && data ? (
                <div className="flex items-center gap-2 bg-elevated border border-success/30 rounded px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[data.nodes.find((n) => n.id === pathTo)?.tier ?? 0] ?? DEFAULT_COLOR }} />
                  <span className="text-sm text-text-primary truncate">{data.nodes.find((n) => n.id === pathTo)?.name}</span>
                  <button onClick={() => { setPathTo(null); setPathToSearch('') }} className="ml-auto shrink-0 text-text-muted hover:text-text-secondary">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={pathToSearch}
                    onChange={(e) => setPathToSearch(e.target.value)}
                    placeholder="Search entity..."
                    className="w-full bg-elevated border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-success focus:outline-none"
                  />
                  {pathToSearch.trim() && pathToMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
                      {pathToMatches.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setPathTo(m.id); setPathToSearch('') }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[m.tier ?? 0] ?? DEFAULT_COLOR }} />
                          <span className="truncate">{m.name}</span>
                          <span className="text-xs text-text-muted ml-auto capitalize shrink-0">{m.entity_type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {pathFrom && pathTo && (
            <div className="mt-3 pt-3 border-t border-border-default">
              {pathResult ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-success font-medium">
                    Path found: {pathResult.path.length - 1} hop{pathResult.path.length - 1 !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-text-muted overflow-x-auto">
                    {pathResult.path.map((nodeId, i) => (
                      <span key={nodeId} className="flex items-center gap-1 shrink-0">
                        {i > 0 && <span className="text-success">&rarr;</span>}
                        <span className="text-text-secondary">
                          {data?.nodes.find((n) => n.id === nodeId)?.name ?? 'Unknown'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-warning">No path found between these entities with current filters.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tier legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => toggleTier(tier)}
            className={`flex items-center gap-1.5 transition-opacity ${activeTiers.has(tier) ? 'opacity-100' : 'opacity-30'}`}
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
            <span className="text-xs text-text-muted">T{tier}: {TIER_LABELS[tier]}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-surface border border-border-default rounded-lg p-8">
          <Skeleton className="w-full h-[500px]" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filteredData && filteredData.nodes.length === 0 && (
        <div className="bg-surface border border-border-default rounded-lg">
          {data && data.nodes.length > 0 ? (
            <EmptyState
              title="No connections match filters"
              description="No connections match the current filters. Try adjusting your criteria."
              action={{
                label: 'Reset filters',
                onClick: () => {
                  setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))
                  setActiveStrengths(new Set(['documented', 'alleged', 'circumstantial']))
                  if (data) setActiveRelationships(new Set(data.edges.map((e) => e.relationship_type)))
                },
              }}
            />
          ) : (
            <EmptyState
              title="No connections found"
              description="No connections found to visualize. Add entities and connections to build the network."
              action={{ label: 'View entities', href: '/dashboard/entities' }}
            />
          )}
        </div>
      )}

      {/* GRAPH VIEW */}
      {viewMode === 'graph' && !isLoading && filteredData && filteredData.nodes.length > 0 && (
        <>
          <div ref={containerRef} className="bg-surface border border-border-default rounded-lg overflow-hidden relative min-h-[600px]">
            <svg ref={svgRef} width={dimensions.width || '100%'} height={dimensions.height || 500} className="w-full" style={{ background: '#0A0E17' }} />

            {/* Legend overlay — hidden when selection panel is showing */}
            {showLegend && !selectedNodeId && (
              <div className="absolute bottom-4 left-4 bg-[#111827]/90 backdrop-blur-sm border border-[#1F2937] rounded-lg p-3 z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Connections</p>
                  <button onClick={() => setShowLegend(false)} className="text-text-muted hover:text-text-secondary ml-4">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(Object.entries(EDGE_CATEGORY_COLORS) as [EdgeCategory, string][]).map(([cat, color]) => (
                    <div key={cat} className="flex items-center gap-2">
                      <svg width="20" height="6">
                        <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth={cat === 'criminal' ? 2 : 1.5} strokeOpacity={0.8} />
                      </svg>
                      <span className="text-[10px] text-text-secondary">{EDGE_CATEGORY_LABELS[cat]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[#1F2937] space-y-1">
                  <p className="text-[9px] text-text-muted">Click node to pin</p>
                  <p className="text-[9px] text-text-muted">Double-click to view profile</p>
                </div>
              </div>
            )}

            {!showLegend && !selectedNodeId && (
              <button
                onClick={() => setShowLegend(true)}
                className="absolute bottom-4 left-4 bg-[#111827]/80 backdrop-blur-sm border border-[#1F2937] rounded-lg px-2.5 py-1.5 text-[10px] text-text-muted hover:text-text-secondary z-10"
              >
                Legend
              </button>
            )}

            {/* Entity summary panel (on selection) — dashboard dark theme */}
            {selectedEntitySummary && (
              <div className="absolute top-4 right-4 bg-[#111827] border border-[#1F2937] shadow-md rounded-lg p-4 z-20 w-[280px] max-h-[calc(100%-32px)] overflow-y-auto">
                {/* Close button */}
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="absolute top-2 right-2 text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Photo + Name */}
                <div className="flex items-start gap-3 pr-6">
                  {selectedEntitySummary.node.profile_image_url ? (
                    <img
                      src={selectedEntitySummary.node.profile_image_url}
                      alt={selectedEntitySummary.node.name}
                      className="w-12 h-12 rounded-full object-cover border-2 shrink-0"
                      style={{ borderColor: TIER_COLORS[selectedEntitySummary.node.tier ?? 0] ?? DEFAULT_COLOR }}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: TIER_COLORS[selectedEntitySummary.node.tier ?? 0] ?? DEFAULT_COLOR }}
                    >
                      {selectedEntitySummary.node.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                      {selectedEntitySummary.node.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedEntitySummary.node.tier && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded font-mono"
                          style={{
                            color: TIER_COLORS[selectedEntitySummary.node.tier] ?? DEFAULT_COLOR,
                            backgroundColor: `${TIER_COLORS[selectedEntitySummary.node.tier] ?? DEFAULT_COLOR}15`,
                          }}
                        >
                          Tier {selectedEntitySummary.node.tier}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Category + Status */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {selectedEntitySummary.node.category && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-elevated border border-[#1F2937] text-text-secondary rounded capitalize">
                      {selectedEntitySummary.node.category.replace(/_/g, ' ').replace(/-/g, ' ')}
                    </span>
                  )}
                  {selectedEntitySummary.node.status && selectedEntitySummary.node.status !== 'unknown' && (
                    <span className={`text-[10px] px-1.5 py-0.5 border rounded ${
                      selectedEntitySummary.node.status === 'convicted' ? 'bg-red-950/50 border-red-800/50 text-red-400' :
                      selectedEntitySummary.node.status === 'deceased' ? 'bg-gray-800/50 border-gray-700/50 text-gray-400' :
                      selectedEntitySummary.node.status === 'immunized' ? 'bg-orange-950/50 border-orange-800/50 text-orange-400' :
                      selectedEntitySummary.node.status === 'settled' ? 'bg-amber-950/50 border-amber-800/50 text-amber-400' :
                      'bg-elevated border-[#1F2937] text-text-muted'
                    }`}>
                      {STATUS_LABELS[selectedEntitySummary.node.status] ?? selectedEntitySummary.node.status}
                    </span>
                  )}
                </div>

                {/* Evidence summary */}
                {selectedEntitySummary.node.bio && (
                  <p className="text-[11px] text-text-secondary mt-3 leading-relaxed line-clamp-4">
                    {selectedEntitySummary.node.bio}
                  </p>
                )}

                {/* Connection breakdown */}
                <div className="mt-3 pt-3 border-t border-[#1F2937]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Connections
                    </p>
                    <span className="text-[10px] text-text-muted">
                      {selectedEntitySummary.totalConnections} total
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(Object.entries(selectedEntitySummary.categoryCounts) as [EdgeCategory, number][])
                      .filter(([, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, count]) => (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EDGE_CATEGORY_COLORS[cat] }} />
                          <span className="text-[11px] text-text-secondary flex-1">{EDGE_CATEGORY_LABELS[cat]}</span>
                          <span className="text-[11px] text-text-primary font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Connected entities — walkable chips */}
                {selectedEntitySummary.connectedNodes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#1F2937]">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
                      Connected To
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntitySummary.connectedNodes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNodeId(n.id)}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-elevated border border-[#1F2937] hover:border-info/50 transition-colors rounded group"
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[n.tier ?? 0] ?? DEFAULT_COLOR }} />
                          <span className="truncate max-w-[100px] text-text-secondary group-hover:text-text-primary transition-colors">{n.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View profile link */}
                <Link
                  href={`/dashboard/entities/${selectedEntitySummary.node.id}`}
                  className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#1F2937] text-xs text-info hover:text-info/80 transition-colors"
                >
                  <span>View Full Profile</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            )}

            {/* Hover tooltip (only when no selection panel or hovering a different node) */}
            {hoveredNode && (!selectedNodeId || hoveredNode.id !== selectedNodeId) && !selectedEntitySummary && (
              <div className="absolute top-4 right-4 bg-[#111827] border border-[#1F2937] rounded-lg p-3 min-w-[180px] pointer-events-none z-10">
                <p className="font-display text-sm font-semibold text-text-primary">{hoveredNode.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {hoveredNode.tier && (
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        color: TIER_COLORS[hoveredNode.tier] ?? DEFAULT_COLOR,
                        backgroundColor: `${TIER_COLORS[hoveredNode.tier] ?? DEFAULT_COLOR}20`,
                      }}
                    >
                      Tier {hoveredNode.tier}
                    </span>
                  )}
                  {hoveredNode.category && (
                    <span className="text-xs text-text-muted capitalize">{hoveredNode.category.replace(/_/g, ' ')}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1.5">Double-click to view profile</p>
              </div>
            )}

            {/* Edge tooltip */}
            {hoveredEdge && !hoveredNode && !selectedEntitySummary && (
              <div className="absolute top-4 right-4 bg-[#111827] border border-[#1F2937] rounded-lg p-3 min-w-[200px] pointer-events-none shadow-lg z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: getEdgeColor(hoveredEdge.relationship_type) }} />
                  <p className="text-xs text-text-primary">
                    {RELATIONSHIP_LABELS[hoveredEdge.relationship_type] ?? hoveredEdge.relationship_type.replace(/_/g, ' ')}
                  </p>
                </div>
                <p className="text-[10px] text-text-muted">
                  {data?.nodes.find((n) => n.id === hoveredEdge.entity_a)?.name} → {data?.nodes.find((n) => n.id === hoveredEdge.entity_b)?.name}
                </p>
                {hoveredEdge.description && (
                  <p className="text-[10px] text-text-secondary mt-1 line-clamp-3">{hoveredEdge.description}</p>
                )}
                {hoveredEdge.evidence_strength && (
                  <p className="text-[10px] mt-1" style={{ color: STRENGTH_COLORS[hoveredEdge.evidence_strength] ?? '#6B7280' }}>
                    {hoveredEdge.evidence_strength}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-6 mt-4">
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{filteredData.nodes.length}</span>
              {data && filteredData.nodes.length < data.nodes.length ? ` / ${data.nodes.length}` : ''} entities
            </p>
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{filteredData.edges.length}</span>
              {data && filteredData.edges.length < data.edges.length ? ` / ${data.edges.length}` : ''} connections
            </p>
          </div>
        </>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && !isLoading && filteredData && filteredData.nodes.length > 0 && (
        <>
          <div className="bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <SortableHeader label="Entity A" sortKey="entity_a" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                    <SortableHeader label="Relationship" sortKey="relationship" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                    <SortableHeader label="Entity B" sortKey="entity_b" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                    <SortableHeader label="Evidence" sortKey="strength" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {tableRows.map((row) => (
                    <tr key={row.id} className="hover:bg-elevated/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/entities/${row.entityA!.id}`} className="text-text-primary hover:text-info transition-colors font-medium">
                            {row.entityA!.name}
                          </Link>
                          {row.entityA!.tier && <TierBadge tier={row.entityA!.tier as Tier} />}
                        </div>
                        <p className="text-xs text-text-muted capitalize mt-0.5">{row.entityA!.entity_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-0.5 rounded shrink-0" style={{ backgroundColor: getEdgeColor(row.relationship) }} />
                          <span className="text-text-secondary capitalize">
                            {RELATIONSHIP_LABELS[row.relationship] ?? formatRelationship(row.relationship)}
                          </span>
                        </div>
                        {row.description && <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{row.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/entities/${row.entityB!.id}`} className="text-text-primary hover:text-info transition-colors font-medium">
                            {row.entityB!.name}
                          </Link>
                          {row.entityB!.tier && <TierBadge tier={row.entityB!.tier as Tier} />}
                        </div>
                        <p className="text-xs text-text-muted capitalize mt-0.5">{row.entityB!.entity_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium capitalize px-2 py-0.5 rounded"
                          style={{
                            color: STRENGTH_COLORS[row.strength] ?? '#6B7280',
                            backgroundColor: `${STRENGTH_COLORS[row.strength] ?? '#6B7280'}15`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STRENGTH_COLORS[row.strength] ?? '#6B7280' }} />
                          {row.strength}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-6 mt-4">
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{tableRows.length}</span>
              {filteredData.edges.length !== tableRows.length ? ` / ${filteredData.edges.length}` : ''} connections
            </p>
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{filteredData.nodes.length}</span> entities
            </p>
          </div>
        </>
      )}
    </MainContent>
  )
}

// -------------------------------------------------------------------
// Sortable Table Header
// -------------------------------------------------------------------

function SortableHeader({
  label,
  sortKey: key,
  currentKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  direction: SortDir
  onSort: (key: SortKey) => void
}) {
  const isActive = currentKey === key
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none"
      onClick={() => onSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${isActive ? 'text-text-secondary' : 'text-text-muted/40'} ${
            isActive && direction === 'desc' ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 15l4-4 4 4" />
        </svg>
      </div>
    </th>
  )
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function getNodeRadius(degree: number): number {
  return Math.max(8, Math.min(28, 8 + Math.sqrt(degree) * 5))
}

function truncateName(name: string): string {
  if (name.length <= 20) return name
  return name.slice(0, 18) + '\u2026'
}

function formatRelationship(type: string): string {
  return type.replace(/_/g, ' ')
}

// -------------------------------------------------------------------
// Pathfinding (BFS shortest path)
// -------------------------------------------------------------------

interface PathResult {
  nodeIds: Set<string>
  edgeIds: Set<string>
  path: string[]
}

function findShortestPath(
  edges: GraphEdge[],
  fromId: string,
  toId: string,
): PathResult | null {
  if (fromId === toId) return { nodeIds: new Set([fromId]), edgeIds: new Set(), path: [fromId] }

  const adj = new Map<string, { nodeId: string; edgeId: string }[]>()
  for (const edge of edges) {
    const a = edge.entity_a
    const b = edge.entity_b
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push({ nodeId: b, edgeId: edge.id })
    adj.get(b)!.push({ nodeId: a, edgeId: edge.id })
  }

  const visited = new Set<string>([fromId])
  const queue: { nodeId: string; path: string[]; edgeIds: string[] }[] = [
    { nodeId: fromId, path: [fromId], edgeIds: [] },
  ]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of adj.get(current.nodeId) ?? []) {
      if (visited.has(neighbor.nodeId)) continue
      const newPath = [...current.path, neighbor.nodeId]
      const newEdges = [...current.edgeIds, neighbor.edgeId]

      if (neighbor.nodeId === toId) {
        return { nodeIds: new Set(newPath), edgeIds: new Set(newEdges), path: newPath }
      }

      visited.add(neighbor.nodeId)
      queue.push({ nodeId: neighbor.nodeId, path: newPath, edgeIds: newEdges })
    }
  }

  return null
}
