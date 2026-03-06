import { SOURCE_CONFIGS, type SourceConfig } from './source-configs'

interface SourceAttributionBarProps {
  /** Specific source IDs to show. If omitted, shows all configured sources. */
  sources?: string[]
}

export function SourceAttributionBar({ sources }: SourceAttributionBarProps) {
  const configs: SourceConfig[] = sources
    ? sources
        .map((id) => SOURCE_CONFIGS.find((s) => s.id === id))
        .filter((s): s is SourceConfig => s !== undefined)
    : SOURCE_CONFIGS

  if (configs.length === 0) return null

  return (
    <div
      data-component="source-attribution-bar"
      className="border-t border-border-default py-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Researched with help from
        </span>
        {configs.map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors pl-2.5 py-0.5"
            style={{ borderLeft: `2px solid ${source.accentColor}` }}
          >
            {source.shortName}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-40"
            >
              <path d="M3 7l4-4M3.5 3H7v3.5" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}
