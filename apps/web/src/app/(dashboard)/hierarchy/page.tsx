'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import MainContent from '@/components/layout/main-content'
import { Skeleton } from '@/components/ui/skeleton'

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface EntityNode {
  id: string
  name: string
  entity_type: string
  tier: number | null
  category: string | null
}

interface Connection {
  id: string
  entity_a: string
  entity_b: string
  relationship_type: string
  evidence_strength: string | null
  description: string | null
}

interface TreeNode {
  id: string
  name: string
  entity_type: string
  tier: number | null
  relationship: string | null
  children: TreeNode[]
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

const ENTITY_TYPE_ICONS: Record<string, string> = {
  person: '\u{1F464}',       // silhouette
  organization: '\u{1F3E2}', // office building
  property: '\u{1F3E0}',     // house
  trust: '\u{1F4BC}',        // briefcase
  agency: '\u{1F3DB}',       // classical building
  vehicle: '\u{2708}',       // airplane
}

const DEFAULT_COLOR = '#4B5563'

// Relationships where entity_a is "below" entity_b (child→parent direction)
const PARENT_RELS = new Set([
  'owned_by', 'subsidiary_of', 'employed_by', 'hired_by',
  'represented_by', 'investigated_by', 'referred_by',
])

// Relationships where entity_a is "above" entity_b (parent→child direction)
const CHILD_RELS = new Set([
  'attorney_for',
])

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
// Build tree from graph data
// -------------------------------------------------------------------

function buildTree(
  rootId: string,
  entities: EntityNode[],
  connections: Connection[],
): TreeNode | null {
  const entityMap = new Map(entities.map((e) => [e.id, e]))
  const root = entityMap.get(rootId)
  if (!root) return null

  // Build adjacency: parent → { childId, relationship }[]
  const children = new Map<string, { childId: string; rel: string }[]>()

  for (const conn of connections) {
    if (PARENT_RELS.has(conn.relationship_type)) {
      // entity_a is child of entity_b
      const parentId = conn.entity_b
      const childId = conn.entity_a
      if (!children.has(parentId)) children.set(parentId, [])
      children.get(parentId)!.push({ childId, rel: conn.relationship_type })
    } else if (CHILD_RELS.has(conn.relationship_type)) {
      // entity_a is parent of entity_b
      const parentId = conn.entity_a
      const childId = conn.entity_b
      if (!children.has(parentId)) children.set(parentId, [])
      children.get(parentId)!.push({ childId, rel: conn.relationship_type })
    }
    // Symmetric relationships (connected_to, family_of, paid_by) shown both ways
    if (!PARENT_RELS.has(conn.relationship_type) && !CHILD_RELS.has(conn.relationship_type)) {
      if (!children.has(conn.entity_b)) children.set(conn.entity_b, [])
      children.get(conn.entity_b)!.push({ childId: conn.entity_a, rel: conn.relationship_type })
      if (!children.has(conn.entity_a)) children.set(conn.entity_a, [])
      children.get(conn.entity_a)!.push({ childId: conn.entity_b, rel: conn.relationship_type })
    }
  }

  // BFS to build tree (cycle-safe)
  const visited = new Set<string>()

  function build(id: string, rel: string | null): TreeNode {
    visited.add(id)
    const entity = entityMap.get(id)!
    const kids = (children.get(id) ?? [])
      .filter((c) => !visited.has(c.childId) && entityMap.has(c.childId))
      .map((c) => build(c.childId, c.rel))

    return {
      id,
      name: entity.name,
      entity_type: entity.entity_type,
      tier: entity.tier,
      relationship: rel,
      children: kids,
    }
  }

  return build(rootId, null)
}

function countDescendants(node: TreeNode): number {
  let count = 0
  for (const child of node.children) {
    count += 1 + countDescendants(child)
  }
  return count
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function HierarchyPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [entities, setEntities] = useState<EntityNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rootId, setRootId] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 })

  // Fetch graph data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/network')
        if (!res.ok) throw new Error('Failed to load network data')
        const data = await res.json() as { nodes: EntityNode[]; edges: Connection[] }
        setEntities(data.nodes)
        setConnections(data.edges)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Measure container
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: Math.max(rect.height, 500) })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Compute candidate roots: entities with most descendants, sorted descending
  const rootCandidates = useMemo(() => {
    if (entities.length === 0 || connections.length === 0) return []

    const candidates: { id: string; name: string; entity_type: string; descendants: number }[] = []

    for (const entity of entities) {
      const tree = buildTree(entity.id, entities, connections)
      if (tree) {
        const desc = countDescendants(tree)
        if (desc > 0) {
          candidates.push({
            id: entity.id,
            name: entity.name,
            entity_type: entity.entity_type,
            descendants: desc,
          })
        }
      }
    }

    candidates.sort((a, b) => b.descendants - a.descendants)
    return candidates.slice(0, 30) // top 30
  }, [entities, connections])

  // Auto-select root
  useEffect(() => {
    if (!rootId && rootCandidates.length > 0) {
      setRootId(rootCandidates[0].id)
    }
  }, [rootId, rootCandidates])

  // Build tree for selected root
  const tree = useMemo(() => {
    if (!rootId) return null
    return buildTree(rootId, entities, connections)
  }, [rootId, entities, connections])

  // Render D3 tree
  const renderTree = useCallback(() => {
    if (!svgRef.current || !tree) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 40, right: 120, bottom: 40, left: 120 }
    const width = dimensions.width - margin.left - margin.right
    const height = dimensions.height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create D3 hierarchy
    const root = d3.hierarchy(tree)
    const nodeCount = root.descendants().length
    const dynamicHeight = Math.max(height, nodeCount * 40)

    // Tree layout
    const treeLayout = d3.tree<TreeNode>().size([dynamicHeight, width])
    const treeData = treeLayout(root)

    // Resize SVG to fit
    const actualHeight = dynamicHeight + margin.top + margin.bottom
    svg.attr('height', actualHeight)

    // Links
    g.selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
        .x((d) => d.y)
        .y((d) => d.x))

    // Relationship labels on links
    g.selectAll('.link-label')
      .data(treeData.links().filter((l) => l.target.data.relationship))
      .enter()
      .append('text')
      .attr('x', (l) => (l.source.y + l.target.y) / 2)
      .attr('y', (l) => (l.source.x + l.target.x) / 2 - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6B7280')
      .attr('font-size', '9px')
      .text((l) => RELATIONSHIP_LABELS[l.target.data.relationship!] ?? l.target.data.relationship!)

    // Nodes
    const node = g.selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const entityId = d.data.id
        // If clicking a node that could be a root, re-root the tree
        if (d.children || d.data.children.length > 0) {
          setRootId(entityId)
        } else {
          // Navigate to entity detail
          router.push(`/entities/${entityId}`)
        }
      })

    // Node circles
    node.append('circle')
      .attr('r', (d) => d.children ? 8 : 6)
      .attr('fill', (d) => {
        const tier = d.data.tier
        return tier ? TIER_COLORS[tier] ?? DEFAULT_COLOR : DEFAULT_COLOR
      })
      .attr('stroke', '#1F2937')
      .attr('stroke-width', 2)

    // Entity type icon
    node.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .text((d) => ENTITY_TYPE_ICONS[d.data.entity_type] ?? '')

    // Node labels
    node.append('text')
      .attr('dy', '0.35em')
      .attr('x', (d) => d.children ? -14 : 14)
      .attr('text-anchor', (d) => d.children ? 'end' : 'start')
      .attr('fill', '#D1D5DB')
      .attr('font-size', '12px')
      .attr('font-weight', (d) => d.depth === 0 ? '700' : '400')
      .text((d) => d.data.name)

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Fit to view
    const bounds = g.node()?.getBBox()
    if (bounds) {
      const fullWidth = dimensions.width
      const fullHeight = actualHeight
      const midX = bounds.x + bounds.width / 2
      const midY = bounds.y + bounds.height / 2
      const scale = Math.min(
        fullWidth / (bounds.width + 160),
        fullHeight / (bounds.height + 80),
        1.5,
      )
      const tx = fullWidth / 2 - midX * scale
      const ty = fullHeight / 2 - midY * scale
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }
  }, [tree, dimensions, router])

  useEffect(() => {
    renderTree()
  }, [renderTree])

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <MainContent>
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </MainContent>
    )
  }

  if (error) {
    return (
      <MainContent>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-text-primary">
              Hierarchy
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Organizational structure and ownership chains
            </p>
          </div>
        </div>
        <div className="bg-critical/10 border border-critical/30 rounded-lg p-6 text-critical">
          {error}
        </div>
      </MainContent>
    )
  }

  if (entities.length === 0) {
    return (
      <MainContent>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-text-primary">
              Hierarchy
            </h1>
          </div>
        </div>
        <div className="bg-surface border border-border-default rounded-lg p-12 text-center text-text-muted text-sm">
          No entity data available. Import entities and connections to view hierarchy.
        </div>
      </MainContent>
    )
  }

  return (
    <MainContent>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-text-primary">
            Hierarchy
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Organizational structure and ownership chains
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="root-select" className="text-sm text-text-secondary">
            Root entity:
          </label>
          <select
            id="root-select"
            value={rootId ?? ''}
            onChange={(e) => setRootId(e.target.value || null)}
            className="bg-surface border border-border-default rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-info"
          >
            {rootCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.entity_type}) — {c.descendants} connections
              </option>
            ))}
          </select>
        </div>

        {tree && (
          <span className="text-xs text-text-muted">
            {countDescendants(tree) + 1} nodes in tree
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">Tier colors:</span>
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <span key={tier} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            T{tier}
          </span>
        ))}
        <span className="ml-4 font-medium text-text-secondary">Click parent node to re-root</span>
      </div>

      {/* Tree visualization */}
      <div
        ref={containerRef}
        className="bg-surface border border-border-default rounded-lg overflow-hidden"
        style={{ height: 'calc(100vh - 320px)', minHeight: 500 }}
      >
        {tree ? (
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            style={{ display: 'block' }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select a root entity to view the hierarchy tree.
          </div>
        )}
      </div>
    </MainContent>
  )
}
