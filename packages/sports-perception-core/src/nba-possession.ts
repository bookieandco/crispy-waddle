import type { PlayerSimulationMatchup } from './player-simulation.js';
import type { RandomSource } from './simulation.js';
import type { NBAPossessionContext } from './nba-possession-context.js';
import { resolvePlayerEventContest } from './player-event-simulation.js';

export type NBAAction = 'SHOT_2' | 'SHOT_3' | 'DRIVE' | 'PASS' | 'TURNOVER' | 'FOUL';

export interface NBAPlayerState {
  playerId: string;
  usage: number;
  finishing: number;
  shotCreation: number;
  threePoint: number;
  ballSecurity: number;
}

export interface NBAPossessionState {
  possessionId: string;
  offenseTeamId: string;
  defenseTeamId: string;
  clockSeconds: number;
  shotClockSeconds: number;
  scoreMargin: number;
  ballHandler: NBAPlayerState;
  primaryDefender: NBAPlayerState;
  matchup: PlayerSimulationMatchup;
  context?: NBAPossessionContext;
}

export interface NBAPossessionResult {
  possessionId: string;
  action: NBAAction;
  points: 0 | 1 | 2 | 3;
  madeShot: boolean;
  nextOffenseTeamId: string;
  clockSecondsRemaining: number;
  probabilities: Readonly<Record<string, number>>;
  evidenceIds: readonly string[];
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

const weightedChoice = (rng: RandomSource, choices: readonly { label: NBAAction; probability: number }[]): NBAAction => {
  const total = choices.reduce((sum, c) => sum + c.probability, 0);
  const draw = rng.next() * total;
  let cumulative = 0;
  for (const choice of choices) {
    cumulative += choice.probability;
    if (draw < cumulative) return choice.label;
  }
  return choices[choices.length - 1].label;
};

export function resolveNBAPossession(state: NBAPossessionState, rng: RandomSource): NBAPossessionResult {
  if (!state.possessionId.trim()) throw new Error('Possession ID is required');
  if (state.clockSeconds <= 0) throw new Error('Possession cannot start with an expired game clock');
  if (state.shotClockSeconds <= 0) throw new Error('Possession cannot start with an expired shot clock');

  const matchup = state.matchup;
  const context = state.context;
  const offenseFactor = context?.offensiveLineupFactor ?? 1;
  const defenseFactor = context?.defensiveLineupFactor ?? 1;
  const turnoverFactor = context?.turnoverFactor ?? 1;
  const foulFactor = context?.foulFactor ?? 1;
  const usageShare = context?.usageShare ?? clamp(state.ballHandler.usage / 100, 0, 1);

  const turnoverAdjustment = matchup.attributeAdjustments.ball_security ?? 0;
  const turnoverProbability = clamp((0.12 - state.ballHandler.ballSecurity / 1000 - turnoverAdjustment / 1000) * turnoverFactor * (1 + usageShare * 0.15));
  const foulProbability = clamp((0.08 + Math.max(0, -(matchup.attributeAdjustments.finishing ?? 0)) / 1000) * foulFactor);
  const driveProbability = clamp((0.32 + state.ballHandler.shotCreation / 500 + (matchup.attributeAdjustments.finishing ?? 0) / 500) * offenseFactor);
  const threeProbability = clamp((0.35 + state.ballHandler.threePoint / 300) * offenseFactor / Math.max(0.85, defenseFactor));
  const passProbability = clamp(0.12 + usageShare * 0.08);

  const action = weightedChoice(rng, [
    { label: 'TURNOVER', probability: turnoverProbability },
    { label: 'FOUL', probability: foulProbability },
    { label: 'PASS', probability: passProbability },
    { label: 'DRIVE', probability: driveProbability },
    { label: 'SHOT_3', probability: threeProbability },
    { label: 'SHOT_2', probability: 1 },
  ]);

  let points: 0 | 1 | 2 | 3 = 0;
  let madeShot = false;
  if (action === 'DRIVE' || action === 'SHOT_2' || action === 'SHOT_3') {
    const attribute = action === 'SHOT_3' ? 'shot_creation' : 'finishing';
    const baseProbability = action === 'SHOT_3' ? 0.36 : action === 'DRIVE' ? 0.56 : 0.50;
    const contest = resolvePlayerEventContest({
      eventId: `${state.possessionId}:${action}`,
      outcome: action,
      attribute,
      baseProbability,
      matchup,
      scenarioAdjustment: Math.log(Math.max(0.5, offenseFactor / Math.max(0.5, defenseFactor))),
    });
    madeShot = rng.next() < contest.resolvedProbability;
    if (madeShot) points = action === 'SHOT_3' ? 3 : 2;
  }

  const elapsed = Math.max(1, Math.min(state.shotClockSeconds, 8 + Math.floor(rng.next() * 16)));
  const terminalPossession = action === 'TURNOVER' || action === 'FOUL' || madeShot;
  return Object.freeze({
    possessionId: state.possessionId,
    action,
    points,
    madeShot,
    nextOffenseTeamId: terminalPossession ? state.defenseTeamId : state.offenseTeamId,
    clockSecondsRemaining: Math.max(0, state.clockSeconds - elapsed),
    probabilities: Object.freeze({ turnover: turnoverProbability, foul: foulProbability, pass: passProbability, drive: driveProbability, three: threeProbability, offenseFactor, defenseFactor, usageShare }),
    evidenceIds: Object.freeze([...new Set([
      ...matchup.attacker.evidenceIds,
      ...matchup.defender.evidenceIds,
      ...(context?.evidenceIds ?? []),
    ])].sort()),
  });
}
