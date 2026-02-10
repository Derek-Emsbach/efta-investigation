'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import MainContent from '@/components/layout/main-content'
import { Skeleton } from '@/components/ui/skeleton'
import type { Tier } from '@efta/shared'

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

const TIER_LABELS: Record<number, string> = {
  1: 'Convicted / Charged',
  2: 'NPA Immunity',
  3: 'Suspicious',
  4: 'Social / Professional',
  5: 'Victim / Witness',
  6: 'Staff / Legal',
}

const DEFAULT_COLOR = '#4B5563'

const STRENGTH_OPACITY: Record<string, number> = {
  documented: 0.8,
  alleged: 0.5,
  circumstantial: 0.3,
}

// -------------------------------------------------------------------
// Page
// -------------------------------------------------------------------

export default function NetworkPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 })

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

  // D3 force simulation
  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions

    // Compute node degree for sizing
    const degreeMap = new Map<string, number>()
    for (const edge of data.edges) {
      degreeMap.set(edge.entity_a, (degreeMap.get(edge.entity_a) ?? 0) + 1)
      degreeMap.set(edge.entity_b, (degreeMap.get(edge.entity_b) ?? 0) + 1)
    }

    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }))
    const edges: GraphEdge[] = data.edges.map((e) => ({
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
      .attr('stroke', '#374151')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', (d) => STRENGTH_OPACITY[d.evidence_strength ?? ''] ?? 0.4)

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
      .style('opacity', 0) // hidden by default, shown on hover

    // Draw nodes
    const node = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => getNodeRadius(degreeMap.get(d.id) ?? 0))
      .attr('fill', (d) => TIER_COLORS[d.tier ?? 0] ?? DEFAULT_COLOR)
      .attr('stroke', '#0A0E17')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')

    // Draw labels
    const label = g.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .text((d) => truncateName(d.name))
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-body)')
      .attr('fill', '#F9FAFB')
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
      .on('mouseover', (event, d) => {
        setHoveredNode(d)
        // Highlight connected edges
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

        // Show edge labels for connected edges
        linkLabel.style('opacity', (e) => {
          const src = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source
          const tgt = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target
          return src === d.id || tgt === d.id ? 1 : 0
        })

        node
          .attr('opacity', (n) => connectedNodeIds.has(n.id) ? 1 : 0.2)
        label
          .attr('opacity', (n) => connectedNodeIds.has(n.id) ? 1 : 0.15)
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
        router.push(`/entities/${d.id}`)
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
    })

    return () => {
      simulation.stop()
    }
  }, [data, dimensions, router])

  return (
    <MainContent>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-text-primary">
            Network Graph
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Entity connections &mdash; hover to highlight, click to navigate, drag to rearrange
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        {([1, 2, 3, 4, 5, 6] as const).map((tier) => (
          <div key={tier} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: TIER_COLORS[tier] }}
            />
            <span className="text-xs text-text-muted">
              T{tier}: {TIER_LABELS[tier]}
            </span>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-surface border border-border-default rounded-lg p-8">
          <Skeleton className="w-full h-[500px]" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && data && data.nodes.length === 0 && (
        <div className="bg-surface border border-border-default rounded-lg p-16 text-center">
          <p className="text-sm text-text-muted">No connections found to visualize.</p>
        </div>
      )}

      {/* Graph */}
      {!isLoading && data && data.nodes.length > 0 && (
        <div
          ref={containerRef}
          className="bg-surface border border-border-default rounded-lg overflow-hidden relative"
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full"
            style={{ background: '#0A0E17' }}
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
      )}

      {/* Stats */}
      {!isLoading && data && data.nodes.length > 0 && (
        <div className="flex gap-6 mt-4">
          <p className="text-xs text-text-muted">
            <span className="text-text-secondary font-medium">{data.nodes.length}</span> entities
          </p>
          <p className="text-xs text-text-muted">
            <span className="text-text-secondary font-medium">{data.edges.length}</span> connections
          </p>
        </div>
      )}
    </MainContent>
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
