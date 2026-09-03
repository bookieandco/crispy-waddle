import type { ISODateTime, Sport } from './contracts.js';

export type PlayerAttributeKind = 'ABILITY' | 'TENDENCY' | 'STATE';
export type PlayerAttributeValue = { readonly mean: number; readonly uncertainty: number; readonly sampleSize: number; readonly asOf: ISODateTime; readonly evidenceIds: readonly string[] };
export type PlayerSliderDimension = 'BASE' | 'RECENT_FORM' | 'MATCHUP' | 'ROLE' | 'FATIGUE' | 'PRESSURE' | 'CURRENT_STATE';

export interface PlayerAttributeDefinition {
  key: string;
  label: string;
  kind: PlayerAttributeKind;
  min: number;
  max: number;
  defaultValue: number;
  sport?: Sport;
}

export interface PlayerAttributeEvidence {
  evidenceId: string;
  eventId: string;
  playerId: string;
  attribute: string;
  value: number;
  weight: number;
  observedAt: ISODateTime;
  sourceTimestamp?: ISODateTime;
  context?: Readonly<Record<string, string | number | boolean>>;
  outcome?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  provenance: 'OFFICIAL' | 'VIDEO_ATTRIBUTION' | 'MODEL_ASSISTED';
}

export interface PlayAward {
  awardId: string;
  eventId: string;
  playerId: string;
  contribution: number;
  attributes: Readonly<Record<string, number>>;
  evidenceIds: readonly string[];
  observedAt: ISODateTime;
  creditMethod: 'OFFICIAL' | 'VIDEO_ATTRIBUTION' | 'MODEL_ASSISTED';
}

export interface PlayerProfile {
  playerId: string;
  sport: Sport;
  attributes: Readonly<Record<string, PlayerAttributeValue>>;
  updatedAt: ISODateTime;
}

export interface PlayerContext {
  asOf: ISODateTime;
  opponentId?: string;
  matchupPlayerId?: string;
  role?: string;
  period?: number;
  clockSecondsRemaining?: number;
  fatigue: number;
  pressure: number;
  recentForm: number;
  matchupAdjustment: number;
}

export interface ResolvedPlayerSlider {
  attribute: string;
  value: number;
  uncertainty: number;
  components: Readonly<Record<PlayerSliderDimension, number>>;
  evidenceIds: readonly string[];
}

export interface ResolvedPlayerState {
  playerId: string;
  sport: Sport;
  asOf: ISODateTime;
  sliders: Readonly<Record<string, ResolvedPlayerSlider>>;
}

export const UNIVERSAL_PLAYER_SLIDERS: readonly PlayerAttributeDefinition[] = [
  ['athleticism', 'Athleticism'], ['speed', 'Speed'], ['acceleration', 'Acceleration'], ['strength', 'Strength'], ['endurance', 'Endurance'],
  ['coordination', 'Coordination'], ['decision_making', 'Decision Making'], ['reaction', 'Reaction'], ['consistency', 'Consistency'],
  ['aggression', 'Aggression'], ['discipline', 'Discipline'], ['pressure_response', 'Pressure Response'], ['fatigue_resistance', 'Fatigue Resistance'],
].map(([key, label]) => ({ key, label, kind: 'ABILITY', min: 0, max: 100, defaultValue: 50 }));

const SPORT_SLIDERS: Record<Sport, readonly PlayerAttributeDefinition[]> = {
  NBA: [
    ['finishing', 'Finishing'], ['midrange', 'Midrange Shooting'], ['three_point', 'Three-Point Shooting'], ['pull_up', 'Pull-Up Shooting'],
    ['shot_creation', 'Shot Creation'], ['passing', 'Passing'], ['pick_and_roll', 'Pick-and-Roll'], ['ball_security', 'Ball Security'],
    ['perimeter_defense', 'Perimeter Defense'], ['interior_defense', 'Interior Defense'], ['help_defense', 'Help Defense'], ['rebounding', 'Rebounding'],
    ['steal', 'Steal'], ['block', 'Block'], ['usage_tendency', 'Usage Tendency'], ['drive_tendency', 'Drive Tendency'], ['late_game_usage', 'Late-Game Usage'],
  ],
  NFL: [
    ['route_running', 'Route Running'], ['separation', 'Separation'], ['catching', 'Catching'], ['contested_catch', 'Contested Catch'], ['release', 'Release'],
    ['throw_power', 'Throw Power'], ['throw_accuracy', 'Throw Accuracy'], ['pocket_awareness', 'Pocket Awareness'], ['decision_making_qb', 'QB Decision Making'],
    ['pass_rush', 'Pass Rush'], ['coverage', 'Coverage'], ['tackling', 'Tackling'], ['run_defense', 'Run Defense'], ['ball_tracking', 'Ball Tracking'],
    ['blocking', 'Blocking'], ['explosiveness', 'Explosiveness'], ['fumble_resistance', 'Fumble Resistance'], ['target_tendency', 'Target Tendency'],
  ],
  MLB: [
    ['contact', 'Contact'], ['power', 'Power'], ['plate_discipline', 'Plate Discipline'], ['pitch_recognition', 'Pitch Recognition'], ['bat_speed', 'Bat Speed'],
    ['baserunning', 'Baserunning'], ['steal_tendency', 'Steal Tendency'], ['fielding', 'Fielding'], ['range', 'Range'], ['arm_strength', 'Arm Strength'],
    ['throwing_accuracy', 'Throwing Accuracy'], ['pitch_velocity', 'Pitch Velocity'], ['pitch_control', 'Pitch Control'], ['pitch_movement', 'Pitch Movement'],
    ['pitch_command', 'Pitch Command'], ['strikeout_ability', 'Strikeout Ability'], ['ground_ball_tendency', 'Ground-Ball Tendency'], ['clutch_batting_tendency', 'Late-Inning Batting Tendency'],
  ],
  NHL: [
    ['shooting', 'Shooting'], ['wrist_shot', 'Wrist Shot'], ['slap_shot', 'Slap Shot'], ['finishing', 'Finishing'], ['passing', 'Passing'],
    ['puck_control', 'Puck Control'], ['deking', 'Deking'], ['faceoffs', 'Faceoffs'], ['forechecking', 'Forechecking'], ['backchecking', 'Backchecking'],
    ['defensive_positioning', 'Defensive Positioning'], ['shot_blocking', 'Shot Blocking'], ['checking', 'Checking'], ['goaltending', 'Goaltending'],
    ['rebound_control', 'Rebound Control'], ['power_play_role', 'Power-Play Role'], ['penalty_tendency', 'Penalty Tendency'],
  ],
  SOCCER: [
    ['finishing', 'Finishing'], ['shot_power', 'Shot Power'], ['passing', 'Passing'], ['vision', 'Vision'], ['first_touch', 'First Touch'],
    ['dribbling', 'Dribbling'], ['crossing', 'Crossing'], ['set_piece', 'Set Pieces'], ['positioning', 'Positioning'], ['pressing', 'Pressing'],
    ['tackling', 'Tackling'], ['interceptions', 'Interceptions'], ['aerial', 'Aerial Ability'], ['pace', 'Pace'], ['stamina', 'Stamina'],
    ['chance_creation', 'Chance Creation'], ['shot_tendency', 'Shot Tendency'], ['progressive_pass_tendency', 'Progressive Pass Tendency'],
  ],
  TENNIS: [
    ['serve_power', 'Serve Power'], ['serve_accuracy', 'Serve Accuracy'], ['first_serve', 'First Serve'], ['second_serve', 'Second Serve'],
    ['return', 'Return'], ['forehand', 'Forehand'], ['backhand', 'Backhand'], ['volley', 'Volley'], ['net_play', 'Net Play'],
    ['movement', 'Court Movement'], ['defense', 'Defense'], ['rally_tolerance', 'Rally Tolerance'], ['break_point_play', 'Break-Point Play'],
    ['surface_adaptation', 'Surface Adaptation'], ['shot_selection', 'Shot Selection'], ['aggression_tendency', 'Aggression Tendency'],
  ],
  OTHER: [],
};

function definition(key: string, label: string, sport: Sport): PlayerAttributeDefinition {
  const tendency = /tendency|usage|role|aggression/i.test(key);
  return Object.freeze({ key, label, kind: tendency ? 'TENDENCY' : 'ABILITY', min: 0, max: 100, defaultValue: 50, sport });
}

export function playerSliderDefinitions(sport: Sport): readonly PlayerAttributeDefinition[] {
  const sportDefinitions = SPORT_SLIDERS[sport].map(([key, label]) => definition(key, label, sport));
  const universal = UNIVERSAL_PLAYER_SLIDERS.map((item) => ({ ...item, sport }));
  const seen = new Set<string>();
  return Object.freeze([...universal, ...sportDefinitions].filter((item) => !seen.has(item.key) && seen.add(item.key)));
}

function assertFiniteRange(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${label} must be within [0,100]`);
}

function assertDate(value: string, label: string): void {
  if (!Number.isFinite(new Date(value).getTime())) throw new Error(`${label} must be a valid ISO datetime`);
}

function clamp(value: number): number { return Math.max(0, Math.min(100, value)); }

function recencyWeight(observedAt: string, asOf: string): number {
  const ageDays = Math.max(0, (new Date(asOf).getTime() - new Date(observedAt).getTime()) / 86_400_000);
  return Math.exp(-ageDays / 30);
}

export class PlayerAttributeEngine {
  private readonly evidence = new Map<string, PlayerAttributeEvidence>();
  private readonly profiles = new Map<string, PlayerProfile>();

  addEvidence(item: PlayerAttributeEvidence): void {
    if (!item.evidenceId || !item.eventId || !item.playerId || !item.attribute) throw new Error('Player evidence requires identifiers');
    assertFiniteRange(item.value, 'Player evidence value');
    if (!Number.isFinite(item.weight) || item.weight <= 0) throw new Error('Player evidence weight must be positive');
    assertDate(item.observedAt, 'Player evidence observedAt');
    if (item.sourceTimestamp) assertDate(item.sourceTimestamp, 'Player evidence sourceTimestamp');
    if (this.evidence.has(item.evidenceId)) throw new Error(`Player evidence ${item.evidenceId} already exists`);
    this.evidence.set(item.evidenceId, Object.freeze({ ...item, context: item.context ? Object.freeze({ ...item.context }) : undefined }));
  }

  ingestPlayAward(award: PlayAward): void {
    if (!award.awardId || !award.eventId || !award.playerId || award.evidenceIds.length === 0) throw new Error('Play award requires identifiers and evidence');
    assertDate(award.observedAt, 'Play award observedAt');
    for (const [attribute, value] of Object.entries(award.attributes)) {
      assertFiniteRange(value, `Play award ${attribute}`);
      this.addEvidence({ evidenceId: `${award.awardId}:${attribute}`, eventId: award.eventId, playerId: award.playerId, attribute, value, weight: 1, observedAt: award.observedAt, outcome: award.contribution > 0 ? 'POSITIVE' : award.contribution < 0 ? 'NEGATIVE' : 'NEUTRAL', provenance: award.creditMethod });
    }
  }

  buildProfile(playerId: string, sport: Sport, asOf: ISODateTime): PlayerProfile {
    assertDate(asOf, 'Profile asOf');
    const definitions = playerSliderDefinitions(sport);
    const attributes: Record<string, PlayerAttributeValue> = {};
    for (const definition of definitions) {
      const observations = [...this.evidence.values()].filter((item) => item.playerId === playerId && item.attribute === definition.key && new Date(item.observedAt).getTime() <= new Date(asOf).getTime());
      let weighted = 0;
      let weightTotal = 0;
      for (const item of observations) {
        const weight = item.weight * recencyWeight(item.observedAt, asOf);
        weighted += item.value * weight;
        weightTotal += weight;
      }
      const mean = weightTotal > 0 ? weighted / weightTotal : definition.defaultValue;
      const uncertainty = weightTotal > 0 ? clamp(30 / Math.sqrt(weightTotal)) : 30;
      attributes[definition.key] = Object.freeze({ mean: clamp(mean), uncertainty, sampleSize: observations.length, asOf, evidenceIds: Object.freeze(observations.map((item) => item.evidenceId).sort()) });
    }
    const profile = Object.freeze({ playerId, sport, attributes: Object.freeze(attributes), updatedAt: asOf });
    this.profiles.set(playerId, profile);
    return profile;
  }

  resolve(playerId: string, sport: Sport, context: PlayerContext): ResolvedPlayerState {
    const profile = this.profiles.get(playerId) ?? this.buildProfile(playerId, sport, context.asOf);
    assertFiniteRange(context.fatigue, 'Fatigue');
    assertFiniteRange(context.pressure, 'Pressure');
    assertFiniteRange(context.recentForm, 'Recent form');
    assertFiniteRange(context.matchupAdjustment, 'Matchup adjustment');

    const sliders: Record<string, ResolvedPlayerSlider> = {};
    for (const [attribute, value] of Object.entries(profile.attributes)) {
      const form = context.recentForm - 50;
      const matchup = context.matchupAdjustment;
      const fatiguePenalty = context.fatigue * ((attribute.includes('endurance') || attribute.includes('resistance')) ? 0.12 : 0.30);
      const pressureEffect = (context.pressure - 50) * (attribute.includes('pressure') ? 0.35 : 0.08);
      const roleEffect = context.role ? roleAdjustment(attribute, context.role) : 0;
      const current = clamp(value.mean + form * 0.18 + matchup * 0.35 + roleEffect + pressureEffect - fatiguePenalty);
      sliders[attribute] = Object.freeze({ attribute, value: current, uncertainty: value.uncertainty, components: Object.freeze({ BASE: value.mean, RECENT_FORM: form * 0.18, MATCHUP: matchup * 0.35, ROLE: roleEffect, FATIGUE: -fatiguePenalty, PRESSURE: pressureEffect, CURRENT_STATE: current - value.mean - form * 0.18 - matchup * 0.35 - roleEffect - pressureEffect + fatiguePenalty }), evidenceIds: value.evidenceIds });
    }
    return Object.freeze({ playerId, sport, asOf: context.asOf, sliders: Object.freeze(sliders) });
  }
}

function roleAdjustment(attribute: string, role: string): number {
  const roleKey = role.toLowerCase();
  if ((roleKey.includes('starter') || roleKey.includes('primary')) && /usage|shot|creation|target|serve|passing/i.test(attribute)) return 4;
  if (roleKey.includes('defensive') && /defense|tackle|coverage|blocking|interception|positioning/i.test(attribute)) return 4;
  if (roleKey.includes('goalkeeper') && /goal|save|reaction|defense/i.test(attribute)) return 6;
  return 0;
}

export interface PlayerMatchupInput { playerId: string; opponentId: string; playerState: ResolvedPlayerState; opponentState: ResolvedPlayerState; }

export interface PlayerMatchupResult { playerId: string; opponentId: string; adjustments: Readonly<Record<string, number>>; uncertainty: number; explanation: readonly string[]; }

export function resolvePlayerMatchup(input: PlayerMatchupInput): PlayerMatchupResult {
  if (input.playerState.playerId !== input.playerId) throw new Error('Player state identity mismatch');
  if (input.opponentState.playerId !== input.opponentId) throw new Error('Opponent state identity mismatch');
  const adjustments: Record<string, number> = {};
  const explanation: string[] = [];
  for (const [attribute, player] of Object.entries(input.playerState.sliders)) {
    const opponent = input.opponentState.sliders[attribute];
    if (!opponent) continue;
    const delta = clamp(player.value) - clamp(opponent.value);
    adjustments[attribute] = Math.max(-25, Math.min(25, delta * 0.25));
    if (Math.abs(adjustments[attribute]) >= 5) explanation.push(`${attribute}: matchup adjustment ${adjustments[attribute].toFixed(1)}`);
  }
  const uncertainty = Math.min(100, Object.values(input.playerState.sliders).reduce((sum, item) => sum + item.uncertainty, 0) / Math.max(1, Object.keys(input.playerState.sliders).length));
  return Object.freeze({ playerId: input.playerId, opponentId: input.opponentId, adjustments: Object.freeze(adjustments), uncertainty, explanation: Object.freeze(explanation.sort()) });
}
