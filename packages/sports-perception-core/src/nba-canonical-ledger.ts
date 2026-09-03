import type { NBAEvent, NBAEventGameState, NBAEventTransition } from './nba-event-state-machine.js';
import { applyNBAEvent } from './nba-event-state-machine.js';
import { applyNBASubstitution } from './nba-lineup-state.js';
import { assertNBAEventTeam, createNBAGameIdentity } from './nba-game-identity.js';

export interface NBAStateTransition extends NBAEventTransition {
  previousStateHash: string;
  stateHash: string;
}

export interface NBACanonicalEventLedger {
  gameId: string;
  initialState: NBAEventGameState;
  transitions: readonly NBAStateTransition[];
  finalState: NBAEventGameState;
  finalStateHash: string;
}

function stableValue(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function hash(value: unknown): string {
  let h = 2166136261;
  for (const char of stableValue(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function hashNBAEvent(event: NBAEvent): string { return hash(event); }

export function hashNBAState(state: NBAEventGameState): string {
  return hash({
    gameId: state.gameId,
    period: state.period,
    periodSecondsRemaining: state.periodSecondsRemaining,
    shotClockSeconds: state.shotClockSeconds,
    offenseTeamId: state.offenseTeamId,
    defenseTeamId: state.defenseTeamId,
    scores: state.scores,
    players: state.players,
    offenseLineup: state.offenseLineup,
    defenseLineup: state.defenseLineup,
    sequence: state.sequence,
    lastEventId: state.lastEventId,
    evidenceIds: state.evidenceIds,
  });
}

function assertEventIdentity(state: NBAEventGameState, event: NBAEvent, seen: ReadonlySet<string>): void {
  const identity = createNBAGameIdentity(state);
  assertNBAEventTeam(identity, event.teamId);
  if (state.gameId !== event.eventId.split(':')[0]) throw new Error(`NBA event ${event.eventId} does not belong to game ${state.gameId}`);
  if (seen.has(event.eventId)) throw new Error(`Duplicate NBA event ID: ${event.eventId}`);
  if (event.sequence !== state.sequence + 1) throw new Error('NBA event sequence must advance exactly by one');
  if (event.elapsedSeconds !== undefined && (!Number.isFinite(event.elapsedSeconds) || event.elapsedSeconds < 0)) throw new Error('NBA event elapsedSeconds must be non-negative');
}

function applyCanonicalTransition(state: NBAEventGameState, event: NBAEvent): NBAEventGameState {
  let next = state;
  if (event.kind === 'SUBSTITUTION') {
    const playerOut = event.opponentPlayerId;
    const playerIn = event.playerId;
    if (!playerOut || !playerIn) throw new Error('NBA substitution requires playerIn and playerOut');
    const offenseHasOut = state.offenseLineup?.onCourt.some((p) => p.playerId === playerOut) ?? false;
    const defenseHasOut = state.defenseLineup?.onCourt.some((p) => p.playerId === playerOut) ?? false;
    if (offenseHasOut && state.offenseLineup) next = Object.freeze({ ...next, offenseLineup: applyNBASubstitution(state.offenseLineup, { playerOut, playerIn, reason: 'MINUTES_MANAGEMENT' }) });
    else if (defenseHasOut && state.defenseLineup) next = Object.freeze({ ...next, defenseLineup: applyNBASubstitution(state.defenseLineup, { playerOut, playerIn, reason: 'MINUTES_MANAGEMENT' }) });
    else throw new Error(`NBA substitution playerOut not on court: ${playerOut}`);
  }
  return applyNBAEvent(next, event);
}

export class NBAEventLedger {
  private readonly initial: NBAEventGameState;
  private state: NBAEventGameState;
  private readonly transitions: NBAStateTransition[] = [];
  private readonly seen = new Set<string>();

  constructor(initialState: NBAEventGameState) {
    createNBAGameIdentity(initialState);
    this.initial = initialState;
    this.state = initialState;
  }

  append(event: NBAEvent): NBAStateTransition {
    assertEventIdentity(this.state, event, this.seen);
    const previousStateHash = hashNBAState(this.state);
    const nextState = applyCanonicalTransition(this.state, event);
    const stateHash = hashNBAState(nextState);
    const transition = Object.freeze({ state: nextState, event, previousStateHash, stateHash });
    this.transitions.push(transition);
    this.seen.add(event.eventId);
    this.state = nextState;
    return transition;
  }

  snapshot(): NBACanonicalEventLedger {
    return Object.freeze({ gameId: this.initial.gameId, initialState: this.initial, transitions: Object.freeze([...this.transitions]), finalState: this.state, finalStateHash: hashNBAState(this.state) });
  }
}

export function replayCanonicalNBAEvents(initialState: NBAEventGameState, events: readonly NBAEvent[]): NBACanonicalEventLedger {
  const ledger = new NBAEventLedger(initialState);
  for (const event of events) ledger.append(event);
  return ledger.snapshot();
}

export function verifyCanonicalNBAReplay(ledger: NBACanonicalEventLedger): void {
  let state = ledger.initialState;
  const seen = new Set<string>();
  for (const transition of ledger.transitions) {
    if (seen.has(transition.event.eventId)) throw new Error(`Duplicate NBA event ID: ${transition.event.eventId}`);
    if (hashNBAState(state) !== transition.previousStateHash) throw new Error(`NBA previous-state hash mismatch at ${transition.event.eventId}`);
    const next = applyCanonicalTransition(state, transition.event);
    if (hashNBAState(next) !== transition.stateHash) throw new Error(`NBA state hash mismatch at ${transition.event.eventId}`);
    state = next;
    seen.add(transition.event.eventId);
  }
  if (hashNBAState(state) !== ledger.finalStateHash) throw new Error('NBA final-state hash mismatch');
}

export { hash as hashCanonicalNBAValue };
