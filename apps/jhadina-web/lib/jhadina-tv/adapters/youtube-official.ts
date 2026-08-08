import type { AuthorizedMediaSource } from '../media-source'
import type { SourceIngestionAdapter, IngestionResult } from '../ingestion'

export interface OfficialYouTubeVideo {
  id: string
  title: string
  description?: string
  thumbnailUrl?: string
  publishedAt?: string
  channelId?: string
  channelTitle?: string
  live?: boolean
}

/**
 * Adapter for an official YouTube-backed catalog. The caller supplies an
 * authorized API/search implementation; we never scrape or manufacture a
 * watch/stream URL. Playback can use an official embed/watch integration.
 */
export class OfficialYouTubeAdapter implements SourceIngestionAdapter {
  readonly sourceId = 'official-youtube'

  constructor(private readonly listVideos: () => Promise<OfficialYouTubeVideo[]>) {}

  async ingest(): Promise<IngestionResult> {
    const videos = await this.listVideos()
    const items: AuthorizedMediaSource[] = videos.map((video) => ({
      id: `youtube:${video.id}`,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
      title: video.title,
      sourceId: this.sourceId,
      authorization: 'official',
      mediaType: video.live ? 'live' : 'movie',
    }))

    return { sourceId: this.sourceId, items, fetchedAt: new Date().toISOString() }
  }
}
