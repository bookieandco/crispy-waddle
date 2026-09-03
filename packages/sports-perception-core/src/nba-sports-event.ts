import type { SportsEvent } from './sports-event.js';
import type { NBAEvent } from './nba-event-state-machine.js';
import { parseCanonicalNBAEventId } from './nba-event-identity.js';

function gameIdFor(event: NBAEvent): string {
  if (event.eventId.startsWith('nba-event-v2:')) return parseCanonicalNBAEventId(event.eventId).gameId;
  const separator = event.eventId.lastIndexOf(':');
  if (separator <= 0) throw new Error(`Invalid legacy NBA event ID: ${event.eventId}`);
  return event.eventId.slice(0, separator);
}

export function toNBASportsEvent(event: NBAEvent, sportEventId = event.eventId): SportsEvent {
  return Object.freeze({
    eventId: sportEventId,
    sport: 'NBA',
    gameId: gameIdFor(event),
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
