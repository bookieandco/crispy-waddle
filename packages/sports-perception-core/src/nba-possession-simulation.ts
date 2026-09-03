import type { PlayerSimulationMatchup } from './player-simulation.js';
import { resolvePlayerEventContest } from './player-event-simulation.js';

export type NBAAction =
  | 'DRIVE'
  | 'PULL_UP_2'
  | 'CATCH_SHOOT_3'
  | 'FINISH_2'
  | 'PASS'
  | 'TURNOVER'
  | 'FOUL_DRAWN';

export type NBAOutcome =
  | 'SCORE_2'
  | 'SCORE_3'
  | 'MISS'
  | 'TURNOVER'
  | 'FOUL_DRAWN';

export interface NBAPlayerRef {
  playerId: string;
  teamId: string;
}

export interface NBAPossessionState {
  possessionId: string;
  gameId: string;
  teamId: string;
  opponentTeamId: string;
  period: number;
  clockSeconds: number;
  shotClockSeconds: number;
  score: Readonly<Record<string, number>>;
  ballHandler: NBAPlayerRef;
  primaryDefender: NBAPlayerRef;
  matchup: PlayerSimulationMatchup;
  availableActions: readonly NBAAction[];
  evidenceIds: readonly string[];
}

export interface NBAActionDistribution {
  action: NBAAction;
  probability: number;
}

export interface NBAPossessionResolution {
  possessionId: string;
  action: NBAAction;
  outcome: NBAOutcome;
  points: number;
  nextTeamId: string;
  nextClockSeconds: number;
  nextShotClockSeconds: number;
  scoreDelta: Readonly<Record<string, number>>;
  resolvedProbability: number;
  evidenceIds: readonly string[];
}

export interface NBAPossessionModel {
  chooseAction(state: NBAPossessionState): NBAActionDistribution[];
  resolveActionProbability(state: NBAPossessionState, action: NBAAction): number;
}

export interface NBAPossessionRandomSource {
  next(): number;
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

const sample = <T>(items: readonly { item: T; probability: number }[], rng: NBAPossessionRandomSource): T => {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.probability), 0);
  if (total <= 0) return items[items.length - 1]!.item;
  let cursor = rng.next() * total;
  for (const item of items) {
    cursor -= Math.max(0, item.probability);
    if (cursor <= 0) return item.item;
  }
  return items[items.length - 1]!.item;
};

export function resolveNBAPossession(
  state: NBAPossessionState,
  model: NBAPossessionModel,
  rng: NBAPossessionRandomSource,
): NBAPossessionResolution {
  if (!state.possessionId.trim()) throw new Error('NBA possession ID is required');
  if (!state.gameId.trim()) throw new Error('NBA game ID is required');
  if (!state.ballHandler.playerId.trim()) throw new Error('NBA ball handler is required');
  if (!state.primaryDefender.playerId.trim()) throw new Error('NBA primary defender is required');
  if (state.ballHandler.teamId !== state.teamId) throw new Error('Ball handler must belong to possession team');
  if (state.primaryDefender.teamId !== state.opponentTeamId) throw new Error('Primary defender must belong to opponent team');

  const actions = model.chooseAction(state).filter((item) => state.availableActions.includes(item.action));
  if (actions.length === 0) throw new Error('NBA possession has no eligible actions');

  const action = sample(actions.map((item) => ({ item: item.action, probability: item.probability })), rng);
  const baseProbability = clamp(model.resolveActionProbability(state, action));
  const contestAttribute = action === 'DRIVE' || action === 'FINISH_2' ? 'finishing' :
    action === 'PULL_UP_2' || action === 'CATCH_SHOOT_3' ? 'shooting' : 'ball_security';

  const contestOutcome = action === 'TURNOVER' ? 'turnover' : 'success';
  const contest = resolvePlayerEventContest({
    eventId: `${state.possessionId}:${action}`,
    outcome: contestOutcome,
    attribute: contestAttribute,
    baseProbability,
    matchup: state.matchup,
  });

  const success = rng.next() < contest.resolvedProbability;
  let outcome: NBAOutcome;
  let points = 0;

  if (action === 'TURNOVER') {
    outcome = success ? 'TURNOVER' : 'MISS';
  } else if (action === 'FOUL_DRAWN') {
    outcome = 'FOUL_DRAWN';
  } else if (!success) {
    outcome = 'MISS';
  } else if (action === 'CATCH_SHOOT_3') {
    outcome = 'SCORE_3';
    points = 3;
  } else {
    outcome = 'SCORE_2';
    points = 2;
  }

  const nextTeamId = outcome === 'TURNOVER' || outcome === 'SCORE_2' || outcome === 'SCORE_3'
    ? state.opponentTeamId
    : state.teamId;
  const nextClockSeconds = Math.max(0, state.clockSeconds - 8 - rng.next() * 10);
  const nextShotClockSeconds = outcome === 'MISS' ? 14 : 24;
  const scoreDelta = Object.freeze({ [state.teamId]: points });

  return Object.freeze({
    possessionId: state.possessionId,
    action,
    outcome,
    points,
    nextTeamId,
    nextClockSeconds,
    nextShotClockSeconds,
    scoreDelta,
    resolvedProbability: contest.resolvedProbability,
    evidenceIds: Object.freeze([...new Set([...state.evidenceIds, ...contest.evidenceIds])].sort()),
  });
}
