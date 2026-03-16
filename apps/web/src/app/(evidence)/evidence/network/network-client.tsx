'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import { TierBadge } from '@/components/ui/tier-badge'
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

// Neon tier colors for evidence room glow effects
const TIER_GLOW_COLORS: Record<number, string> = {
  1: '#e63950',
  2: '#f59e0b',
  3: '#f97316',
  4: '#6b7280',
  5: '#14b8a6',
  6: '#64748b',
}

const DEFAULT_COLOR = '#4B5563'

const STRENGTH_OPACITY: Record<string, number> = {
  documented: 0.8,
  alleged: 0.5,
  circumstantial: 0.3,
}

const STRENGTH_COLORS: Record<string, string> = {
  documented: '#10B981',
  alleged: '#F59E0B',
  circumstantial: '#6B7280',
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

// Edge colors by relationship category
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
  criminal: '#e63950',
  financial: '#34d399',
  legal: '#60a5fa',
  personal: '#a78bfa',
  other: '#4b5563',
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

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

type LayoutMode = 'force' | 'radial'

export default function EvidenceNetworkClient() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
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

  // Initialize relationship filter options from data
  useEffect(() => {
    if (data && activeRelationships.size === 0) {
      const types = new Set(data.edges.map((e) => e.relationship_type))
      setActiveRelationships(types)
    }
  }, [data, activeRelationships.size])

  // Fetch graph data from PUBLIC API
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
        if (width > 0) {
          setDimensions({ width, height: Math.max(600, Math.min(width * 0.7, 800)) })
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Derive relationship types
  const relationshipTypes = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.edges.map((e) => e.relationship_type))).sort()
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

  // --- D3 force simulation ---
  useEffect(() => {
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

    // Count parallel edges between same node pairs for curve offset
    const edgePairCount = new Map<string, number>()
    const edgePairIndex = new Map<string, number>()
    for (const e of filteredData.edges) {
      const pairKey = [e.entity_a, e.entity_b].sort().join('|')
      const count = (edgePairCount.get(pairKey) ?? 0) + 1
      edgePairCount.set(pairKey, count)
      edgePairIndex.set(e.id, count - 1)
    }

    const nodes: GraphNode[] = filteredData.nodes.map((n) => ({ ...n }))
    const edges: GraphEdge[] = filteredData.edges.map((e) => ({
      ...e,
      source: e.entity_a,
      target: e.entity_b,
    }))

    // ── SVG defs (glow filters) ──
    const defs = svg.append('defs')

    // Glow filters for T1-T2 nodes
    for (const tier of [1, 2]) {
      const filter = defs.append('filter')
        .attr('id', `glow-t${tier}`)
        .attr('x', '-50%').attr('y', '-50%')
        .attr('width', '200%').attr('height', '200%')
      filter.append('feGaussianBlur')
        .attr('in', 'SourceGraphic')
        .attr('stdDeviation', 4)
        .attr('result', 'blur')
      filter.append('feFlood')
        .attr('flood-color', TIER_GLOW_COLORS[tier])
        .attr('flood-opacity', 0.6)
        .attr('result', 'color')
      filter.append('feComposite')
        .attr('in', 'color')
        .attr('in2', 'blur')
        .attr('operator', 'in')
        .attr('result', 'glow')
      const merge = filter.append('feMerge')
      merge.append('feMergeNode').attr('in', 'glow')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')
    }

    // Edge glow for criminal connections
    const edgeGlow = defs.append('filter')
      .attr('id', 'edge-glow-criminal')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%')
    edgeGlow.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', 2)
      .attr('result', 'blur')
    const edgeMerge = edgeGlow.append('feMerge')
    edgeMerge.append('feMergeNode').attr('in', 'blur')
    edgeMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const g = svg.append('g')

    // Track current zoom level for progressive label disclosure
    let currentZoom = 1

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        currentZoom = event.transform.k
        updateLabelVisibility()
      })

    svg.call(zoom)

    // ── Cluster positions ──
    const clusterAngle: Record<ClusterGroup, number> = {
      inner_circle: 0,       // center (no offset)
      financial: Math.PI / 4, // top-right
      legal_political: -Math.PI / 4 + Math.PI, // top-left
      operations: Math.PI / 2 + Math.PI / 4, // bottom-right
      peripheral: -Math.PI / 2 - Math.PI / 4, // bottom-left
    }
    const clusterRadius = Math.min(width, height) * 0.18

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

    // ── Simulation ──
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(cx, cy).strength(0.05))
      .force('collision', d3.forceCollide().radius((d) => {
        const node = d as GraphNode
        return getNodeRadius(degreeMap.get(node.id) ?? 0) + 6
      }))
      .velocityDecay(0.45)
      .alphaDecay(0.03)

    // Add cluster forces in force mode
    if (layoutMode === 'force') {
      simulation
        .force('clusterX', d3.forceX<GraphNode>((d) => getClusterX(d.category)).strength(0.04))
        .force('clusterY', d3.forceY<GraphNode>((d) => getClusterY(d.category)).strength(0.04))
    } else {
      // Radial mode: concentric rings by tier
      const tierRadius: Record<number, number> = { 1: 0, 2: 120, 3: 220, 4: 320, 5: 400, 6: 400 }
      simulation
        .force('radial', d3.forceRadial<GraphNode>(
          (d) => tierRadius[d.tier ?? 6] ?? 400,
          cx, cy,
        ).strength(0.8))
        .force('clusterX', null)
        .force('clusterY', null)
        .force('center', null)
    }

    // Pre-compute layout: run 120 ticks before rendering
    simulation.alpha(1).stop()
    for (let i = 0; i < 150; i++) simulation.tick()

    // ── Edges (curved paths) ──
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
        return 0.3
      })
      .attr('filter', (d) => {
        const cat = getEdgeCategory(d.relationship_type)
        return cat === 'criminal' ? 'url(#edge-glow-criminal)' : null
      })
      .style('cursor', 'pointer')

    // Edge hover areas (invisible wider paths for easier hovering)
    const linkHitArea = linkGroup
      .selectAll<SVGPathElement, GraphEdge>('.edge-hit')
      .data(edges)
      .join('path')
      .attr('class', 'edge-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .style('cursor', 'pointer')

    // Edge labels (shown on hover)
    const linkLabel = g.append('g')
      .selectAll<SVGTextElement, GraphEdge>('text')
      .data(edges)
      .join('text')
      .text((d) => RELATIONSHIP_LABELS[d.relationship_type] ?? d.relationship_type.replace(/_/g, ' '))
      .attr('font-size', '9px')
      .attr('fill', (d) => getEdgeColor(d.relationship_type))
      .attr('text-anchor', 'middle')
      .attr('dy', -6)
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)')

    // ── Glow circles (behind nodes, for T1-T2) ──
    const glowCircle = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes.filter((n) => (n.tier ?? 6) <= 2))
      .join('circle')
      .attr('r', (d) => getNodeRadius(degreeMap.get(d.id) ?? 0) + 4)
      .attr('fill', 'none')
      .attr('filter', (d) => `url(#glow-t${d.tier})`)
      .attr('stroke', (d) => TIER_GLOW_COLORS[d.tier ?? 1])
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.5)
      .style('pointer-events', 'none')

    // ── Nodes ──
    const node = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => {
        if (pathResult?.nodeIds.has(d.id)) return getNodeRadius(degreeMap.get(d.id) ?? 0) + 2
        return getNodeRadius(degreeMap.get(d.id) ?? 0)
      })
      .attr('fill', (d) => {
        if (pathResult && !pathResult.nodeIds.has(d.id)) return DEFAULT_COLOR
        return TIER_COLORS[d.tier ?? 0] ?? DEFAULT_COLOR
      })
      .attr('stroke', (d) => {
        if (d.id === pathFrom || d.id === pathTo) return '#10B981'
        if (pathResult?.nodeIds.has(d.id)) return '#10B981'
        if (d.id === highlightedNodeId || d.id === selectedNodeId) return '#FFFFFF'
        // T1-T2 get a colored ring
        if ((d.tier ?? 6) <= 2) return TIER_GLOW_COLORS[d.tier ?? 1]
        return '#0d0f11'
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
      .style('cursor', 'pointer')

    // Highlighted search ring
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

    // ── Labels ──
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
        // Progressive disclosure: T1-T2 always, others hidden until zoom
        if ((d.tier ?? 6) <= 2) return 1
        return 0 // Will be updated by zoom handler
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(degreeMap.get(d.id) ?? 0) + 14)
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)')

    // Progressive label visibility based on zoom
    function updateLabelVisibility() {
      if (pathResult || selectedNodeId) return // Don't override during selection/path
      label.attr('opacity', (d) => {
        const tier = d.tier ?? 6
        if (tier <= 2) return 1
        if (tier === 3 && currentZoom >= 1.0) return 0.9
        if (tier === 4 && currentZoom >= 1.5) return 0.8
        if ((tier === 5 || tier === 6) && currentZoom >= 2.0) return 0.7
        return 0
      })
    }

    // Run initial label visibility
    updateLabelVisibility()

    // ── Edge path generator ──
    function edgePath(d: GraphEdge): string {
      const src = d.source as GraphNode
      const tgt = d.target as GraphNode
      const x1 = src.x ?? 0, y1 = src.y ?? 0
      const x2 = tgt.x ?? 0, y2 = tgt.y ?? 0

      const pairKey = [d.entity_a, d.entity_b].sort().join('|')
      const totalEdges = edgePairCount.get(pairKey) ?? 1
      const idx = edgePairIndex.get(d.id) ?? 0

      if (totalEdges === 1) {
        // Single edge: subtle arc
        const dx = x2 - x1, dy = y2 - y1
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const offset = Math.min(12, dist * 0.08)
        const mx = (x1 + x2) / 2 - (dy / dist) * offset
        const my = (y1 + y2) / 2 + (dx / dist) * offset
        return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
      }

      // Multiple edges: spread curves
      const dx = x2 - x1, dy = y2 - y1
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const spread = 18
      const offsetMag = spread * (idx - (totalEdges - 1) / 2)
      const mx = (x1 + x2) / 2 - (dy / dist) * offsetMag
      const my = (y1 + y2) / 2 + (dx / dist) * offsetMag
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
    }

    // ── Drag behavior ──
    const drag = d3.drag<SVGCircleElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.1).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(drag)

    // ── Hover & click interactions ──
    function highlightConnections(nodeId: string) {
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

      link
        .attr('stroke-opacity', (e) => connEdgeIds.has(e.id) ? 0.8 : 0.04)
        .attr('stroke-width', (e) => connEdgeIds.has(e.id) ? 2.5 : 1)

      linkLabel.style('opacity', (e) => connEdgeIds.has(e.id) ? 1 : 0)
      node.attr('opacity', (n) => connIds.has(n.id) ? 1 : 0.08)
      glowCircle.attr('stroke-opacity', (n) => connIds.has(n.id) ? 0.6 : 0.05)
      label
        .attr('opacity', (n) => connIds.has(n.id) ? 1 : 0)
        .attr('font-size', (n) => connIds.has(n.id) && n.id !== nodeId ? '11px' : (n.id === nodeId ? '13px' : '10px'))
    }

    function resetHighlight() {
      if (selectedNodeId) {
        highlightConnections(selectedNodeId)
        return
      }

      link
        .attr('stroke', (d) => {
          if (pathResult?.edgeIds.has(d.id)) return '#10B981'
          return getEdgeColor(d.relationship_type)
        })
        .attr('stroke-opacity', (d) => {
          if (pathResult) return pathResult.edgeIds.has(d.id) ? 0.9 : 0.04
          return 0.3
        })
        .attr('stroke-width', (d) => {
          if (pathResult?.edgeIds.has(d.id)) return 3
          const cat = getEdgeCategory(d.relationship_type)
          return cat === 'criminal' ? 1.5 : 1
        })
      linkLabel.style('opacity', 0)
      node.attr('opacity', (d) => {
        if (pathResult) return pathResult.nodeIds.has(d.id) ? 1 : 0.1
        return 1
      })
      glowCircle.attr('stroke-opacity', 0.5)
      updateLabelVisibility()
    }

    // Node hover
    node
      .on('mouseover', (_event, d) => {
        setHoveredNode(d)
        if (!selectedNodeId) highlightConnections(d.id)
      })
      .on('mouseout', () => {
        setHoveredNode(null)
        if (!selectedNodeId) resetHighlight()
      })
      .on('click', (event, d) => {
        event.stopPropagation()
        if (selectedNodeId === d.id) {
          // Deselect
          setSelectedNodeId(null)
          resetHighlight()
        } else {
          setSelectedNodeId(d.id)
          highlightConnections(d.id)
        }
      })
      .on('dblclick', (_event, d) => {
        if (d.slug) {
          router.push(`/evidence/entities/${d.slug}`)
        }
      })

    // Edge hover
    linkHitArea
      .on('mouseover', (_event, d) => {
        setHoveredEdge(d)
        // Highlight just this edge
        link.attr('stroke-opacity', (e) => e.id === d.id ? 0.9 : 0.1)
        linkLabel.style('opacity', (e) => e.id === d.id ? 1 : 0)
      })
      .on('mouseout', () => {
        setHoveredEdge(null)
        if (selectedNodeId) {
          highlightConnections(selectedNodeId)
        } else {
          resetHighlight()
        }
      })

    // Background click to deselect
    svg.on('click', () => {
      setSelectedNodeId(null)
      setHoveredEdge(null)
      resetHighlight()
    })

    // ── Tick ──
    // Start simulation gently after pre-computation
    simulation.alpha(0.3).restart()

    simulation.on('tick', () => {
      link.attr('d', edgePath)
      linkHitArea.attr('d', edgePath)

      linkLabel
        .attr('x', (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2)

      glowCircle
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)

      node
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)

      label
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => d.y ?? 0)

      svg.select('.highlight-ring')
        .attr('cx', (d) => (d as GraphNode).x ?? 0)
        .attr('cy', (d) => (d as GraphNode).y ?? 0)
    })

    // Fit graph to view after settling
    simulation.on('end', () => {
      if (highlightedNodeId) {
        const hn = nodes.find((n) => n.id === highlightedNodeId)
        if (hn && hn.x != null && hn.y != null) {
          const scale = 1.8
          svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(width / 2 - hn.x * scale, height / 2 - hn.y * scale).scale(scale))
        }
      } else {
        // Auto-fit: compute bounds and zoom to fit with padding
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const n of nodes) {
          if (n.x != null && n.y != null) {
            minX = Math.min(minX, n.x)
            minY = Math.min(minY, n.y)
            maxX = Math.max(maxX, n.x)
            maxY = Math.max(maxY, n.y)
          }
        }
        if (minX < Infinity) {
          const padding = 60
          const bw = maxX - minX + padding * 2
          const bh = maxY - minY + padding * 2
          const scale = Math.min(width / bw, height / bh, 1.5)
          const tx = width / 2 - (minX + maxX) / 2 * scale
          const ty = height / 2 - (minY + maxY) / 2 * scale
          svg.transition()
            .duration(600)
            .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
        }
      }
    })

    return () => { simulation.stop() }
  }, [filteredData, dimensions, router, highlightedNodeId, pathResult, pathFrom, pathTo, layoutMode, selectedNodeId])

  // --- Render ---

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="h-8 w-48 bg-surface rounded animate-pulse" />
        <div className="w-full h-[600px] bg-surface rounded-lg animate-pulse mt-6" />
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16 text-center">
        <p className="text-text-muted font-mono text-sm">No network data available</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Network Graph</h1>
          <p className="text-sm text-text-muted mt-1">
            {filteredData?.nodes.length ?? 0} entities · {filteredData?.edges.length ?? 0} connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="flex items-center bg-surface border border-border-default rounded-lg overflow-hidden">
            <button
              onClick={() => setLayoutMode('force')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                layoutMode === 'force'
                  ? 'bg-critical/15 text-critical'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Force
            </button>
            <button
              onClick={() => setLayoutMode('radial')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                layoutMode === 'radial'
                  ? 'bg-critical/15 text-critical'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Radial
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors font-mono ${
              showFilters
                ? 'bg-critical/10 text-critical border border-critical/30'
                : 'bg-surface border border-border-default text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            Filters
          </button>

          {/* Path finder toggle */}
          <button
            onClick={() => {
              setShowPathFinder(!showPathFinder)
              if (showPathFinder) clearPath()
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors font-mono ${
              showPathFinder
                ? 'bg-neon-green/10 text-neon-green border border-neon-green/30'
                : 'bg-surface border border-border-default text-text-muted hover:text-text-secondary'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M13 6l6 6-6 6" />
              <path strokeLinecap="round" d="M5 6l6 6-6 6" />
            </svg>
            Find Path
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value.trim()) setHighlightedNodeId(null)
            }}
            placeholder="Find entity..."
            className="w-full sm:w-52 bg-surface border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-critical focus:outline-none font-mono"
          />

          {searchQuery.trim() && searchMatches.length > 0 && (
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
        </div>

        {highlightedNodeId && data && (
          <button
            onClick={clearHighlight}
            className="flex items-center gap-1.5 bg-neon-blue/10 border border-neon-blue/30 rounded-lg px-2.5 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20 transition-colors font-mono"
          >
            <span className="font-medium">
              {data.nodes.find((n) => n.id === highlightedNodeId)?.name ?? 'Entity'}
            </span>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface border border-border-default rounded-lg p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tiers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono uppercase tracking-wider text-text-muted">Entity Tiers</p>
                <button onClick={() => setActiveTiers(new Set([1, 2, 3, 4, 5, 6]))} className="text-[10px] text-critical hover:text-critical/80 font-mono">
                  Select all
                </button>
              </div>
              <div className="space-y-1.5">
                {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
                  <button key={tier} onClick={() => toggleTier(tier)} className="w-full flex items-center gap-2 text-left text-xs text-text-secondary hover:text-text-primary transition-colors py-0.5">
                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors ${activeTiers.has(tier) ? 'border-critical bg-critical' : 'border-border-default'}`}>
                      {activeTiers.has(tier) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[tier] }} />
                    <span className="font-mono">Tier {tier}</span>
                    <span className="text-text-muted ml-auto">{TIER_LABELS[tier]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Relationships */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono uppercase tracking-wider text-text-muted">Relationships</p>
                <button onClick={() => { if (data) setActiveRelationships(new Set(data.edges.map((e) => e.relationship_type))) }} className="text-[10px] text-critical hover:text-critical/80 font-mono">
                  Select all
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {relationshipTypes.map((type) => (
                  <button key={type} onClick={() => toggleRelationship(type)} className="w-full flex items-center gap-2 text-left text-xs text-text-secondary hover:text-text-primary transition-colors py-0.5">
                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors ${activeRelationships.has(type) ? 'bg-critical border-critical' : 'border-border-default'}`}>
                      {activeRelationships.has(type) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2.5 h-0.5 rounded shrink-0" style={{ backgroundColor: getEdgeColor(type) }} />
                    <span className="font-mono">{RELATIONSHIP_LABELS[type] ?? type.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Strength */}
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Evidence Strength</p>
              <div className="space-y-1.5">
                {(['documented', 'alleged', 'circumstantial'] as const).map((s) => (
                  <button key={s} onClick={() => toggleStrength(s)} className="w-full flex items-center gap-2 text-left text-xs text-text-secondary hover:text-text-primary transition-colors py-0.5">
                    <span className={`w-3.5 h-3.5 border-2 flex items-center justify-center transition-colors ${activeStrengths.has(s) ? 'bg-critical border-critical' : 'border-border-default'}`}>
                      {activeStrengths.has(s) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STRENGTH_COLORS[s] }} />
                    <span className="font-mono capitalize">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Path finder */}
      {showPathFinder && (
        <div className="bg-surface border border-border-default rounded-lg p-4 mb-4">
          <p className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">Shortest Path Finder</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* From */}
            <div className="relative">
              <label className="text-xs text-text-muted font-mono block mb-1">From</label>
              <input
                type="text"
                value={pathFromSearch}
                onChange={(e) => setPathFromSearch(e.target.value)}
                placeholder="Search entity..."
                className="w-full bg-elevated border border-border-default px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-critical focus:outline-none font-mono rounded-lg"
              />
              {pathFromSearch.trim() && pathFromMatches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border-default shadow-lg z-50 rounded-lg overflow-hidden">
                  {pathFromMatches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setPathFrom(m.id); setPathFromSearch(m.name) }}
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              {pathFrom && <p className="text-[10px] text-neon-green font-mono mt-1">Selected: {data.nodes.find((n) => n.id === pathFrom)?.name}</p>}
            </div>

            {/* To */}
            <div className="relative">
              <label className="text-xs text-text-muted font-mono block mb-1">To</label>
              <input
                type="text"
                value={pathToSearch}
                onChange={(e) => setPathToSearch(e.target.value)}
                placeholder="Search entity..."
                className="w-full bg-elevated border border-border-default px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-critical focus:outline-none font-mono rounded-lg"
              />
              {pathToSearch.trim() && pathToMatches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border-default shadow-lg z-50 rounded-lg overflow-hidden">
                  {pathToMatches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setPathTo(m.id); setPathToSearch(m.name) }}
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              {pathTo && <p className="text-[10px] text-neon-green font-mono mt-1">Selected: {data.nodes.find((n) => n.id === pathTo)?.name}</p>}
            </div>
          </div>

          {/* Path result */}
          {pathResult && (
            <div className="mt-3 pt-3 border-t border-border-default">
              <p className="text-xs text-neon-green font-mono">
                Path found: {pathResult.path.length} nodes, {pathResult.edgeIds.size} connections
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {pathResult.path.map((nodeId, i) => {
                  const n = data.nodes.find((x) => x.id === nodeId)
                  return (
                    <span key={nodeId} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-text-muted">→</span>}
                      <span className="text-xs font-mono text-text-primary bg-elevated px-2 py-0.5 rounded">
                        {n?.name ?? nodeId}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {pathFrom && pathTo && !pathResult && (
            <p className="mt-3 text-xs text-critical font-mono">No path found between these entities</p>
          )}

          {(pathFrom || pathTo) && (
            <button onClick={clearPath} className="mt-3 text-xs text-text-muted hover:text-text-primary font-mono transition-colors">
              Clear path
            </button>
          )}
        </div>
      )}

      {/* Graph container */}
      <div ref={containerRef} className="bg-surface border border-border-default rounded-lg overflow-hidden relative min-h-[600px]">
        {filteredData && filteredData.nodes.length > 0 ? (
          <>
            <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full" style={{ background: '#0d0f11' }} />

            {/* Relationship legend (bottom-left overlay) */}
            {showLegend && (
              <div className="absolute bottom-4 left-4 bg-elevated/90 backdrop-blur-sm border border-border-default rounded-lg p-3 z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Connections</p>
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
                      <span className="text-[10px] font-mono text-text-secondary">{EDGE_CATEGORY_LABELS[cat]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-border-default space-y-1">
                  <p className="text-[9px] font-mono text-text-muted">Click node to pin</p>
                  <p className="text-[9px] font-mono text-text-muted">Double-click to view profile</p>
                  <p className="text-[9px] font-mono text-text-muted">Scroll to zoom</p>
                </div>
              </div>
            )}

            {!showLegend && (
              <button
                onClick={() => setShowLegend(true)}
                className="absolute bottom-4 left-4 bg-elevated/80 backdrop-blur-sm border border-border-default rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-text-muted hover:text-text-secondary z-10"
              >
                Legend
              </button>
            )}

            {/* Hover tooltip */}
            {hoveredNode && (
              <div className="absolute top-4 right-4 bg-elevated border border-border-default rounded-lg p-3 min-w-[180px] pointer-events-none shadow-lg z-10">
                <p className="text-sm font-medium text-text-primary">{hoveredNode.name}</p>
                <p className="text-xs text-text-muted mt-0.5">{hoveredNode.entity_type}</p>
                {hoveredNode.category && (
                  <p className="text-[10px] text-text-muted mt-0.5 font-mono">{hoveredNode.category}</p>
                )}
                {hoveredNode.tier && (
                  <div className="mt-1.5">
                    <TierBadge tier={hoveredNode.tier} size="sm" />
                  </div>
                )}
                {hoveredNode.slug && <p className="text-xs text-critical mt-1.5 font-mono">Double-click to view profile</p>}
              </div>
            )}

            {/* Edge tooltip */}
            {hoveredEdge && !hoveredNode && (
              <div className="absolute top-4 right-4 bg-elevated border border-border-default rounded-lg p-3 min-w-[200px] pointer-events-none shadow-lg z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-0.5 rounded" style={{ backgroundColor: getEdgeColor(hoveredEdge.relationship_type) }} />
                  <p className="text-xs font-mono text-text-primary">
                    {RELATIONSHIP_LABELS[hoveredEdge.relationship_type] ?? hoveredEdge.relationship_type.replace(/_/g, ' ')}
                  </p>
                </div>
                <p className="text-[10px] text-text-muted">
                  {data.nodes.find((n) => n.id === hoveredEdge.entity_a)?.name} → {data.nodes.find((n) => n.id === hoveredEdge.entity_b)?.name}
                </p>
                {hoveredEdge.description && (
                  <p className="text-[10px] text-text-secondary mt-1 line-clamp-3">{hoveredEdge.description}</p>
                )}
                {hoveredEdge.evidence_strength && (
                  <p className="text-[10px] font-mono mt-1" style={{ color: STRENGTH_COLORS[hoveredEdge.evidence_strength] ?? '#6B7280' }}>
                    {hoveredEdge.evidence_strength}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-sm text-text-muted font-mono">No connections match current filters</p>
          </div>
        )}
      </div>

      {/* Tier legend (below graph) */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-text-muted font-mono">
        <span className="text-text-secondary">Tiers:</span>
        {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
          <span key={tier} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
            T{tier}
          </span>
        ))}
      </div>
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
  if (name.length <= 20) return name
  return name.slice(0, 18) + '…'
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
