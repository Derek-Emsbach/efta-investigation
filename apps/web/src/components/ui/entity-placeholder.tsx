/**
 * Stylized silhouette placeholder for entities without profile photos.
 * Renders an inline SVG — no network request, scales to any size, inherits theme colors.
 *
 * People get a head-and-shoulders silhouette with subtle scan lines (dossier aesthetic).
 * Organizations get a building icon.
 */

interface EntityPlaceholderProps {
  name: string
  entityType?: string  // 'person' | 'organization' | 'location'
  size: number         // px (28, 48, 64, 80, etc.)
  className?: string   // container classes (border, rounding, etc.)
}

export function EntityPlaceholder({ name, entityType, size, className = '' }: EntityPlaceholderProps) {
  const isOrg = entityType === 'organization'

  return (
    <div
      className={`flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 80 80"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${name} placeholder`}
      >
        {/* Background */}
        <rect width="80" height="80" className="fill-elevated" />

        {isOrg ? (
          /* ── Organization: building icon ──────────────────────────── */
          <g className="fill-text-muted" opacity="0.35">
            {/* Main building */}
            <rect x="22" y="28" width="36" height="36" rx="1" />
            {/* Roof triangle */}
            <polygon points="40,18 18,30 62,30" />
            {/* Windows — 3x3 grid */}
            <rect x="27" y="34" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="37" y="34" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="47" y="34" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="27" y="43" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="37" y="43" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="47" y="43" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="27" y="52" width="6" height="5" rx="0.5" className="fill-elevated" />
            <rect x="47" y="52" width="6" height="5" rx="0.5" className="fill-elevated" />
            {/* Door */}
            <rect x="36" y="52" width="8" height="12" rx="1" className="fill-elevated" />
            {/* Columns */}
            <rect x="20" y="28" width="2" height="36" />
            <rect x="58" y="28" width="2" height="36" />
          </g>
        ) : (
          /* ── Person: head-and-shoulders silhouette ────────────────── */
          <g className="fill-text-muted" opacity="0.3">
            {/* Head */}
            <circle cx="40" cy="28" r="12" />
            {/* Shoulders/torso — truncated at bottom of frame */}
            <path d="M16,80 C16,58 28,48 40,48 C52,48 64,58 64,80 Z" />
          </g>
        )}

        {/* Scan lines overlay — gives a redacted/dossier feel */}
        <g opacity="0.06">
          {Array.from({ length: 10 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              y1={8 * (i + 1)}
              x2="80"
              y2={8 * (i + 1)}
              className="stroke-text-primary"
              strokeWidth="0.5"
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
