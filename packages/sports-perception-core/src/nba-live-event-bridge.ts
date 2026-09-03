import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { applyNBAEvent } from './nba-event-state-machine.js';
import type { NBALivePlayerState } from './nba-live-state.js';
import { applyNBALivePlayerUpdate, recoverNBABenchPlayers } from './nba-live-state.js';

export interface NBALiveEventBridgeResult {
  gameState: NBAEventGameState;
  players: Readonly<Record<string, NBALivePlayerState>>;
  event: NBAEvent;
}

const intensityByEvent: Record<NBAEvent['kind'], number> = {
  POSSESSION_START: 20,
  PASS: 35,
  DRIVE: 70,
  SHOT: 60,
  FOUL: 55,
  FREE_THROW: 20,
  REBOUND: 75,
  TURNOVER: 45,
  SUBSTITUTION: 5,
  POSSESSION_END: 10,
};

function affectedPlayers(event: NBAEvent): readonly string[] {
  return Object.freeze([...new Set([event.playerId, event.opponentPlayerId].filter((id): id is string => Boolean(id)))]);
}

export function applyNBALiveEvent(
  state: NBAEventGameState,
  players: Readonly<Record<string, NBALivePlayerState>>,
  event: NBAEvent,
  _rng: unknown,
  asOf: string,
): NBALiveEventBridgeResult {
  const gameState = applyNBAEvent(state, event);
  const next: Record<string, NBALivePlayerState> = { ...players };
  const targets = affectedPlayers(event);

  for (const playerId of targets) {
    const player = next[playerId];
    if (!player) continue;
    const durationSeconds = Math.max(1, event.elapsedSeconds ?? (event.kind === 'FREE_THROW' ? 5 : 4));
    next[playerId] = applyNBALivePlayerUpdate(player, {
      eventId: event.eventId,
      playerId,
      intensity: intensityByEvent[event.kind],
      durationSeconds,
      confidenceDelta: event.kind === 'SHOT' && event.made ? 0.5 : 0,
      evidenceIds: event.evidenceIds,
      asOf,
    });
  }

  return Object.freeze({ gameState, players: Object.freeze(next), event });
}

export function recoverNBAPlayersAfterElapsedBenchTime(
  players: Readonly<Record<string, NBALivePlayerState>>,
  activePlayerIds: readonly string[],
  elapsedMinutes: number,
  asOf: string,
): Readonly<Record<string, NBALivePlayerState>> {
  const active = new Set(activePlayerIds);
  const bench = Object.values(players).filter((player) => !active.has(player.playerId));
  const recovered = recoverNBABenchPlayers(bench, elapsedMinutes, asOf);
  const next: Record<string, NBALivePlayerState> = { ...players };
  for (const player of recovered) next[player.playerId] = player;
  return Object.freeze(next);
}
