export type SituationalMode = 'PLAYFUL' | 'NORMAL' | 'SERIOUS';

export interface SituationalSignals {
  seriousness: number;
  urgency: number;
  emotionalLoad: number;
  humorAllowance: number;
  playfulnessAllowance: number;
  directnessRequired: number;
  reassuranceNeeded: number;
  confidence: number;
}

export interface SituationalInput {
  topicSeverity?: number;
  urgency?: number;
  emotionalLoad?: number;
  explicitSeriousness?: number;
  humorSignal?: number;
  safetySignal?: number;
  consequenceLevel?: 'low' | 'medium' | 'high' | 'critical';
}

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function assessSituation(input: SituationalInput): SituationalSignals {
  const severity = clamp(input.topicSeverity ?? 0);
  const urgency = clamp(input.urgency ?? 0);
  const emotionalLoad = clamp(input.emotionalLoad ?? 0);
  const explicit = clamp(input.explicitSeriousness ?? 0);
  const humor = clamp(input.humorSignal ?? 0);
  const safety = clamp(input.safetySignal ?? 0);
  const consequence = input.consequenceLevel === 'critical' ? 100
    : input.consequenceLevel === 'high' ? 80
    : input.consequenceLevel === 'medium' ? 50 : 20;

  const seriousness = clamp(
    severity * 0.25 + urgency * 0.2 + emotionalLoad * 0.15 + explicit * 0.2 + safety * 0.1 + consequence * 0.1,
  );
  const mode: SituationalMode = seriousness >= 70 ? 'SERIOUS' : seriousness <= 30 ? 'PLAYFUL' : 'NORMAL';
  const humorAllowance = clamp(100 - seriousness * 1.15);
  const playfulnessAllowance = clamp(100 - seriousness);
  const directnessRequired = clamp(35 + seriousness * 0.65);
  const reassuranceNeeded = clamp(emotionalLoad * 0.65 + seriousness * 0.2);
  const confidence = clamp(50 + Math.abs(seriousness - 50) * 0.5 + Math.abs(humor - 50) * 0.25);

  return { seriousness, urgency, emotionalLoad, humorAllowance, playfulnessAllowance, directnessRequired, reassuranceNeeded, confidence };
}

export function situationalMode(signals: SituationalSignals): SituationalMode {
  return signals.seriousness >= 70 ? 'SERIOUS' : signals.seriousness <= 30 ? 'PLAYFUL' : 'NORMAL';
}

export function modulateSlider(base: number, allowance: number): number {
  return clamp((clamp(base) * clamp(allowance)) / 100);
}
