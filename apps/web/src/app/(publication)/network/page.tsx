'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
// Constants — publication-adapted palette
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

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function PublicNetworkPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 })

  // Filter state
  const [activeTiers, setActiveTiers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]))
  const [activeRelationships, setActiveRelationships] = useState<Set<string>>(new Set())
  const [activeStrengths, setActiveStrengths] = useState<Set<string>>(
    new Set(['documented', 'alleged', 'circumstantial']),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
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
        setDimensions({ width, height: Math.max(500, Math.min(width * 0.65, 700)) })
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

    // Compute node degree
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

    const g = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => {
        const node = d as GraphNode
        return getNodeRadius(degreeMap.get(node.id) ?? 0) + 4
      }))

    // Edges
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => pathResult?.edgeIds.has(d.id) ? '#10B981' : '#4a4a4a')
      .attr('stroke-width', (d) => pathResult?.edgeIds.has(d.id) ? 3 : 1.5)
      .attr('stroke-opacity', (d) => {
        if (pathResult) return pathResult.edgeIds.has(d.id) ? 1 : 0.1
        return STRENGTH_OPACITY[d.evidence_strength ?? ''] ?? 0.4
      })

    const linkLabel = g.append('g')
      .selectAll('text')
      .data(edges)
      .join('text')
      .text((d) => formatRelationship(d.relationship_type))
      .attr('font-size', '8px')
      .attr('fill', '#9a9a9a')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .style('pointer-events', 'none')
      .style('opacity', 0)

    // Nodes
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
        return '#111318'
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

    // Highlight ring
    if (highlightedNodeId) {
      const hn = nodes.find((n) => n.id === highlightedNodeId)
      if (hn) {
        g.append('g').append('circle')
          .datum(hn)
          .attr('r', getNodeRadius(degreeMap.get(hn.id) ?? 0) + 6)
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
      .attr('font-size', (d) => (pathResult?.nodeIds.has(d.id) || d.id === highlightedNodeId) ? '12px' : '10px')
      .attr('font-weight', (d) => (pathResult?.nodeIds.has(d.id) || d.id === highlightedNodeId) ? '600' : 'normal')
      .attr('font-family', "'DM Sans', sans-serif")
      .attr('fill', (d) => (pathResult?.nodeIds.has(d.id) || d.id === highlightedNodeId) ? '#FFFFFF' : '#F9FAFB')
      .attr('opacity', (d) => {
        if (pathResult) return pathResult.nodeIds.has(d.id) ? 1 : 0.1
        return 1
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(degreeMap.get(d.id) ?? 0) + 14)
      .style('pointer-events', 'none')

    // Drag
    const drag = d3.drag<SVGCircleElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null; d.fy = null
      })
    node.call(drag)

    // Hover
    node
      .on('mouseover', (_event, d) => {
        setHoveredNode(d)
        const connected = new Set<string>([d.id])
        link
          .attr('stroke-opacity', (e) => {
            const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
            const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
            if (src === d.id || tgt === d.id) {
              connected.add(src as string); connected.add(tgt as string)
              return 1
            }
            return 0.08
          })
          .attr('stroke', (e) => {
            const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
            const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
            return (src === d.id || tgt === d.id) ? '#b8860b' : '#4a4a4a'
          })
          .attr('stroke-width', (e) => {
            const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
            const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
            return (src === d.id || tgt === d.id) ? 2.5 : 1.5
          })
        linkLabel.style('opacity', (e) => {
          const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
          const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
          return (src === d.id || tgt === d.id) ? 1 : 0
        })
        node.attr('opacity', (n) => connected.has(n.id) ? 1 : 0.2)
        label.attr('opacity', (n) => connected.has(n.id) ? 1 : 0.15)
      })
      .on('mouseout', () => {
        setHoveredNode(null)
        link
          .attr('stroke', '#4a4a4a')
          .attr('stroke-opacity', (d) => STRENGTH_OPACITY[d.evidence_strength ?? ''] ?? 0.4)
          .attr('stroke-width', 1.5)
        linkLabel.style('opacity', 0)
        node.attr('opacity', 1)
        label.attr('opacity', 1)
      })
      .on('click', (_event, d) => {
        if (d.slug) router.push(`/entities/${d.slug}`)
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

    if (highlightedNodeId) {
      simulation.on('end', () => {
        const hn = nodes.find((n) => n.id === highlightedNodeId)
        if (hn && hn.x != null && hn.y != null) {
          const scale = 1.8
          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(width / 2 - hn.x * scale, height / 2 - hn.y * scale).scale(scale),
          )
        }
      })
    }

    return () => { simulation.stop() }
  }, [filteredData, dimensions, router, highlightedNodeId, pathResult, pathFrom, pathTo])

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-display text-[clamp(28px,4vw,42px)] font-bold text-text-primary tracking-[-0.01em]">
            The Network Map
          </h1>
          <p className="font-body text-text-secondary mt-1">
            Every documented connection across six evidence tiers. Hover to highlight, click to view profile, drag to rearrange.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Highlighted indicator */}
          {highlightedNodeId && data && (
            <button
              onClick={clearHighlight}
              className="flex items-center gap-1.5 bg-accent-gold/10 border border-accent-gold/30 px-2.5 py-1.5 text-xs text-accent-gold hover:bg-accent-gold/20 transition-colors font-sans"
            >
              <span className="font-medium">{data.nodes.find((n) => n.id === highlightedNodeId)?.name ?? 'Entity'}</span>
              <span>&times;</span>
            </button>
          )}

          {/* Path finder */}
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

          {/* Filters */}
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
            {/* Tier filters */}
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

            {/* Relationship filters */}
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
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors capitalize font-sans">
                      {RELATIONSHIP_LABELS[type] ?? formatRelationship(type)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Strength filters */}
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

      {/* Path finder panel */}
      {showPathFinder && (
        <div className="bg-white border border-border-default p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-text-primary font-sans">Find Shortest Path Between Entities</p>
            {pathResult && <button onClick={clearPath} className="ml-auto text-xs text-text-muted hover:text-text-secondary font-sans">Clear path</button>}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
            {/* From */}
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
            {/* To */}
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

      {/* Loading state */}
      {isLoading && (
        <div className="border border-border-default p-8">
          <div className="w-full h-[500px] bg-elevated animate-pulse" />
        </div>
      )}

      {/* Empty state */}
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

          {/* Hover tooltip */}
          {hoveredNode && (
            <div className="absolute top-4 right-4 bg-white border border-border-default p-3 min-w-[180px] pointer-events-none shadow-sm">
              <p className="font-display text-sm font-semibold text-text-primary">{hoveredNode.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {hoveredNode.tier && (
                  <span className="text-xs font-medium px-1.5 py-0.5 font-mono" style={{ color: TIER_COLORS[hoveredNode.tier] ?? DEFAULT_COLOR, backgroundColor: `${TIER_COLORS[hoveredNode.tier] ?? DEFAULT_COLOR}20` }}>
                    Tier {hoveredNode.tier}
                  </span>
                )}
                {hoveredNode.category && <span className="text-xs text-text-muted capitalize">{hoveredNode.category.replace(/_/g, ' ')}</span>}
              </div>
              {hoveredNode.slug && <p className="text-xs text-accent-gold mt-1.5">Click to view profile</p>}
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
  return Math.max(6, Math.min(20, 6 + degree * 2.5))
}

function truncateName(name: string): string {
  return name.length <= 18 ? name : name.slice(0, 16) + '...'
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
