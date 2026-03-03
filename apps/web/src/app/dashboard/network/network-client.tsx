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

type ViewMode = 'graph' | 'table'
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
}

const STRENGTH_COLORS: Record<string, string> = {
  documented: '#10B981',
  alleged: '#F59E0B',
  circumstantial: '#6B7280',
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('graph')

  // Filter state (shared between views)
  const [activeTiers, setActiveTiers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]))
  const [activeRelationships, setActiveRelationships] = useState<Set<string>>(new Set())
  const [activeStrengths, setActiveStrengths] = useState<Set<string>>(
    new Set(['documented', 'alleged', 'circumstantial']),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
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
          setDimensions({ width, height: Math.max(500, Math.min(width * 0.65, 700)) })
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

    // Filter nodes by tier
    const filteredNodes = data.nodes.filter((n) => activeTiers.has(n.tier ?? 0))
    const nodeIds = new Set(filteredNodes.map((n) => n.id))

    // Filter edges: both endpoints must be visible, relationship type active, strength active
    const filteredEdges = data.edges.filter((e) => {
      if (!nodeIds.has(e.entity_a) || !nodeIds.has(e.entity_b)) return false
      if (!activeRelationships.has(e.relationship_type)) return false
      if (!activeStrengths.has(e.evidence_strength ?? 'circumstantial')) return false
      return true
    })

    // Re-filter nodes: only keep those with at least one visible edge
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
    return data.nodes
      .filter((n) => n.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, data])

  // Compute shortest path
  const pathResult = useMemo(() => {
    if (!pathFrom || !pathTo || !data) return null
    return findShortestPath(data.edges, pathFrom, pathTo)
  }, [pathFrom, pathTo, data])

  // Path search matches
  const pathFromMatches = useMemo(() => {
    if (!pathFromSearch.trim() || !data) return []
    const q = pathFromSearch.toLowerCase()
    return data.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 6)
  }, [pathFromSearch, data])

  const pathToMatches = useMemo(() => {
    if (!pathToSearch.trim() || !data) return []
    const q = pathToSearch.toLowerCase()
    return data.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 6)
  }, [pathToSearch, data])

  // Handle search selection
  const handleSearchSelect = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId)
    setSearchQuery('')
  }, [])

  const clearHighlight = useCallback(() => {
    setHighlightedNodeId(null)
  }, [])

  const clearPath = useCallback(() => {
    setPathFrom(null)
    setPathTo(null)
    setPathFromSearch('')
    setPathToSearch('')
  }, [])

  // Toggle helpers
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

    // Apply search filter for table view
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

    // Sort
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
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove()
      }
      return
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions

    // Compute node degree for sizing
    const degreeMap = new Map<string, number>()
    for (const edge of filteredData.edges) {
      degreeMap.set(edge.entity_a, (degreeMap.get(edge.entity_a) ?? 0) + 1)
      degreeMap.set(edge.entity_b, (degreeMap.get(edge.entity_b) ?? 0) + 1)
    }

    const nodes: GraphNode[] = filteredData.nodes.map((n) => ({ ...n }))
    const edges: GraphEdge[] = filteredData.edges.map((e) => ({
      ...e,
      source: e.entity_a,
      target: e.entity_b,
    }))

    // Zoom container
    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
        .id((d) => d.id)
        .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => {
        const node = d as GraphNode
        return getNodeRadius(degreeMap.get(node.id) ?? 0) + 4
      }))

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => pathResult?.edgeIds.has(d.id) ? '#10B981' : '#374151')
      .attr('stroke-width', (d) => pathResult?.edgeIds.has(d.id) ? 3 : 1.5)
      .attr('stroke-opacity', (d) => {
        if (pathResult) return pathResult.edgeIds.has(d.id) ? 1 : 0.1
        return STRENGTH_OPACITY[d.evidence_strength ?? ''] ?? 0.4
      })

    // Draw edge labels
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .text((d) => formatRelationship(d.relationship_type))
      .attr('font-size', '8px')
      .attr('fill', '#6B7280')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .style('pointer-events', 'none')
      .style('opacity', 0)

    // Draw nodes
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
        if (d.id === highlightedNodeId) return '#FFFFFF'
        return 'var(--color-background)'
      })
      .attr('stroke-width', (d) => {
        if (d.id === pathFrom || d.id === pathTo) return 3
        if (pathResult?.nodeIds.has(d.id)) return 2.5
        if (d.id === highlightedNodeId) return 3
        return 2
      })
      .attr('opacity', (d) => {
        if (pathResult) return pathResult.nodeIds.has(d.id) ? 1 : 0.15
        return 1
      })
      .style('cursor', 'pointer')

    // Highlight ring for searched node
    if (highlightedNodeId) {
      const highlightNode = nodes.find((n) => n.id === highlightedNodeId)
      if (highlightNode) {
        g.append('g')
          .append('circle')
          .datum(highlightNode)
          .attr('r', getNodeRadius(degreeMap.get(highlightNode.id) ?? 0) + 6)
          .attr('fill', 'none')
          .attr('stroke', '#3B82F6')
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '4,3')
          .attr('class', 'highlight-ring')
          .style('pointer-events', 'none')
      }
    }

    // Draw labels
    const label = g.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .text((d) => truncateName(d.name))
      .attr('font-size', (d) => {
        if (pathResult?.nodeIds.has(d.id)) return '12px'
        if (d.id === highlightedNodeId) return '12px'
        return '10px'
      })
      .attr('font-weight', (d) => {
        if (pathResult?.nodeIds.has(d.id)) return '600'
        if (d.id === highlightedNodeId) return '600'
        return 'normal'
      })
      .attr('font-family', 'var(--font-body)')
      .attr('fill', (d) => {
        if (pathResult?.nodeIds.has(d.id)) return '#FFFFFF'
        if (d.id === highlightedNodeId) return '#FFFFFF'
        return '#F9FAFB'
      })
      .attr('opacity', (d) => {
        if (pathResult) return pathResult.nodeIds.has(d.id) ? 1 : 0.1
        return 1
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(degreeMap.get(d.id) ?? 0) + 14)
      .style('pointer-events', 'none')

    // Drag behavior
    const drag = d3.drag<SVGCircleElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
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

    // Hover effects
    node
      .on('mouseover', (_event, d) => {
        setHoveredNode(d)
        const connectedNodeIds = new Set<string>()
        connectedNodeIds.add(d.id)

        link
          .attr('stroke-opacity', (e) => {
            const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
            const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
            if (src === d.id || tgt === d.id) {
              connectedNodeIds.add(src as string)
              connectedNodeIds.add(tgt as string)
              return 1
            }
            return 0.08
          })
          .attr('stroke', (e) => {
            const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
            const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
            return src === d.id || tgt === d.id ? '#F59E0B' : '#374151'
          })
          .attr('stroke-width', (e) => {
            const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
            const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
            return src === d.id || tgt === d.id ? 2.5 : 1.5
          })

        linkLabel.style('opacity', (e) => {
          const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
          const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
          return src === d.id || tgt === d.id ? 1 : 0
        })

        node.attr('opacity', (n) => connectedNodeIds.has(n.id) ? 1 : 0.2)
        label.attr('opacity', (n) => connectedNodeIds.has(n.id) ? 1 : 0.15)
      })
      .on('mouseout', () => {
        setHoveredNode(null)
        link
          .attr('stroke', '#374151')
          .attr('stroke-opacity', (d) => STRENGTH_OPACITY[d.evidence_strength ?? ''] ?? 0.4)
          .attr('stroke-width', 1.5)
        linkLabel.style('opacity', 0)
        node.attr('opacity', 1)
        label.attr('opacity', 1)
      })
      .on('click', (_event, d) => {
        router.push(`/dashboard/entities/${d.id}`)
      })

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)

      linkLabel
        .attr('x', (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2)

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

    // If highlighted node exists, zoom to it after simulation settles
    if (highlightedNodeId) {
      simulation.on('end', () => {
        const hn = nodes.find((n) => n.id === highlightedNodeId)
        if (hn && hn.x != null && hn.y != null) {
          const scale = 1.8
          const tx = width / 2 - hn.x * scale
          const ty = height / 2 - hn.y * scale
          svg.transition()
            .duration(750)
            .call(
              zoom.transform,
              d3.zoomIdentity.translate(tx, ty).scale(scale),
            )
        }
      })
    }

    return () => {
      simulation.stop()
    }
  }, [viewMode, filteredData, dimensions, router, highlightedNodeId, pathResult, pathFrom, pathTo])

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
        subtitle="Entity connections — hover to highlight, click to navigate, drag to rearrange"
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
        {/* Search */}
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

          {/* Search dropdown (graph view only) */}
          {viewMode === 'graph' && searchQuery.trim() && searchMatches.length > 0 && (
            <div className="absolute top-full mt-1 right-0 w-64 bg-elevated border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
              {searchMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => handleSearchSelect(match.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: TIER_COLORS[match.tier ?? 0] ?? DEFAULT_COLOR }}
                  />
                  <span className="truncate">{match.name}</span>
                  {match.tier && (
                    <span className="text-xs text-text-muted ml-auto shrink-0">T{match.tier}</span>
                  )}
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

        {/* Highlighted node indicator */}
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

        {/* Graph-only actions */}
        {viewMode === 'graph' && (
          <>
            {/* Path finder toggle */}
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

            {/* Export SVG */}
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

            {/* Export PNG */}
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
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Entity Tiers
                </p>
                <button
                  onClick={selectAllTiers}
                  className="text-[10px] text-info hover:text-info/80 transition-colors"
                >
                  Select all
                </button>
              </div>
              <div className="space-y-1.5">
                {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
                  <label
                    key={tier}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={activeTiers.has(tier)}
                      onChange={() => toggleTier(tier)}
                      className="sr-only"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                        activeTiers.has(tier)
                          ? 'border-transparent'
                          : 'border-border-default'
                      }`}
                      style={{
                        backgroundColor: activeTiers.has(tier) ? TIER_COLORS[tier] : 'transparent',
                      }}
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
                    <span className="text-[10px] text-text-muted ml-auto">
                      {tierCounts.get(tier) ?? 0}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Relationship type filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Relationship Types
                </p>
                <button
                  onClick={selectAllRelationships}
                  className="text-[10px] text-info hover:text-info/80 transition-colors"
                >
                  Select all
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {relationshipTypes.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={activeRelationships.has(type)}
                      onChange={() => toggleRelationship(type)}
                      className="sr-only"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                        activeRelationships.has(type)
                          ? 'bg-info border-info'
                          : 'border-border-default'
                      }`}
                    >
                      {activeRelationships.has(type) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize">
                      {RELATIONSHIP_LABELS[type] ?? formatRelationship(type)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Evidence strength filters */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
                Evidence Strength
              </p>
              <div className="space-y-1.5">
                {(['documented', 'alleged', 'circumstantial'] as const).map((strength) => (
                  <label
                    key={strength}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={activeStrengths.has(strength)}
                      onChange={() => toggleStrength(strength)}
                      className="sr-only"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                        activeStrengths.has(strength)
                          ? 'bg-info border-info'
                          : 'border-border-default'
                      }`}
                    >
                      {activeStrengths.has(strength) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize">
                      {strength}
                    </span>
                    <span
                      className="ml-auto w-8 h-0.5 rounded"
                      style={{
                        backgroundColor: '#374151',
                        opacity: STRENGTH_OPACITY[strength],
                      }}
                    />
                  </label>
                ))}
              </div>

              {/* Quick filter actions */}
              <div className="mt-4 pt-3 border-t border-border-default">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
                  Quick Filters
                </p>
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

      {/* Path finder panel (graph view only) */}
      {viewMode === 'graph' && showPathFinder && (
        <div className="bg-surface border border-border-default rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M13 6l6 6-6 6" />
              <path strokeLinecap="round" d="M5 6l6 6-6 6" />
            </svg>
            <p className="text-sm font-medium text-text-primary">Find Shortest Path Between Entities</p>
            {pathResult && (
              <button
                onClick={clearPath}
                className="ml-auto text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Clear path
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
            {/* From entity */}
            <div className="flex-1 relative">
              <label className="text-xs text-text-muted mb-1 block">From</label>
              {pathFrom && data ? (
                <div className="flex items-center gap-2 bg-elevated border border-success/30 rounded px-3 py-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: TIER_COLORS[data.nodes.find((n) => n.id === pathFrom)?.tier ?? 0] ?? DEFAULT_COLOR }}
                  />
                  <span className="text-sm text-text-primary truncate">
                    {data.nodes.find((n) => n.id === pathFrom)?.name}
                  </span>
                  <button
                    onClick={() => { setPathFrom(null); setPathFromSearch('') }}
                    className="ml-auto shrink-0 text-text-muted hover:text-text-secondary"
                  >
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
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: TIER_COLORS[m.tier ?? 0] ?? DEFAULT_COLOR }}
                          />
                          <span className="truncate">{m.name}</span>
                          <span className="text-xs text-text-muted ml-auto capitalize shrink-0">{m.entity_type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center pt-5">
              <svg className="w-6 h-6 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </div>

            {/* To entity */}
            <div className="flex-1 relative">
              <label className="text-xs text-text-muted mb-1 block">To</label>
              {pathTo && data ? (
                <div className="flex items-center gap-2 bg-elevated border border-success/30 rounded px-3 py-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: TIER_COLORS[data.nodes.find((n) => n.id === pathTo)?.tier ?? 0] ?? DEFAULT_COLOR }}
                  />
                  <span className="text-sm text-text-primary truncate">
                    {data.nodes.find((n) => n.id === pathTo)?.name}
                  </span>
                  <button
                    onClick={() => { setPathTo(null); setPathToSearch('') }}
                    className="ml-auto shrink-0 text-text-muted hover:text-text-secondary"
                  >
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
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: TIER_COLORS[m.tier ?? 0] ?? DEFAULT_COLOR }}
                          />
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

          {/* Path result info */}
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
                <p className="text-xs text-warning">
                  No path found between these entities with current filters.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tier legend (compact, always visible — clickable to toggle) */}
      <div className="flex flex-wrap gap-4 mb-4">
        {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => toggleTier(tier)}
            className={`flex items-center gap-1.5 transition-opacity ${
              activeTiers.has(tier) ? 'opacity-100' : 'opacity-30'
            }`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: TIER_COLORS[tier] }}
            />
            <span className="text-xs text-text-muted">
              T{tier}: {TIER_LABELS[tier]}
            </span>
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

      {/* ============================================================
          GRAPH VIEW
          ============================================================ */}
      {viewMode === 'graph' && !isLoading && filteredData && filteredData.nodes.length > 0 && (
        <>
          <div
            ref={containerRef}
            className="bg-surface border border-border-default rounded-lg overflow-hidden relative min-h-[600px]"
          >
            <svg
              ref={svgRef}
              width={dimensions.width || '100%'}
              height={dimensions.height || 500}
              className="w-full bg-background"
            />

            {/* Hover tooltip */}
            {hoveredNode && (
              <div className="absolute top-4 right-4 bg-elevated border border-border-default rounded-lg p-3 min-w-[180px] pointer-events-none">
                <p className="font-display text-sm font-semibold text-text-primary">
                  {hoveredNode.name}
                </p>
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
                    <span className="text-xs text-text-muted capitalize">
                      {hoveredNode.category.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1.5">Click to view profile</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4">
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{filteredData.nodes.length}</span>
              {data && filteredData.nodes.length < data.nodes.length
                ? ` / ${data.nodes.length}`
                : ''}{' '}
              entities
            </p>
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{filteredData.edges.length}</span>
              {data && filteredData.edges.length < data.edges.length
                ? ` / ${data.edges.length}`
                : ''}{' '}
              connections
            </p>
          </div>
        </>
      )}

      {/* ============================================================
          TABLE VIEW
          ============================================================ */}
      {viewMode === 'table' && !isLoading && filteredData && filteredData.nodes.length > 0 && (
        <>
          <div className="bg-surface border border-border-default rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <SortableHeader
                      label="Entity A"
                      sortKey="entity_a"
                      currentKey={sortKey}
                      direction={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Relationship"
                      sortKey="relationship"
                      currentKey={sortKey}
                      direction={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Entity B"
                      sortKey="entity_b"
                      currentKey={sortKey}
                      direction={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Evidence"
                      sortKey="strength"
                      currentKey={sortKey}
                      direction={sortDir}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {tableRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-elevated/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/entities/${row.entityA!.id}`}
                            className="text-text-primary hover:text-info transition-colors font-medium"
                          >
                            {row.entityA!.name}
                          </Link>
                          {row.entityA!.tier && (
                            <TierBadge tier={row.entityA!.tier as Tier} />
                          )}
                        </div>
                        <p className="text-xs text-text-muted capitalize mt-0.5">
                          {row.entityA!.entity_type}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-text-secondary capitalize">
                          {RELATIONSHIP_LABELS[row.relationship] ?? formatRelationship(row.relationship)}
                        </span>
                        {row.description && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                            {row.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/entities/${row.entityB!.id}`}
                            className="text-text-primary hover:text-info transition-colors font-medium"
                          >
                            {row.entityB!.name}
                          </Link>
                          {row.entityB!.tier && (
                            <TierBadge tier={row.entityB!.tier as Tier} />
                          )}
                        </div>
                        <p className="text-xs text-text-muted capitalize mt-0.5">
                          {row.entityB!.entity_type}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium capitalize px-2 py-0.5 rounded"
                          style={{
                            color: STRENGTH_COLORS[row.strength] ?? '#6B7280',
                            backgroundColor: `${STRENGTH_COLORS[row.strength] ?? '#6B7280'}15`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: STRENGTH_COLORS[row.strength] ?? '#6B7280' }}
                          />
                          {row.strength}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4">
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{tableRows.length}</span>
              {filteredData.edges.length !== tableRows.length
                ? ` / ${filteredData.edges.length}`
                : ''}{' '}
              connections
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
  return Math.max(6, Math.min(20, 6 + degree * 2.5))
}

function truncateName(name: string): string {
  if (name.length <= 18) return name
  return name.slice(0, 16) + '...'
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
        return {
          nodeIds: new Set(newPath),
          edgeIds: new Set(newEdges),
          path: newPath,
        }
      }

      visited.add(neighbor.nodeId)
      queue.push({ nodeId: neighbor.nodeId, path: newPath, edgeIds: newEdges })
    }
  }

  return null
}
