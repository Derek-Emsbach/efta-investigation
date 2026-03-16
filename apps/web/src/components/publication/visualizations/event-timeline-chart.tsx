'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'

const CATEGORY_COLORS: Record<string, string> = {
  doj_release: '#b8860b',
  doj_action: '#c41e3a',
  congressional_action: '#283593',
  court_action: '#6a1b9a',
  criminal_action: '#455a64',
}

const CATEGORY_LABELS: Record<string, string> = {
  doj_release: 'DOJ Releases',
  doj_action: 'DOJ Actions',
  congressional_action: 'Congressional Actions',
  court_action: 'Court Actions',
  criminal_action: 'Criminal Actions',
}

const IMPACT_SIZE: Record<string, number> = {
  critical: 10,
  high: 8,
  medium: 6,
  low: 4,
}

interface TimelineEvent {
  id: string
  date: string
  title: string
  description?: string
  category: string
  impact_level: string
}

interface EventTimelineChartProps {
  events: TimelineEvent[]
}

function formatCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function EventTimelineChart({ events }: EventTimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const render = useCallback(() => {
    if (!svgRef.current || events.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Parse dates and get categories
    const parsed = events
      .map(e => ({ ...e, parsedDate: new Date(e.date) }))
      .filter(e => !isNaN(e.parsedDate.getTime()))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())

    const categories = Array.from(new Set(parsed.map(e => e.category)))

    const margin = { top: 24, right: 20, bottom: 40, left: 160 }
    const laneHeight = 40
    const chartHeight = categories.length * laneHeight
    const height = chartHeight + margin.top + margin.bottom

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const dateExtent = d3.extent(parsed, d => d.parsedDate) as [Date, Date]
    const x = d3.scaleTime()
      .domain(dateExtent)
      .range([0, width - margin.left - margin.right])

    const y = d3
      .scaleBand<string>()
      .domain(categories)
      .range([0, chartHeight])
      .paddingInner(0.2)

    // Gridlines
    g.selectAll('.lane-bg')
      .data(categories)
      .join('rect')
      .attr('class', 'lane-bg')
      .attr('x', 0)
      .attr('y', d => y(d) ?? 0)
      .attr('width', width - margin.left - margin.right)
      .attr('height', y.bandwidth())
      .attr('fill', (_, i) => i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent')

    // X axis
    const xAxis = d3.axisBottom(x)
      .ticks(Math.min(8, width / 100))
      .tickFormat(d3.timeFormat('%b %Y') as (domainValue: Date | d3.NumberValue, index: number) => string)

    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-family', 'var(--font-sans)')
      .attr('font-size', '10px')
      .attr('fill', 'currentColor')

    g.selectAll('.domain, .tick line')
      .attr('stroke', 'currentColor')
      .attr('opacity', 0.2)

    // Category labels (left)
    g.selectAll('.cat-label')
      .data(categories)
      .join('text')
      .attr('class', 'cat-label')
      .attr('x', -12)
      .attr('y', d => (y(d) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-family', 'var(--font-sans)')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', d => CATEGORY_COLORS[d] ?? '#455a64')
      .text(d => formatCategoryLabel(d))

    // Dots
    const dots = g.selectAll('.dot')
      .data(parsed)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.parsedDate))
      .attr('cy', d => (y(d.category) ?? 0) + y.bandwidth() / 2)
      .attr('r', 0)
      .attr('fill', d => CATEGORY_COLORS[d.category] ?? '#455a64')
      .attr('opacity', 0.85)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')

    dots
      .transition()
      .duration(600)
      .delay((_, i) => i * 15)
      .ease(d3.easeCubicOut)
      .attr('r', d => IMPACT_SIZE[d.impact_level] ?? 6)

    // Tooltip interactions
    const tooltip = d3.select(tooltipRef.current)

    dots
      .on('mouseenter', (event, d) => {
        const dot = d3.select(event.currentTarget as SVGCircleElement)
        dot.transition().duration(150).attr('opacity', 1).attr('r', (IMPACT_SIZE[d.impact_level] ?? 6) + 2)

        tooltip
          .style('opacity', '1')
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`)
          .html(`
            <div class="font-sans text-xs font-semibold text-text-primary">${d.title}</div>
            <div class="font-sans text-[10px] text-text-muted mt-0.5">${new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          `)
      })
      .on('mouseleave', (event, d) => {
        const dot = d3.select(event.currentTarget as SVGCircleElement)
        dot.transition().duration(150).attr('opacity', 0.85).attr('r', IMPACT_SIZE[d.impact_level] ?? 6)
        tooltip.style('opacity', '0')
      })
  }, [events, width])

  useEffect(() => {
    render()
  }, [render])

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden text-text-muted">
      <svg ref={svgRef} className="block" />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-background border border-border-default shadow-md px-3 py-2 max-w-[240px] transition-opacity duration-150"
        style={{ opacity: 0 }}
      />
    </div>
  )
}
