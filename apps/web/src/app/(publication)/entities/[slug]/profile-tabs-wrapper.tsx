'use client'

import type {
  EntityDocument,
  EntityEvent,
  EntityConnection,
  EvidenceItem,
  Document,
  DocumentImage,
  VideoLink,
  Event,
  Entity,
  Story,
  StoryEntity,
  CaseFile,
  CaseFileEntity,
} from '@efta/shared'
import { ProfileTabs } from '@/components/publication/entity/profile-tabs'
import { EvidenceSection } from '@/components/publication/entity/evidence-section'
import { ConnectionsGrid } from '@/components/publication/entity/connections-grid'
import { DocumentsTable } from '@/components/publication/entity/documents-table'
import { EntityTimeline } from '@/components/publication/entity/entity-timeline'
import { StoriesSection } from '@/components/publication/entity/stories-section'
import { CaseFilesSection } from '@/components/publication/entity/case-files-section'
import { EntityPhotosGrid } from '@/components/publication/entity/entity-photos-grid'
import { VideoEmbeds } from '@/components/publication/entity/video-embeds'

interface ProfileTabsWrapperProps {
  evidence: EvidenceItem[]
  connections: (EntityConnection & { connected_entity: Entity })[]
  documents: (EntityDocument & { document: Document })[]
  events: (EntityEvent & { event: Event })[]
  stories: (StoryEntity & { story: Story })[]
  caseFiles: (CaseFileEntity & { case_file: CaseFile })[]
  photos: DocumentImage[]
  videos: VideoLink[]
}

export function ProfileTabsWrapper({
  evidence,
  connections,
  documents,
  events,
  stories,
  caseFiles,
  photos,
  videos,
}: ProfileTabsWrapperProps) {
  const tabs = [
    { id: 'evidence', label: 'Evidence', count: evidence.length },
    { id: 'connections', label: 'Connections', count: connections.length },
    { id: 'documents', label: 'Documents', count: documents.length },
    { id: 'timeline', label: 'Timeline', count: events.length },
    { id: 'stories', label: 'Stories', count: stories.length },
    { id: 'case-files', label: 'Case Files', count: caseFiles.length },
    ...(photos.length > 0 ? [{ id: 'photos', label: 'Photos', count: photos.length }] : []),
    ...(videos.length > 0 ? [{ id: 'videos', label: 'Videos', count: videos.length }] : []),
  ]

  return (
    <ProfileTabs tabs={tabs}>
      {{
        evidence: <EvidenceSection evidence={evidence} />,
        connections: <ConnectionsGrid connections={connections} />,
        documents: <DocumentsTable documents={documents} />,
        timeline: <EntityTimeline events={events} />,
        stories: <StoriesSection stories={stories} />,
        'case-files': <CaseFilesSection caseFiles={caseFiles} />,
        ...(photos.length > 0 ? { photos: <EntityPhotosGrid photos={photos} urlPrefix="/api/public/images" /> } : {}),
        ...(videos.length > 0 ? { videos: <VideoEmbeds videos={videos} /> } : {}),
      }}
    </ProfileTabs>
  )
}
