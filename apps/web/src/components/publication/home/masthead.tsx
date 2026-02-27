export function Masthead() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="text-center py-8 border-b border-border-default">
      <h1 className="font-display text-5xl sm:text-6xl lg:text-[72px] font-[900] text-text-primary tracking-tight leading-none">
        The Epstein Record
      </h1>
      <div className="mt-3 flex items-center justify-center gap-4 font-mono text-[10px] text-text-muted uppercase tracking-wider">
        <span>{today}</span>
        <span className="text-border-default">|</span>
        <span>EFTA Investigation</span>
        <span className="text-border-default">|</span>
        <span>Independent Analysis</span>
      </div>
    </div>
  )
}
