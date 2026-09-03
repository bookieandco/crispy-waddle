import type { SportsEvent } from './sports-event.js';
import type { NBAEvent } from './nba-event-state-machine.js';

export function toNBASportsEvent(event: NBAEvent, sportEventId = event.eventId): SportsEvent {
  return Object.freeze({
    eventId: sportEventId,
    sport: 'NBA',
    gameId: event.eventId.split(':')[0],
    sequence: event.sequence,
    eventType: event.kind,
    phase: event.period !== undefined && event.period > 4 ? 'OVERTIME' : 'REGULATION',
    period: event.period,
    elapsedSeconds: event.elapsedSeconds,
    participants: Object.freeze({
      teamId: event.teamId,
      playerId: event.playerId,
      opponentPlayerId: event.opponentPlayerId,
    }),
    payload: Object.freeze({
      foulKind: event.foulKind,
      freeThrows: event.freeThrows,
      made: event.made,
      points: event.points,
      reboundKind: event.reboundKind,
    }),
    observation: 'EVENT',
    confidence: 1,
    evidenceIds: Object.freeze([...event.evidenceIds]),
    provenance: Object.freeze({ source: 'nba-canonical-event', sourceEventId: event.eventId }),
  });
}
