import type { EntityEvent, Event } from '@efta/shared'

interface EntityEventWithEvent extends EntityEvent {
  event: Event
}

interface EntityTimelineProps {
  events: EntityEventWithEvent[]
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  legal: '#c41e3a',
  evidence: '#b8860b',
  communication: '#3b82f6',
  institutional: '#6b21a8',
  personal: '#0d9488',
  financial: '#d4a017',
  legislative: '#4a4540',
  travel: '#0e7490',
  sighting: '#22c55e',
}

export function EntityTimeline({ events }: EntityTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="font-body text-sm text-text-muted italic">
        No timeline events recorded.
      </p>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border-default" />

      <div className="space-y-4">
        {events.map((ee) => {
          const evt = ee.event
          if (!evt) return null
          const typeColor = evt.event_type
            ? EVENT_TYPE_COLORS[evt.event_type] ?? '#6b7280'
            : '#6b7280'

          return (
            <div key={ee.id} className="relative">
              {/* Timeline dot */}
              <div
                className="absolute -left-6 top-1.5 w-3 h-3 border-2 border-surface"
                style={{ backgroundColor: typeColor }}
              />

              <div className="border border-border-default p-4 hover:border-accent-gold/40 transition-colors">
                {/* Date + Type */}
                <div className="flex items-center gap-3 flex-wrap">
                  {evt.date && (
                    <span className="font-mono text-xs font-semibold text-accent-red">
                      {evt.date}
                    </span>
                  )}
                  {evt.event_type && (
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                      style={{
                        color: typeColor,
                        backgroundColor: `${typeColor}15`,
                      }}
                    >
                      {evt.event_type}
                    </span>
                  )}
                  {ee.role && (
                    <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                      {ee.role}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h4 className="mt-2 font-body text-sm font-semibold text-text-primary">
                  {evt.title}
                </h4>

                {/* Description */}
                {evt.description && (
                  <p className="mt-1 font-body text-xs text-text-secondary line-clamp-3">
                    {evt.description}
                  </p>
                )}

                {/* Significance */}
                {evt.significance && (
                  <p className="mt-2 font-body text-xs text-text-muted italic">
                    {evt.significance}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
