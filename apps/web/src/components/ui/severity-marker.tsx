import { SEVERITY_CONFIG } from '@efta/shared'
import type { Severity } from '@efta/shared'

interface SeverityMarkerProps {
  severity: Severity
}

export function SeverityMarker({ severity }: SeverityMarkerProps) {
  const config = SEVERITY_CONFIG[severity]

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${config.pulse ? 'animate-severity-pulse' : ''}`}
        style={{ backgroundColor: config.color }}
      />
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: config.color }}
      >
        {config.label}
      </span>
    </span>
  )
}
