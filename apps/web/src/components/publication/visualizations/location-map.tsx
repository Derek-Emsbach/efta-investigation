'use client'

import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

interface Location {
  id: string
  name: string
  location_type: string
  city: string
  latitude: number
  longitude: number
}

interface LocationMapProps {
  locations: Location[]
}

const TYPE_COLORS: Record<string, string> = {
  epstein_property: '#c41e3a',
  airport: '#283593',
  associated_property: '#b8860b',
  recruitment_site: '#6a1b9a',
  government_facility: '#455a64',
}

const TYPE_LABELS: Record<string, string> = {
  epstein_property: 'Epstein Property',
  airport: 'Airport',
  associated_property: 'Associated Property',
  recruitment_site: 'Recruitment Site',
  government_facility: 'Government Facility',
}

function getColor(locationType: string): string {
  return TYPE_COLORS[locationType] ?? '#888'
}

function getLabel(locationType: string): string {
  return TYPE_LABELS[locationType] ?? locationType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function LocationMap({ locations }: LocationMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; city: string } | null>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || locations.length === 0) return

    const svg = d3.select(svgRef.current)
    const height = 400

    function render() {
      if (!containerRef.current || !svgRef.current) return
      const width = containerRef.current.clientWidth

      svg.attr('width', width).attr('height', height)
      svg.selectAll('*').remove()

      // Mercator projection clipped to show US, Caribbean, and Western Europe
      const projection = d3.geoMercator()
        .center([-40, 35])
        .scale(width * 0.55)
        .translate([width / 2, height / 2])

      // Background
      svg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', '#faf4eb')
        .attr('rx', 2)

      // Subtle grid lines for geographic context
      const gridLngs = [-100, -80, -60, -40, -20, 0]
      const gridLats = [20, 30, 40, 50]

      gridLngs.forEach(lng => {
        const points: [number, number][] = []
        for (let lat = 10; lat <= 55; lat += 1) {
          const p = projection([lng, lat])
          if (p) points.push(p)
        }
        if (points.length > 1) {
          svg.append('path')
            .attr('d', d3.line()(points))
            .attr('fill', 'none')
            .attr('stroke', '#e8dfd0')
            .attr('stroke-width', 0.5)
        }
      })

      gridLats.forEach(lat => {
        const points: [number, number][] = []
        for (let lng = -120; lng <= 10; lng += 1) {
          const p = projection([lng, lat])
          if (p) points.push(p)
        }
        if (points.length > 1) {
          svg.append('path')
            .attr('d', d3.line()(points))
            .attr('fill', 'none')
            .attr('stroke', '#e8dfd0')
            .attr('stroke-width', 0.5)
        }
      })

      // Location dots
      const dots = svg.selectAll<SVGCircleElement, Location>('circle.location')
        .data(locations)
        .join('circle')
        .attr('class', 'location')
        .attr('cx', d => {
          const p = projection([d.longitude, d.latitude])
          return p ? p[0] : 0
        })
        .attr('cy', d => {
          const p = projection([d.longitude, d.latitude])
          return p ? p[1] : 0
        })
        .attr('r', 4)
        .attr('fill', d => getColor(d.location_type))
        .attr('stroke', '#faf4eb')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')

      dots
        .on('mouseenter', function (event: MouseEvent, d: Location) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 7)

          const rect = containerRef.current?.getBoundingClientRect()
          if (rect) {
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              name: d.name,
              city: d.city,
            })
          }
        })
        .on('mouseleave', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 4)

          setTooltip(null)
        })

      // City labels for key clusters
      const labelLocations = [
        { text: 'New York', coords: [-73.96, 40.77] as [number, number], dx: 12, dy: -4 },
        { text: 'Palm Beach', coords: [-80.04, 26.71] as [number, number], dx: 12, dy: 0 },
        { text: 'St. Thomas', coords: [-64.83, 18.3] as [number, number], dx: 12, dy: 0 },
        { text: 'Paris', coords: [2.28, 48.87] as [number, number], dx: 12, dy: 0 },
        { text: 'New Mexico', coords: [-105.95, 35.15] as [number, number], dx: 12, dy: 0 },
      ]

      labelLocations.forEach(({ text, coords, dx, dy }) => {
        const p = projection(coords)
        if (p) {
          svg.append('text')
            .attr('x', p[0] + dx)
            .attr('y', p[1] + dy)
            .attr('font-family', "'DM Sans', sans-serif")
            .attr('font-size', 10)
            .attr('fill', '#6b5e4f')
            .attr('dominant-baseline', 'middle')
            .text(text)
        }
      })
    }

    render()

    const observer = new ResizeObserver(() => render())
    if (containerRef.current) observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [locations])

  // Collect unique types present in data for the legend
  const typesPresent = Array.from(new Set(locations.map(l => l.location_type)))

  return (
    <div>
      <div ref={containerRef} className="relative w-full" style={{ height: 400 }}>
        <svg ref={svgRef} className="w-full" style={{ height: 400 }} />

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 px-3 py-2 border border-border-default bg-background shadow-md"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 12,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-sans text-xs font-semibold text-text-primary">
              {tooltip.name}
            </div>
            <div className="font-sans text-[11px] text-text-muted">
              {tooltip.city}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 px-1">
        {typesPresent.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-none"
              style={{ backgroundColor: getColor(type) }}
            />
            <span className="font-sans text-[11px] text-text-muted">
              {getLabel(type)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
