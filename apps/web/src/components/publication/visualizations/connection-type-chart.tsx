'use client'

import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

const LABEL_MAP: Record<string, string> = {
  employed_by: 'Employed By',
  attorney_for: 'Attorney For',
  co_accused: 'Co-Accused',
  financial: 'Financial',
  social: 'Social',
  professional: 'Professional',
  associated_with: 'Associated With',
  paid_by: 'Paid By',
  connected_to: 'Connected To',
  trafficked_by: 'Trafficked By',
  represented_by: 'Represented By',
  investigated_by: 'Investigated By',
  family_of: 'Family Of',
  victim_of: 'Victim Of',
  hired_by: 'Hired By',
  referred_by: 'Referred By',
  subsidiary_of: 'Subsidiary Of',
  owned_by: 'Owned By',
}

const DEFAULT_COLORS = [
  '#b8860b', // gold
  '#c41e3a', // red
  '#1a472a', // green
  '#283593', // blue
  '#6a1b9a', // purple
  '#455a64', // gray
]

interface ConnectionTypeChartProps {
  data: Record<string, number>
  colorMap?: Record<string, string>
}

function formatLabel(key: string): string {
  return LABEL_MAP[key] ?? key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function ConnectionTypeChart({ data, colorMap }: ConnectionTypeChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

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

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const entries = Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ key, label: formatLabel(key), value }))

    if (entries.length === 0) return

    const margin = { top: 8, right: 60, bottom: 8, left: 140 }
    const barHeight = 28
    const barGap = 6
    const chartHeight = entries.length * (barHeight + barGap) - barGap
    const height = chartHeight + margin.top + margin.bottom

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const maxVal = d3.max(entries, d => d.value) ?? 1
    const x = d3.scaleLinear().domain([0, maxVal]).range([0, width - margin.left - margin.right])

    const y = d3
      .scaleBand<string>()
      .domain(entries.map(d => d.key))
      .range([0, chartHeight])
      .paddingInner(barGap / (barHeight + barGap))

    // Bars
    g.selectAll('rect')
      .data(entries)
      .join('rect')
      .attr('x', 0)
      .attr('y', d => y(d.key) ?? 0)
      .attr('height', y.bandwidth())
      .attr('fill', (d, i) => {
        if (colorMap && colorMap[d.key]) return colorMap[d.key]
        return DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      })
      .attr('rx', 2)
      .attr('width', 0)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('width', d => x(d.value))

    // Labels (left)
    g.selectAll('.label')
      .data(entries)
      .join('text')
      .attr('class', 'label')
      .attr('x', -8)
      .attr('y', d => (y(d.key) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', 'currentColor')
      .attr('font-size', '12px')
      .attr('font-family', 'var(--font-sans)')
      .text(d => d.label)

    // Count labels (right of bars)
    g.selectAll('.count')
      .data(entries)
      .join('text')
      .attr('class', 'count')
      .attr('y', d => (y(d.key) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', 'currentColor')
      .attr('font-size', '12px')
      .attr('font-family', 'var(--font-sans)')
      .attr('font-weight', '600')
      .attr('opacity', 0)
      .attr('x', 8)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('x', d => x(d.value) + 8)
      .attr('opacity', 1)
      .text(d => d.value)
  }, [data, colorMap, width])

  return (
    <div ref={containerRef} className="w-full overflow-hidden text-text-secondary">
      <svg ref={svgRef} className="block" />
    </div>
  )
}
