export type SportsLeague = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'mls' | 'wnba' | 'ncaa' | 'other'

export interface SportsEvent {
  id: string
  league: SportsLeague
  title: string
  startsAt: string
  homeTeam: string
  awayTeam: string
  status: 'scheduled' | 'live' | 'final'
  region?: string
  playbackSourceId?: string
}

export interface SportsQuery {
  league?: SportsLeague
  region?: string
  startsAfter?: string
  startsBefore?: string
  liveOnly?: boolean
}

/** Normalized sports contract. Live scores/schedules are supplied by a future authorized data adapter. */
export function querySports(events: SportsEvent[], query: SportsQuery = {}): SportsEvent[] {
  return events
    .filter((event) => !query.league || event.league === query.league)
    .filter((event) => !query.region || event.region === query.region)
    .filter((event) => !query.startsAfter || event.startsAt >= query.startsAfter)
    .filter((event) => !query.startsBefore || event.startsAt <= query.startsBefore)
    .filter((event) => !query.liveOnly || event.status === 'live')
}
