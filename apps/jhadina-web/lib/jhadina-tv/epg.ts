export interface EPGProgram {
  id: string
  channelId: string
  title: string
  startsAt: string
  endsAt: string
  description?: string
  category?: string
  live: boolean
}

export interface EPGChannel {
  id: string
  name: string
  logoUrl?: string
  region?: string
  programs: EPGProgram[]
}

export interface EPGQuery {
  region?: string
  channelIds?: string[]
  startsAfter?: string
  endsBefore?: string
}

/** Pure EPG filter. Network ingestion adapters should feed normalized channels into this layer. */
export function queryEPG(channels: EPGChannel[], query: EPGQuery = {}): EPGChannel[] {
  return channels
    .filter((channel) => !query.channelIds || query.channelIds.includes(channel.id))
    .filter((channel) => !query.region || channel.region === query.region)
    .map((channel) => ({
      ...channel,
      programs: channel.programs.filter((program) =>
        (!query.startsAfter || program.endsAt >= query.startsAfter) &&
        (!query.endsBefore || program.startsAt <= query.endsBefore),
      ),
    }))
}

export function getLivePrograms(channels: EPGChannel[], at = new Date().toISOString()): EPGProgram[] {
  return channels.flatMap((channel) =>
    channel.programs.filter((program) => program.startsAt <= at && program.endsAt > at),
  )
}
