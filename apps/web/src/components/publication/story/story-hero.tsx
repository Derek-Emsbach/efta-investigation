import type { Story } from '@efta/shared'

interface StoryHeroProps {
  story: Story
  citationCount: number
}

const SECTION_COLORS: Record<string, string> = {
  'the-network': '#c41e3a',
  'follow-the-money': '#b8860b',
  'the-cover-up': '#6b21a8',
  'the-operation': '#0e7490',
  'voices': '#0d9488',
}

const SECTION_LABELS: Record<string, string> = {
  'the-network': 'The Network',
  'follow-the-money': 'Follow the Money',
  'the-cover-up': 'The Cover-Up',
  'the-operation': 'The Operation',
  'voices': 'Voices',
}

export function StoryHero({ story, citationCount }: StoryHeroProps) {
  const sectionColor = story.section ? SECTION_COLORS[story.section] ?? '#6b7280' : null
  const sectionLabel = story.section ? SECTION_LABELS[story.section] ?? story.section : null

  return (
    <header className="mb-10">
      {/* Section tag */}
      {sectionLabel && sectionColor && (
        <div className="flex items-center gap-2 mb-4">
          <span
            className="w-8 h-[3px]"
            style={{ backgroundColor: sectionColor }}
          />
          <span
            className="font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: sectionColor }}
          >
            {sectionLabel}
          </span>
        </div>
      )}

      {/* Headline */}
      <h1
        className="font-display font-bold text-text-primary leading-[1.1] tracking-[-0.01em]"
        style={{ fontSize: 'clamp(2.125rem, 4vw, 3.375rem)' }}
      >
        {story.title}
      </h1>

      {/* Deck */}
      {story.deck && (
        <p className="mt-4 font-body text-[21px] text-text-secondary leading-relaxed">
          {story.deck}
        </p>
      )}

      {/* Meta bar */}
      <div className="mt-6 flex items-center gap-4 flex-wrap font-body text-sm text-text-muted">
        <span>By {story.byline}</span>
        {story.published_at && (
          <>
            <span className="text-border-default">|</span>
            <span>
              {new Date(story.published_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </>
        )}
        {story.reading_time_minutes && (
          <>
            <span className="text-border-default">|</span>
            <span>{story.reading_time_minutes} min read</span>
          </>
        )}
        {citationCount > 0 && (
          <>
            <span className="text-border-default">|</span>
            <span className="font-mono text-xs text-accent-red">
              {citationCount} documents cited
            </span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="mt-6 border-b border-border-default" />
    </header>
  )
}
