export function Masthead() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="text-center pt-7 pb-4 border-b-[3px] border-double border-text-primary">
      <div className="font-sans text-[11px] tracking-[0.12em] uppercase text-text-muted mb-3">
        {today}
      </div>
      <h1 className="font-display text-[clamp(36px,6vw,72px)] font-[900] text-text-primary tracking-[-0.02em] leading-none mb-1">
        The Epstein <span className="text-accent-red">Record</span>
      </h1>
      <p className="font-sans text-[11px] tracking-[0.2em] uppercase text-text-muted mb-4">
        An Independent Investigation of the EFTA Document Releases
      </p>
    </div>
  )
}
