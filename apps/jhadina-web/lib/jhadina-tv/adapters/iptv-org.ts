import type { AuthorizedMediaSource } from '../media-source'
import type { SourceIngestionAdapter, IngestionResult } from '../ingestion'

export interface IPTVOrgChannel {
  id: string
  name: string
  country?: string
  subdivision?: string
  is_nsfw?: boolean
  launched?: string
  closed?: string
  website?: string
  logo?: string
  categories?: string[]
  languages?: string[]
}

export interface IPTVOrgStream {
  channel: string
  url: string
  http_referrer?: string
  user_agent?: string
}

/**
 * Ingests IPTV-Org's public channel/stream data. The endpoint is injected so
 * tests and deployments can choose a mirror/API without hard-coding network IO.
 */
export class IPTVOrgAdapter implements SourceIngestionAdapter {
  readonly sourceId = 'iptv-org'

  constructor(
    private readonly fetchJSON: (url: string) => Promise<unknown>,
    private readonly endpoints = {
      channels: 'https://iptv-org.github.io/api/channels.json',
      streams: 'https://iptv-org.github.io/api/streams.json',
    },
  ) {}

  async ingest(): Promise<IngestionResult> {
    const [channelsRaw, streamsRaw] = await Promise.all([
      this.fetchJSON(this.endpoints.channels),
      this.fetchJSON(this.endpoints.streams),
    ])
    const channels = Array.isArray(channelsRaw) ? channelsRaw as IPTVOrgChannel[] : []
    const streams = Array.isArray(streamsRaw) ? streamsRaw as IPTVOrgStream[] : []
    const channelMap = new Map(channels.map((channel) => [channel.id, channel]))

    const items: AuthorizedMediaSource[] = streams
      .filter((stream) => stream.url.startsWith('https://') || stream.url.startsWith('http://'))
      .map((stream, index) => {
        const channel = channelMap.get(stream.channel)
        return {
          id: `iptv-org:${stream.channel}:${index}`,
          url: stream.url,
          title: channel?.name ?? stream.channel,
          sourceId: this.sourceId,
          authorization: 'public',
          mediaType: 'live',
          region: channel?.country,
        }
      })

    return { sourceId: this.sourceId, items, fetchedAt: new Date().toISOString() }
  }
}
