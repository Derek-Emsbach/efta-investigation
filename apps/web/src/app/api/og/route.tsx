import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get('title') ?? 'Independent Investigation'
  const subtitle = searchParams.get('subtitle') ?? ''
  const type = searchParams.get('type') ?? 'home'

  const typeLabels: Record<string, string> = {
    story: 'Investigative Report',
    entity: 'Entity Dossier',
    'case-file': 'Case File',
    evidence: 'Evidence Room',
    home: 'theepsteincrimes.com',
  }

  const typeLabel = typeLabels[type] ?? typeLabels.home

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#faf8f5',
          padding: '60px 80px',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Top: Masthead */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 16,
              letterSpacing: '0.2em',
              color: '#666',
              textTransform: 'uppercase',
              fontFamily: 'Helvetica, Arial, sans-serif',
            }}
          >
            {typeLabel}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: '#1a1a1a',
              marginTop: 8,
              display: 'flex',
            }}
          >
            THE EPSTEIN{' '}
            <span style={{ color: '#c41e3a', marginLeft: 12 }}>CRIMES</span>
          </div>
          <div
            style={{
              width: '100%',
              height: 3,
              backgroundColor: '#1a1a1a',
              marginTop: 16,
            }}
          />
        </div>

        {/* Middle: Title + subtitle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? 36 : 48,
              fontWeight: 700,
              color: '#1a1a1a',
              lineHeight: 1.2,
              maxWidth: 900,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 20,
                color: '#666',
                marginTop: 16,
                fontFamily: 'Helvetica, Arial, sans-serif',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Bottom: Red accent line */}
        <div
          style={{
            width: '100%',
            height: 6,
            backgroundColor: '#c41e3a',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
