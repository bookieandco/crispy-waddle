import type { SportsEvent } from './sports-event.js';
import type { NBAEvent } from './nba-event-state-machine.js';
import { parseCanonicalNBAEventId } from './nba-event-identity.js';

function gameIdFor(event: NBAEvent): string {
  if (event.eventId.startsWith('nba-event-v2:')) return parseCanonicalNBAEventId(event.eventId).gameId;
  const separator = event.eventId.lastIndexOf(':');
  if (separator <= 0) throw new Error(`Invalid legacy NBA event ID: ${event.eventId}`);
  return event.eventId.slice(0, separator);
}

export function toNBASportsEvent(event: NBAEvent, source: SportsEvent['provenance']['source'] = {
  sourceId: 'nba-canonical-event',
  sourceType: 'SYSTEM',
  observedAt: new Date(0).toISOString(),
  receivedAt: new Date(0).toISOString(),
}): SportsEvent {
  return Object.freeze({
    eventId: event.eventId,
    sport: 'NBA',
    gameId: gameIdFor(event),
    sequence: event.sequence,
    eventType: event.kind,
    phase: event.period !== undefined && event.period > 4 ? 'OVERTIME' : 'REGULATION',
    period: event.period,
    participants: Object.freeze([
      Object.freeze({ participantId: event.teamId, role: 'TEAM' as const }),
      ...(event.playerId ? [Object.freeze({ participantId: event.playerId, role: 'PLAYER' as const })] : []),
      ...(event.opponentPlayerId ? [Object.freeze({ participantId: event.opponentPlayerId, role: 'PLAYER' as const })] : []),
    ]),
    payload: Object.freeze({
      foulKind: event.foulKind,
      freeThrows: event.freeThrows,
      made: event.made,
      points: event.points,
      reboundKind: event.reboundKind,
    }),
    observationClass: 'OBSERVED',
    confidence: 1,
    provenance: Object.freeze({
      evidenceIds: Object.freeze([...event.evidenceIds]),
      source: Object.freeze(source),
      derivedFromEventIds: Object.freeze([event.eventId]),
    }),
  });
}
