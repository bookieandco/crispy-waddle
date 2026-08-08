import type { EPGChannel } from './epg'
import { getLivePrograms } from './epg'
import type { SportsEvent } from './sports'

export interface GuideRow {
  channelId: string
  channelName: string
  currentProgram?: EPGChannel['programs'][number]
  nextProgram?: EPGChannel['programs'][number]
}

export interface SportsGuideSection {
  title: string
  events: SportsEvent[]
}

export function buildGuideRows(channels: EPGChannel[], at = new Date().toISOString()): GuideRow[] {
  const live = new Map(getLivePrograms(channels, at).map((program) => [program.channelId, program]))

  return channels.map((channel) => {
    const currentProgram = live.get(channel.id)
    const nextProgram = channel.programs
      .filter((program) => program.startsAt > at)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]

    return { channelId: channel.id, channelName: channel.name, currentProgram, nextProgram }
  })
}
