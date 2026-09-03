import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { createNBAGameIdentity, assertNBAEventTeam } from './nba-game-identity.js';

export interface CanonicalNBAEventIdentity {
  gameId: string;
  sequence: number;
  kind: NBAEvent['kind'];
}

const EVENT_PREFIX = 'nba-event-v2';

export function createCanonicalNBAEventId(gameId: string, sequence: number, kind: NBAEvent['kind']): string {
  if (!gameId.trim()) throw new Error('NBA event game ID is required');
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('NBA event sequence must be a positive integer');
  return `${EVENT_PREFIX}:${encodeURIComponent(gameId)}:${sequence}:${kind}`;
}

export function parseCanonicalNBAEventId(eventId: string): CanonicalNBAEventIdentity {
  const parts = eventId.split(':');
  if (parts.length !== 4 || parts[0] !== EVENT_PREFIX) throw new Error(`Invalid canonical NBA event ID: ${eventId}`);
  const gameId = decodeURIComponent(parts[1]);
  const sequence = Number(parts[2]);
  const kind = parts[3] as NBAEvent['kind'];
  if (!gameId || !Number.isInteger(sequence) || sequence < 1) throw new Error(`Invalid canonical NBA event ID: ${eventId}`);
  return Object.freeze({ gameId, sequence, kind });
}

export function assertCanonicalNBAEvent(state: NBAEventGameState, event: NBAEvent): void {
  const identity = createNBAGameIdentity(state);
  assertNBAEventTeam(identity, event.teamId);
  if (event.sequence !== state.sequence + 1) throw new Error('NBA event sequence must advance exactly by one');

  if (event.eventId.startsWith(`${EVENT_PREFIX}:`)) {
    const parsed = parseCanonicalNBAEventId(event.eventId);
    if (parsed.gameId !== state.gameId) throw new Error(`NBA event ${event.eventId} does not belong to game ${state.gameId}`);
    if (parsed.sequence !== event.sequence) throw new Error(`NBA event ${event.eventId} sequence does not match payload`);
    if (parsed.kind !== event.kind) throw new Error(`NBA event ${event.eventId} kind does not match payload`);
    return;
  }

  // Legacy IDs remain replayable during migration, but are validated against the state.
  const legacyPrefix = event.eventId.split(':')[0];
  if (legacyPrefix !== state.gameId) throw new Error(`NBA legacy event ${event.eventId} does not belong to game ${state.gameId}`);
}

export { EVENT_PREFIX as CANONICAL_NBA_EVENT_ID_PREFIX };
