import Link from 'next/link'

interface TimelineEvent {
  id: string
  date: string | null
  title: string
  description: string | null
  significance: string | null
  event_type: string | null
}

interface TimelinePreviewProps {
  events: TimelineEvent[]
}

// Fallback critical events if DB query returns fewer than 6
const LANDMARK_EVENTS: TimelineEvent[] = [
  {
    id: 'landmark-1',
    date: '2005-03-01',
    title: 'Palm Beach Police Begin Investigation',
    description:
      "Initial complaints from a 14-year-old victim's mother trigger what should have been a straightforward prosecution.",
    significance: 'critical',
    event_type: 'legal',
  },
  {
    id: 'landmark-2',
    date: '2007-09-24',
    title: 'Non-Prosecution Agreement Signed',
    description:
      "AUSA Acosta signs the NPA granting immunity to Epstein and unnamed co-conspirators — in violation of the Crime Victims' Rights Act.",
    significance: 'critical',
    event_type: 'legal',
  },
  {
    id: 'landmark-3',
    date: '2008-06-30',
    title: 'Epstein Pleads to State Charges',
    description:
      'A single count of soliciting a minor. 13-month sentence with work release. Federal charges shelved.',
    significance: null,
    event_type: 'legal',
  },
  {
    id: 'landmark-4',
    date: '2019-07-06',
    title: 'SDNY Arrest and Death in Custody',
    description:
      'Arrested on federal sex trafficking charges. Found dead in his cell on August 10, 2019.',
    significance: 'critical',
    event_type: 'legal',
  },
  {
    id: 'landmark-5',
    date: '2024-07-01',
    title: 'EFTA Signed Into Law',
    description:
      'The Epstein Files Transparency Act requires the DOJ to release ~3.5 million pages of investigative files.',
    significance: null,
    event_type: 'legislative',
  },
  {
    id: 'landmark-6',
    date: '2025-01-15',
    title: 'Document Releases Begin',
    description:
      '12 dataset releases to date. 1.38 million documents. Compliance failures and redaction patterns emerge under systematic analysis.',
    significance: 'critical',
    event_type: 'legislative',
  },
]

export function TimelinePreview({ events }: TimelinePreviewProps) {
  // Use DB events if we have enough, otherwise merge with landmarks
  const displayEvents = events.length >= 6 ? events.slice(0, 6) : LANDMARK_EVENTS

  return (
    <section className="py-10">
      {/* Section header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="font-[var(--font-sans)] text-[13px] font-bold uppercase tracking-[0.15em] whitespace-nowrap text-text-primary">
          Timeline
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link
          href="/dashboard/timeline"
          className="font-[var(--font-sans)] text-[11px] font-medium text-text-muted hover:text-text-primary whitespace-nowrap tracking-[0.04em] transition-colors"
        >
          Full Interactive Timeline →
        </Link>
      </div>

      {/* Vertical timeline */}
      <div className="relative pl-10">
        {/* Vertical line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-border-default"
          style={{ left: '7px' }}
        />

        {displayEvents.map((event) => {
          const isCritical = event.significance === 'critical'
          const year = event.date
            ? new Date(event.date).getFullYear().toString()
            : '—'

          return (
            <div key={event.id} className="relative pb-7 pl-7">
              {/* Dot */}
              <div
                className="absolute rounded-full"
                style={{
                  width: 9,
                  height: 9,
                  left: -37,
                  top: 6,
                  ...(isCritical
                    ? {
                        backgroundColor: 'var(--color-accent-red, #c41e3a)',
                        borderColor: 'var(--color-accent-red, #c41e3a)',
                        boxShadow: '0 0 0 4px rgba(196,30,58,0.15)',
                      }
                    : {
                        backgroundColor: 'var(--color-background, #faf8f5)',
                        border: '2px solid var(--color-text-secondary, #4a4a4a)',
                      }),
                }}
              />

              {/* Year */}
              <div className="font-[var(--font-sans)] text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-1">
                {year}
              </div>

              {/* Title */}
              <h3 className="font-display text-[18px] font-semibold text-text-primary mb-1">
                {event.title}
              </h3>

              {/* Description */}
              {event.description && (
                <p className="font-body text-[14px] leading-[1.5] text-text-secondary">
                  {event.description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
