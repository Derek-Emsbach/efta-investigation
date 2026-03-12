'use client'

import type { VideoLink } from '@efta/shared'

interface VideoEmbedsProps {
  videos: VideoLink[]
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function VideoEmbeds({ videos }: VideoEmbedsProps) {
  if (videos.length === 0) return null

  return (
    <div className="space-y-6">
      <h3 className="font-mono text-xs uppercase tracking-wider text-text-muted">
        Video
        <span className="ml-1.5 opacity-60">{videos.length}</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map((video, idx) => {
          const ytId = getYouTubeId(video.url)

          return (
            <div
              key={`${video.url}-${idx}`}
              className="rounded border border-border-default bg-surface overflow-hidden"
            >
              {ytId ? (
                <div className="relative aspect-video">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                    loading="lazy"
                  />
                </div>
              ) : (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center aspect-video bg-elevated hover:bg-elevated/80 transition-colors"
                >
                  <div className="text-center">
                    <svg
                      className="w-10 h-10 text-text-muted mx-auto mb-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span className="text-xs text-text-muted font-mono">Open External Video</span>
                  </div>
                </a>
              )}
              <div className="px-3 py-2 border-t border-border-default">
                <p className="text-sm text-text-primary font-medium line-clamp-2">
                  {video.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {video.source && (
                    <span className="text-[10px] font-mono text-text-muted">
                      {video.source}
                    </span>
                  )}
                  {video.source && video.date && (
                    <span className="text-text-muted/40">·</span>
                  )}
                  {video.date && (
                    <span className="text-[10px] font-mono text-text-muted">
                      {formatDate(video.date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
