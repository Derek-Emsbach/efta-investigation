import Link from 'next/link'

export function FeaturedInvestigation() {
  return (
    <section className="relative overflow-hidden bg-[#1a1a1a] text-[#faf8f5]" style={{ padding: '48px 0', margin: '40px 0 0' }}>
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.02) 39px, rgba(255,255,255,0.02) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.02) 39px, rgba(255,255,255,0.02) 40px)
          `,
        }}
      />

      <div className="relative z-[1] mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-red opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-red" />
              </span>
              <span className="font-[var(--font-sans)] text-[11px] font-bold uppercase tracking-[0.15em] text-accent-red">
                Interactive Investigation
              </span>
            </div>

            <h2 className="font-display text-[clamp(28px,4vw,38px)] font-bold leading-[1.15] tracking-[-0.01em] mb-4">
              The Network Map: 97 People. Decades of Connections. One Operation.
            </h2>

            <p className="text-[17px] leading-[1.7] opacity-75 mb-6">
              Our interactive network visualization maps every documented connection across six
              evidence tiers — from convicted participants to the institutional gatekeepers who
              enabled them. Every node links to primary source documents.
            </p>

            <Link
              href="/evidence"
              className="inline-flex items-center gap-2 font-[var(--font-sans)] text-xs font-semibold uppercase tracking-[0.1em] text-[#faf8f5] no-underline border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              style={{ padding: '12px 24px' }}
            >
              Explore the Network
              <span>→</span>
            </Link>
          </div>

          {/* Right: Network visualization placeholder */}
          <div className="relative">
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: '4/3',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Decorative network nodes */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full">
                  {/* Central node */}
                  <div
                    className="absolute rounded-full bg-accent-red"
                    style={{ width: 14, height: 14, top: '45%', left: '48%', boxShadow: '0 0 20px rgba(196,30,58,0.4)' }}
                  />
                  {/* Connected nodes */}
                  <div className="absolute rounded-full bg-white/20" style={{ width: 8, height: 8, top: '25%', left: '30%' }} />
                  <div className="absolute rounded-full bg-white/20" style={{ width: 8, height: 8, top: '20%', left: '65%' }} />
                  <div className="absolute rounded-full bg-white/15" style={{ width: 6, height: 6, top: '60%', left: '25%' }} />
                  <div className="absolute rounded-full bg-white/15" style={{ width: 6, height: 6, top: '55%', left: '72%' }} />
                  <div className="absolute rounded-full bg-white/10" style={{ width: 5, height: 5, top: '35%', left: '15%' }} />
                  <div className="absolute rounded-full bg-white/10" style={{ width: 5, height: 5, top: '70%', left: '55%' }} />
                  <div className="absolute rounded-full bg-white/10" style={{ width: 4, height: 4, top: '30%', left: '80%' }} />
                  <div className="absolute rounded-full bg-white/10" style={{ width: 4, height: 4, top: '75%', left: '40%' }} />

                  {/* Connection lines (decorative SVG) */}
                  <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.08 }}>
                    <line x1="48%" y1="45%" x2="30%" y2="25%" stroke="white" strokeWidth="1" />
                    <line x1="48%" y1="45%" x2="65%" y2="20%" stroke="white" strokeWidth="1" />
                    <line x1="48%" y1="45%" x2="25%" y2="60%" stroke="white" strokeWidth="1" />
                    <line x1="48%" y1="45%" x2="72%" y2="55%" stroke="white" strokeWidth="1" />
                    <line x1="48%" y1="45%" x2="15%" y2="35%" stroke="white" strokeWidth="0.5" />
                    <line x1="48%" y1="45%" x2="55%" y2="70%" stroke="white" strokeWidth="0.5" />
                    <line x1="30%" y1="25%" x2="15%" y2="35%" stroke="white" strokeWidth="0.5" />
                    <line x1="65%" y1="20%" x2="80%" y2="30%" stroke="white" strokeWidth="0.5" />
                  </svg>
                </div>
              </div>

              {/* Label */}
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                  Interactive • 97 entities • 50+ connections
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
