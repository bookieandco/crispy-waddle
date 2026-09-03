import type { RandomSource } from './simulation.js';
import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { applyNBAEvent } from './nba-event-state-machine.js';

export interface NBAGameReplayResult {
  initialState: NBAEventGameState;
  finalState: NBAEventGameState;
  events: readonly NBAEvent[];
  eventHashes: readonly string[];
}

function stableEventHash(event: NBAEvent): string {
  const payload = JSON.stringify({
    eventId: event.eventId,
    sequence: event.sequence,
    kind: event.kind,
    teamId: event.teamId,
    playerId: event.playerId,
    opponentPlayerId: event.opponentPlayerId,
    foulKind: event.foulKind,
    freeThrows: event.freeThrows,
    made: event.made,
    points: event.points,
    reboundKind: event.reboundKind,
    elapsedSeconds: event.elapsedSeconds,
    evidenceIds: [...event.evidenceIds].sort(),
  });
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function replayNBAEvents(
  initialState: NBAEventGameState,
  events: readonly NBAEvent[],
): NBAGameReplayResult {
  let state = initialState;
  const hashes: string[] = [];
  for (const event of events) {
    state = applyNBAEvent(state, event);
    hashes.push(stableEventHash(event));
  }
  return Object.freeze({
    initialState,
    finalState: state,
    events: Object.freeze([...events]),
    eventHashes: Object.freeze(hashes),
  });
}

export function replayNBARandomEvents(
  initialState: NBAEventGameState,
  eventFactory: (state: NBAEventGameState, rng: RandomSource) => NBAEvent | null,
  rng: RandomSource,
  maxEvents = 10_000,
): NBAGameReplayResult {
  if (!Number.isInteger(maxEvents) || maxEvents < 0) throw new Error('maxEvents must be a non-negative integer');
  const events: NBAEvent[] = [];
  let state = initialState;
  for (let i = 0; i < maxEvents && state.periodSecondsRemaining > 0; i += 1) {
    const event = eventFactory(state, rng);
    if (!event) break;
    state = applyNBAEvent(state, event);
    events.push(event);
  }
  return replayNBAEvents(initialState, events);
}
