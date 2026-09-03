import type { ISODateTime, Sport } from './contracts.js';

export interface PlayerFatigueState {
  playerId: string;
  sport: Sport;
  fatigue: number;
  recoveryRate: number;
  exertionLoad: number;
  consecutiveMinutes: number;
  minutesPlayed: number;
  benchMinutes: number;
  asOf: ISODateTime;
  evidenceIds: readonly string[];
}

export interface PlayerExertionEvent {
  eventId: string;
  playerId: string;
  intensity: number;
  durationSeconds: number;
  asOf: ISODateTime;
  evidenceIds: readonly string[];
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

export function applyPlayerExertion(
  state: PlayerFatigueState,
  event: PlayerExertionEvent,
): PlayerFatigueState {
  if (event.playerId !== state.playerId) throw new Error('Fatigue event player identity mismatch');
  if (!Number.isFinite(event.intensity) || event.intensity < 0 || event.intensity > 100) throw new Error('Exertion intensity must be within [0,100]');
  if (!Number.isFinite(event.durationSeconds) || event.durationSeconds <= 0) throw new Error('Exertion duration must be positive');
  const load = (event.intensity / 100) * Math.min(120, event.durationSeconds / 60);
  return Object.freeze({
    ...state,
    fatigue: clamp(state.fatigue + load * 0.55),
    exertionLoad: state.exertionLoad + load,
    consecutiveMinutes: state.consecutiveMinutes + event.durationSeconds / 60,
    minutesPlayed: state.minutesPlayed + event.durationSeconds / 60,
    benchMinutes: 0,
    asOf: event.asOf,
    evidenceIds: Object.freeze([...new Set([...state.evidenceIds, ...event.evidenceIds, event.eventId])].sort()),
  });
}

export function recoverPlayer(
  state: PlayerFatigueState,
  benchMinutes: number,
  asOf: ISODateTime,
): PlayerFatigueState {
  if (!Number.isFinite(benchMinutes) || benchMinutes < 0) throw new Error('Bench minutes must be non-negative');
  const recovery = benchMinutes * Math.max(0, state.recoveryRate) * 0.5;
  return Object.freeze({
    ...state,
    fatigue: clamp(state.fatigue - recovery),
    consecutiveMinutes: 0,
    benchMinutes: state.benchMinutes + benchMinutes,
    asOf,
  });
}

export function fatigueAttributeMultiplier(
  fatigue: number,
  fatigueResistance: number,
): number {
  const f = clamp(fatigue) / 100;
  const resistance = clamp(fatigueResistance) / 100;
  return clamp(1 - f * (0.35 - resistance * 0.20), 0.55, 1);
}

export function consecutiveMinutesPenalty(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return clamp(Math.max(0, minutes - 8) * 0.8, 0, 20);
}
