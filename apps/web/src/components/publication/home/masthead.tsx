export function Masthead() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="pt-7 pb-4 border-b-[3px] border-double border-text-primary">
      {/* Desktop: 3-column newspaper nameplate */}
      <div className="hidden xl:grid xl:grid-cols-[200px_1fr_200px] xl:items-end xl:gap-4">
        {/* Left flank — date & edition */}
        <div className="text-left pb-1">
          <div className="font-sans text-[11px] tracking-[0.12em] uppercase text-text-muted leading-relaxed">
            {today}
          </div>
          <div className="font-sans text-[10px] tracking-[0.15em] uppercase text-text-muted/60 mt-0.5">
            Ongoing Investigation
          </div>
        </div>

        {/* Center — nameplate */}
        <div className="text-center">
          <h1 className="font-display text-[clamp(36px,6vw,72px)] font-[900] text-text-primary tracking-[-0.02em] leading-none mb-1">
            The Epstein <span className="text-accent-red">Crimes</span>
          </h1>
          <p className="font-sans text-[11px] tracking-[0.2em] uppercase text-text-muted mb-1.5">
            An Independent Investigation of the EFTA Document Releases
          </p>
        </div>

        {/* Right flank — editor & free label */}
        <div className="text-right pb-1">
          <div className="font-sans text-[10px] tracking-[0.15em] uppercase text-text-muted/70">
            Derek Emsbach, Editor
          </div>
          <div className="font-sans text-[10px] tracking-[0.15em] uppercase text-accent-gold mt-0.5">
            Free &middot; Open Source
          </div>
        </div>
      </div>

      {/* Mobile/tablet: centered (original layout) */}
      <div className="xl:hidden text-center">
        <div className="font-sans text-[11px] tracking-[0.12em] uppercase text-text-muted mb-3">
          {today}
        </div>
        <h1 className="font-display text-[clamp(36px,6vw,72px)] font-[900] text-text-primary tracking-[-0.02em] leading-none mb-1">
          The Epstein <span className="text-accent-red">Crimes</span>
        </h1>
        <p className="font-sans text-[11px] tracking-[0.2em] uppercase text-text-muted mb-1.5">
          An Independent Investigation of the EFTA Document Releases
        </p>
        <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-text-muted/70 mb-4">
          Derek Emsbach, Editor
        </p>
      </div>
    </div>
  )
}
