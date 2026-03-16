interface SectionHeroProps {
  title: string
  description: string
  color: string
  stat?: { value: string; label: string }
}

export function SectionHero({ title, description, color, stat }: SectionHeroProps) {
  return (
    <div className="bg-ink text-background">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-2xl">
            <div
              className="w-12 h-[3px] mb-4"
              style={{ backgroundColor: color }}
            />
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.1] mb-4">
              {title}
            </h1>
            <p className="font-body text-lg text-background/70 leading-relaxed">
              {description}
            </p>
          </div>

          {stat && (
            <div className="text-right">
              <div
                className="font-display text-[56px] md:text-[72px] font-bold leading-none"
                style={{ color }}
              >
                {stat.value}
              </div>
              <div className="font-sans text-[11px] tracking-[0.12em] uppercase text-background/50 mt-1">
                {stat.label}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
