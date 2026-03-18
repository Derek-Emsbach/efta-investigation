'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as d3 from 'd3'
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

// -------------------------------------------------------------------
// Constants — publication warm palette
// -------------------------------------------------------------------

const TIER_COLORS: Record<number, string> = {
  1: '#c62828',
  2: '#e65100',
  3: '#f57f17',
  4: '#283593',
  5: '#6a1b9a',
  6: '#455a64',
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

// Edge colors by relationship category (warm publication palette)
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
  criminal: '#c41e3a',
  financial: '#2d8a6e',
  legal: '#4a7ab5',
  personal: '#7c5bb0',
  other: '#8b7d6b',
}

const EDGE_CATEGORY_LABELS: Record<EdgeCategory, string> = {
  criminal: 'Criminal',
  financial: 'Financial',
  legal: 'Legal',
  personal: 'Personal',
  other: 'Other',
}

// Cluster positions
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

type LayoutMode = 'force' | 'radial'

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
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 })
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force')
  const [showLegend, setShowLegend] = useState(true)

  // Filter state
  const [activeTiers, setActiveTiers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]))
  const [activeRelationships, setActiveRelationships] = useState<Set<string>>(new Set())
  const [activeStrengths, setActiveStrengths] = useState<Set<string>>(
    new Set(['documented', 'alleged', 'circumstantial']),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Path-finding state
  const [showPathFinder, setShowPathFinder] = useState(false)
  const [pathFrom, setPathFrom] = useState<string | null>(null)
  const [pathTo, setPathTo] = useState<string | null>(null)
  const [pathFromSearch, setPathFromSearch] = useState('')
  const [pathToSearch, setPathToSearch] = useState('')

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

  // Fetch graph data from public API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/public/network')
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

  // Track container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        setDimensions({ width, height: Math.max(600, Math.min(width * 0.7, 800)) })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Derived data
  const relationshipTypes = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.edges.map((e) => e.relationship_type))).sort()
  }, [data])

  const tierCounts = useMemo(() => {
    if (!data) return new Map<number, number>()
    const counts = new Map<number, number>()
    for (const node of data.nodes) {
      const tier = node.tier ?? 0
      counts.set(tier, (counts.get(tier) ?? 0) + 1)
    }
    return counts
  }, [data])

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
    return { nodes: filteredNodes.filter((n) => connectedIds.has(n.id)), edges: filteredEdges }
  }, [data, activeTiers, activeRelationships, activeStrengths])

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !data) return []
    const q = searchQuery.toLowerCase()
    return data.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 8)
  }, [searchQuery, data])

  const pathResult = useMemo(() => {
    if (!pathFrom || !pathTo || !data) return null
    return findShortestPath(data.edges, pathFrom, pathTo)
  }, [pathFrom, pathTo, data])

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
      next.has(tier) ? next.delete(tier) : next.add(tier)
      return next
    })
  }, [])

  const toggleRelationship = useCallback((type: string) => {
    setActiveRelationships((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }, [])

  const toggleStrength = useCallback((strength: string) => {
    setActiveStrengths((prev) => {
      const next = new Set(prev)
      next.has(strength) ? next.delete(strength) : next.add(strength)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))
    setActiveStrengths(new Set(['documented', 'alleged', 'circumstantial']))
    if (data) setActiveRelationships(new Set(data.edges.map((e) => e.relationship_type)))
  }, [data])

  // -------------------------------------------------------------------
  // D3 force simulation
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!filteredData || !svgRef.current || filteredData.nodes.length === 0) {
      if (svgRef.current) d3.select(svgRef.current).selectAll('*').remove()
      return
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const { width, height } = dimensions
    const cx = width / 2
    const cy = height / 2

    // Compute degree
    const degreeMap = new Map<string, number>()
    for (const edge of filteredData.edges) {
      degreeMap.set(edge.entity_a, (degreeMap.get(edge.entity_a) ?? 0) + 1)
      degreeMap.set(edge.entity_b, (degreeMap.get(edge.entity_b) ?? 0) + 1)
    }

    // Count parallel edges
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

    // Pre-compute
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
        return getEdgeCategory(d.relationship_type) === 'criminal' ? 1.5 : 1
      })
      .attr('stroke-opacity', (d) => {
        if (pathResult) return pathResult.edgeIds.has(d.id) ? 0.9 : 0.04
        return 0.35
      })
      .style('cursor', 'pointer')

    // Edge hit areas
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
        if (shouldShowPhoto(d, selectedNodeId, selectedConnIds)) return '#111318'
        if (pathResult && !pathResult.nodeIds.has(d.id)) return DEFAULT_COLOR
        return TIER_COLORS[d.tier ?? 0] ?? DEFAULT_COLOR
      })
      .attr('stroke', (d) => {
        if (d.id === pathFrom || d.id === pathTo) return '#10B981'
        if (pathResult?.nodeIds.has(d.id)) return '#10B981'
        if (d.id === highlightedNodeId || d.id === selectedNodeId) return '#FFFFFF'
        if ((d.tier ?? 6) <= 2) return TIER_COLORS[d.tier ?? 1]
        return '#111318'
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
        g.append('g').append('circle')
          .datum(hn)
          .attr('r', getNodeRadius(degreeMap.get(hn.id) ?? 0) + 8)
          .attr('fill', 'none')
          .attr('stroke', '#b8860b')
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
      .attr('font-family', "'DM Sans', sans-serif")
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
        if (d.slug) router.push(`/entities/${d.slug}`)
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

    // Start gently
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
  }, [filteredData, dimensions, router, highlightedNodeId, pathResult, pathFrom, pathTo, layoutMode, selectedNodeId])

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl xl:max-w-newspaper px-6 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-display text-[clamp(28px,4vw,42px)] font-bold text-text-primary tracking-[-0.01em]">
            The Network Map
          </h1>
          <p className="font-body text-text-secondary mt-1">
            Every documented connection across six evidence tiers. Click to pin, double-click to view profile, drag to rearrange.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layout toggle */}
          <div className="flex bg-white border border-border-default overflow-hidden">
            <button
              onClick={() => setLayoutMode('force')}
              className={`px-3 py-1.5 text-xs font-sans transition-colors ${
                layoutMode === 'force' ? 'bg-accent-gold/10 text-accent-gold' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Force
            </button>
            <button
              onClick={() => setLayoutMode('radial')}
              className={`px-3 py-1.5 text-xs font-sans transition-colors ${
                layoutMode === 'radial' ? 'bg-accent-gold/10 text-accent-gold' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Radial
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!e.target.value.trim()) setHighlightedNodeId(null)
              }}
              placeholder="Find entity..."
              className="w-full sm:w-48 bg-white border border-border-default px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none font-sans"
            />
            {searchQuery.trim() && searchMatches.length > 0 && (
              <div className="absolute top-full mt-1 right-0 w-64 bg-white border border-border-default shadow-lg z-50 overflow-hidden">
                {searchMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => handleSearchSelect(match.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[match.tier ?? 0] ?? DEFAULT_COLOR }} />
                    <span className="truncate">{match.name}</span>
                    {match.tier && <span className="text-xs text-text-muted ml-auto shrink-0">T{match.tier}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {highlightedNodeId && data && (
            <button
              onClick={clearHighlight}
              className="flex items-center gap-1.5 bg-accent-gold/10 border border-accent-gold/30 px-2.5 py-1.5 text-xs text-accent-gold hover:bg-accent-gold/20 transition-colors font-sans"
            >
              <span className="font-medium">{data.nodes.find((n) => n.id === highlightedNodeId)?.name ?? 'Entity'}</span>
              <span>&times;</span>
            </button>
          )}

          <button
            onClick={() => { setShowPathFinder(!showPathFinder); if (showPathFinder) clearPath() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors font-sans ${
              showPathFinder
                ? 'bg-[#1a472a]/10 text-[#1a472a] border border-[#1a472a]/30'
                : 'bg-white border border-border-default text-text-muted hover:text-text-secondary'
            }`}
          >
            Find Path
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors font-sans ${
              showFilters
                ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/30'
                : 'bg-white border border-border-default text-text-muted hover:text-text-secondary'
            }`}
          >
            Filters
            {(activeTiers.size < 6 || activeStrengths.size < 3 || (data && activeRelationships.size < new Set(data.edges.map((e) => e.relationship_type)).size)) && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-border-default p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted font-sans">Entity Tiers</p>
                <button onClick={() => setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))} className="text-[10px] text-accent-gold hover:text-accent-gold/80 font-sans">Select all</button>
              </div>
              <div className="space-y-1.5">
                {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
                  <label key={tier} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={activeTiers.has(tier)} onChange={() => toggleTier(tier)} className="sr-only" />
                    <span
                      className={`w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors ${activeTiers.has(tier) ? 'border-transparent' : 'border-border-default'}`}
                      style={{ backgroundColor: activeTiers.has(tier) ? TIER_COLORS[tier] : 'transparent' }}
                    >
                      {activeTiers.has(tier) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors font-sans">T{tier}: {TIER_LABELS[tier]}</span>
                    <span className="text-[10px] text-text-muted ml-auto">{tierCounts.get(tier) ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted font-sans">Relationship Types</p>
                <button onClick={() => { if (data) setActiveRelationships(new Set(data.edges.map((e) => e.relationship_type))) }} className="text-[10px] text-accent-gold hover:text-accent-gold/80 font-sans">Select all</button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {relationshipTypes.map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={activeRelationships.has(type)} onChange={() => toggleRelationship(type)} className="sr-only" />
                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors ${activeRelationships.has(type) ? 'bg-accent-gold border-accent-gold' : 'border-border-default'}`}>
                      {activeRelationships.has(type) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2.5 h-0.5 rounded shrink-0" style={{ backgroundColor: getEdgeColor(type) }} />
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize font-sans">
                      {RELATIONSHIP_LABELS[type] ?? formatRelationship(type)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2 font-sans">Evidence Strength</p>
              <div className="space-y-1.5">
                {(['documented', 'alleged', 'circumstantial'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={activeStrengths.has(s)} onChange={() => toggleStrength(s)} className="sr-only" />
                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors ${activeStrengths.has(s) ? 'bg-accent-gold border-accent-gold' : 'border-border-default'}`}>
                      {activeStrengths.has(s) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize font-sans">{s}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border-default">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2 font-sans">Quick Filters</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => { setActiveTiers(new Set([1, 2, 3])); setActiveStrengths(new Set(['documented', 'alleged', 'circumstantial'])) }} className="text-[11px] px-2 py-1 bg-elevated border border-border-default text-text-muted hover:text-text-secondary transition-colors font-sans">High-risk only</button>
                  <button onClick={() => { setActiveStrengths(new Set(['documented'])); setActiveTiers(new Set([1, 2, 3, 4, 5, 6])) }} className="text-[11px] px-2 py-1 bg-elevated border border-border-default text-text-muted hover:text-text-secondary transition-colors font-sans">Documented only</button>
                  <button onClick={resetAll} className="text-[11px] px-2 py-1 bg-elevated border border-border-default text-text-muted hover:text-text-secondary transition-colors font-sans">Reset all</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Path finder */}
      {showPathFinder && (
        <div className="bg-white border border-border-default p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-text-primary font-sans">Find Shortest Path Between Entities</p>
            {pathResult && <button onClick={clearPath} className="ml-auto text-xs text-text-muted hover:text-text-secondary font-sans">Clear path</button>}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <label className="text-xs text-text-muted mb-1 block font-sans">From</label>
              {pathFrom && data ? (
                <div className="flex items-center gap-2 bg-elevated border border-[#1a472a]/30 px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[data.nodes.find((n) => n.id === pathFrom)?.tier ?? 0] ?? DEFAULT_COLOR }} />
                  <span className="text-sm text-text-primary truncate">{data.nodes.find((n) => n.id === pathFrom)?.name}</span>
                  <button onClick={() => { setPathFrom(null); setPathFromSearch('') }} className="ml-auto shrink-0 text-text-muted hover:text-text-secondary">&times;</button>
                </div>
              ) : (
                <>
                  <input type="text" value={pathFromSearch} onChange={(e) => setPathFromSearch(e.target.value)} placeholder="Search entity..." className="w-full bg-white border border-border-default px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none font-sans" />
                  {pathFromSearch.trim() && pathFromMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-default shadow-lg z-50">
                      {pathFromMatches.map((m) => (
                        <button key={m.id} onClick={() => { setPathFrom(m.id); setPathFromSearch('') }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-elevated transition-colors">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[m.tier ?? 0] ?? DEFAULT_COLOR }} />
                          <span className="truncate">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="hidden sm:flex items-center pt-5 text-text-muted">&rarr;</div>
            <div className="flex-1 relative">
              <label className="text-xs text-text-muted mb-1 block font-sans">To</label>
              {pathTo && data ? (
                <div className="flex items-center gap-2 bg-elevated border border-[#1a472a]/30 px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[data.nodes.find((n) => n.id === pathTo)?.tier ?? 0] ?? DEFAULT_COLOR }} />
                  <span className="text-sm text-text-primary truncate">{data.nodes.find((n) => n.id === pathTo)?.name}</span>
                  <button onClick={() => { setPathTo(null); setPathToSearch('') }} className="ml-auto shrink-0 text-text-muted hover:text-text-secondary">&times;</button>
                </div>
              ) : (
                <>
                  <input type="text" value={pathToSearch} onChange={(e) => setPathToSearch(e.target.value)} placeholder="Search entity..." className="w-full bg-white border border-border-default px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none font-sans" />
                  {pathToSearch.trim() && pathToMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-default shadow-lg z-50">
                      {pathToMatches.map((m) => (
                        <button key={m.id} onClick={() => { setPathTo(m.id); setPathToSearch('') }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-elevated transition-colors">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[m.tier ?? 0] ?? DEFAULT_COLOR }} />
                          <span className="truncate">{m.name}</span>
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
                  <span className="text-xs text-[#1a472a] font-medium font-sans">Path found: {pathResult.path.length - 1} hop{pathResult.path.length - 1 !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-1 text-xs text-text-muted overflow-x-auto">
                    {pathResult.path.map((nodeId, i) => (
                      <span key={nodeId} className="flex items-center gap-1 shrink-0">
                        {i > 0 && <span className="text-[#1a472a]">&rarr;</span>}
                        <span className="text-text-secondary">{data?.nodes.find((n) => n.id === nodeId)?.name ?? 'Unknown'}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-accent-red font-sans">No path found between these entities with current filters.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tier legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
          <button key={tier} onClick={() => toggleTier(tier)} className={`flex items-center gap-1.5 transition-opacity ${activeTiers.has(tier) ? 'opacity-100' : 'opacity-30'}`}>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
            <span className="text-xs text-text-muted font-sans">T{tier}: {TIER_LABELS[tier]}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="border border-border-default p-8">
          <div className="w-full h-[500px] bg-elevated animate-pulse" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filteredData && filteredData.nodes.length === 0 && (
        <div className="border border-border-default p-12 text-center">
          {data && data.nodes.length > 0 ? (
            <>
              <p className="font-display text-lg font-semibold text-text-primary mb-2">No connections match filters</p>
              <p className="font-body text-sm text-text-secondary mb-4">Try adjusting your filter criteria.</p>
              <button onClick={resetAll} className="font-sans text-xs font-semibold uppercase tracking-wider text-text-primary border border-text-primary px-4 py-2 hover:bg-text-primary hover:text-background transition-colors">Reset Filters</button>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-semibold text-text-primary mb-2">No connections found</p>
              <p className="font-body text-sm text-text-secondary">The network visualization will appear when entity connections are published.</p>
            </>
          )}
        </div>
      )}

      {/* Graph */}
      {!isLoading && filteredData && filteredData.nodes.length > 0 && (
        <div ref={containerRef} className="border border-border-default overflow-hidden relative">
          <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full" style={{ background: '#111318' }} />

          {/* Connection legend */}
          {showLegend && !selectedNodeId && (
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-border-default p-3 z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted font-sans">Connections</p>
                <button onClick={() => setShowLegend(false)} className="text-text-muted hover:text-text-secondary ml-4">
                  <span className="text-xs">&times;</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {(Object.entries(EDGE_CATEGORY_COLORS) as [EdgeCategory, string][]).map(([cat, color]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <svg width="20" height="6">
                      <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth={cat === 'criminal' ? 2 : 1.5} strokeOpacity={0.8} />
                    </svg>
                    <span className="text-[10px] text-text-secondary font-sans">{EDGE_CATEGORY_LABELS[cat]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-border-default space-y-1">
                <p className="text-[9px] text-text-muted font-sans">Click to pin, double-click for profile</p>
              </div>
            </div>
          )}

          {!showLegend && !selectedNodeId && (
            <button
              onClick={() => setShowLegend(true)}
              className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm border border-border-default px-2.5 py-1.5 text-[10px] font-sans text-text-muted hover:text-text-secondary z-10"
            >
              Legend
            </button>
          )}

          {/* Entity summary panel (on selection) */}
          {selectedEntitySummary && (
            <div className="absolute top-4 right-4 bg-white border border-border-default shadow-md p-4 z-20 w-[280px] max-h-[calc(100%-32px)] overflow-y-auto">
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
                        className="text-[10px] font-medium px-1.5 py-0.5 font-mono"
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
                  <span className="text-[10px] px-1.5 py-0.5 bg-elevated border border-border-default text-text-secondary font-sans capitalize">
                    {selectedEntitySummary.node.category.replace(/_/g, ' ').replace(/-/g, ' ')}
                  </span>
                )}
                {selectedEntitySummary.node.status && selectedEntitySummary.node.status !== 'unknown' && (
                  <span className={`text-[10px] px-1.5 py-0.5 border font-sans ${
                    selectedEntitySummary.node.status === 'convicted' ? 'bg-red-50 border-red-200 text-red-700' :
                    selectedEntitySummary.node.status === 'deceased' ? 'bg-gray-50 border-gray-200 text-gray-600' :
                    selectedEntitySummary.node.status === 'immunized' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                    selectedEntitySummary.node.status === 'settled' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-elevated border-border-default text-text-muted'
                  }`}>
                    {STATUS_LABELS[selectedEntitySummary.node.status] ?? selectedEntitySummary.node.status}
                  </span>
                )}
              </div>

              {/* Evidence summary */}
              {selectedEntitySummary.node.bio && (
                <p className="text-[11px] text-text-secondary font-body mt-3 leading-relaxed line-clamp-4">
                  {selectedEntitySummary.node.bio}
                </p>
              )}

              {/* Connection breakdown */}
              <div className="mt-3 pt-3 border-t border-border-default">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted font-sans">
                    Connections
                  </p>
                  <span className="text-[10px] text-text-muted font-sans">
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
                        <span className="text-[11px] text-text-secondary font-sans flex-1">{EDGE_CATEGORY_LABELS[cat]}</span>
                        <span className="text-[11px] text-text-primary font-medium font-sans">{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Connected entities — walkable chips */}
              {selectedEntitySummary.connectedNodes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-default">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted font-sans mb-2">
                    Connected To
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedEntitySummary.connectedNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setSelectedNodeId(n.id)}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-elevated border border-border-default hover:border-accent-gold/50 transition-colors font-sans group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[n.tier ?? 0] ?? DEFAULT_COLOR }} />
                        <span className="truncate max-w-[100px] text-text-secondary group-hover:text-text-primary transition-colors">{n.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* View profile link */}
              {selectedEntitySummary.node.slug && (
                <Link
                  href={`/entities/${selectedEntitySummary.node.slug}`}
                  className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-default text-xs text-accent-gold hover:text-accent-gold/80 transition-colors font-sans"
                >
                  <span>View Full Profile</span>
                  <span>&rarr;</span>
                </Link>
              )}
            </div>
          )}

          {/* Hover tooltip (only when no selection panel or hovering a different node) */}
          {hoveredNode && (!selectedNodeId || hoveredNode.id !== selectedNodeId) && !selectedEntitySummary && (
            <div className="absolute top-4 right-4 bg-white border border-border-default p-3 min-w-[180px] pointer-events-none shadow-sm z-10">
              <p className="font-display text-sm font-semibold text-text-primary">{hoveredNode.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {hoveredNode.tier && (
                  <span className="text-xs font-medium px-1.5 py-0.5 font-mono" style={{ color: TIER_COLORS[hoveredNode.tier] ?? DEFAULT_COLOR, backgroundColor: `${TIER_COLORS[hoveredNode.tier] ?? DEFAULT_COLOR}20` }}>
                    Tier {hoveredNode.tier}
                  </span>
                )}
                {hoveredNode.category && <span className="text-xs text-text-muted capitalize">{hoveredNode.category.replace(/_/g, ' ')}</span>}
              </div>
              {hoveredNode.slug && <p className="text-xs text-accent-gold mt-1.5">Double-click to view profile</p>}
            </div>
          )}

          {/* Edge tooltip */}
          {hoveredEdge && !hoveredNode && !selectedEntitySummary && (
            <div className="absolute top-4 right-4 bg-white border border-border-default p-3 min-w-[200px] pointer-events-none shadow-sm z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: getEdgeColor(hoveredEdge.relationship_type) }} />
                <p className="text-xs text-text-primary font-sans">
                  {RELATIONSHIP_LABELS[hoveredEdge.relationship_type] ?? hoveredEdge.relationship_type.replace(/_/g, ' ')}
                </p>
              </div>
              <p className="text-[10px] text-text-muted">
                {data?.nodes.find((n) => n.id === hoveredEdge.entity_a)?.name} → {data?.nodes.find((n) => n.id === hoveredEdge.entity_b)?.name}
              </p>
              {hoveredEdge.description && <p className="text-[10px] text-text-secondary mt-1 line-clamp-3">{hoveredEdge.description}</p>}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {!isLoading && filteredData && filteredData.nodes.length > 0 && (
        <div className="flex gap-6 mt-4">
          <p className="text-xs text-text-muted font-sans">
            <span className="text-text-secondary font-medium">{filteredData.nodes.length}</span>
            {data && filteredData.nodes.length < data.nodes.length ? ` / ${data.nodes.length}` : ''} entities
          </p>
          <p className="text-xs text-text-muted font-sans">
            <span className="text-text-secondary font-medium">{filteredData.edges.length}</span>
            {data && filteredData.edges.length < data.edges.length ? ` / ${data.edges.length}` : ''} connections
          </p>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function getNodeRadius(degree: number): number {
  return Math.max(8, Math.min(28, 8 + Math.sqrt(degree) * 5))
}

function truncateName(name: string): string {
  return name.length <= 20 ? name : name.slice(0, 18) + '\u2026'
}

function formatRelationship(type: string): string {
  return type.replace(/_/g, ' ')
}

// -------------------------------------------------------------------
// Pathfinding (BFS)
// -------------------------------------------------------------------

interface PathResult {
  nodeIds: Set<string>
  edgeIds: Set<string>
  path: string[]
}

function findShortestPath(edges: GraphEdge[], fromId: string, toId: string): PathResult | null {
  if (fromId === toId) return { nodeIds: new Set([fromId]), edgeIds: new Set(), path: [fromId] }

  const adj = new Map<string, { nodeId: string; edgeId: string }[]>()
  for (const edge of edges) {
    if (!adj.has(edge.entity_a)) adj.set(edge.entity_a, [])
    if (!adj.has(edge.entity_b)) adj.set(edge.entity_b, [])
    adj.get(edge.entity_a)!.push({ nodeId: edge.entity_b, edgeId: edge.id })
    adj.get(edge.entity_b)!.push({ nodeId: edge.entity_a, edgeId: edge.id })
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
