export type AffectiveValence = "negative" | "neutral" | "positive";
export type AffectiveArousal = "low" | "medium" | "high";

/**
 * A persistent affective state for response shaping. This is an internal
 * computational state, not a claim that the model has human biology.
 */
export interface AffectiveState {
  valence: AffectiveValence;
  arousal: AffectiveArousal;
  intensity: number;
  curiosity: number;
  confidence: number;
  socialWarmth: number;
  frustration: number;
  lastUpdatedAt: string;
  reasons: string[];
}

export interface AffectiveEvent {
  sourceId: string;
  kind: "user-turn" | "task-result" | "learning" | "reflection" | "environment" | "system";
  valenceDelta?: number;
  arousalDelta?: number;
  curiosityDelta?: number;
  confidenceDelta?: number;
  warmthDelta?: number;
  frustrationDelta?: number;
  reason: string;
  occurredAt: string;
}

export interface AffectiveStateEngine {
  get(): AffectiveState;
  apply(event: AffectiveEvent): AffectiveState;
  decay(now?: string): AffectiveState;
}

export class InMemoryAffectiveStateEngine implements AffectiveStateEngine {
  private state: AffectiveState = {
    valence: "neutral",
    arousal: "medium",
    intensity: 0.2,
    curiosity: 0.5,
    confidence: 0.5,
    socialWarmth: 0.6,
    frustration: 0,
    lastUpdatedAt: new Date().toISOString(),
    reasons: [],
  };

  get(): AffectiveState {
    return { ...this.state, reasons: [...this.state.reasons] };
  }

  apply(event: AffectiveEvent): AffectiveState {
    this.state = {
      ...this.state,
      intensity: clamp(this.state.intensity + (event.valenceDelta ?? 0) * 0.25),
      curiosity: clamp(this.state.curiosity + (event.curiosityDelta ?? 0)),
      confidence: clamp(this.state.confidence + (event.confidenceDelta ?? 0)),
      socialWarmth: clamp(this.state.socialWarmth + (event.warmthDelta ?? 0)),
      frustration: clamp(this.state.frustration + (event.frustrationDelta ?? 0)),
      lastUpdatedAt: event.occurredAt,
      reasons: [event.reason, ...this.state.reasons].slice(0, 8),
    };
    this.state.valence = classifyValence(event.valenceDelta ?? 0);
    this.state.arousal = classifyArousal(event.arousalDelta ?? 0, this.state.frustration);
    return this.get();
  }

  decay(now = new Date().toISOString()): AffectiveState {
    this.state = {
      ...this.state,
      intensity: approach(this.state.intensity, 0.2, 0.05),
      frustration: approach(this.state.frustration, 0, 0.05),
      lastUpdatedAt: now,
    };
    return this.get();
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function approach(value: number, target: number, step: number): number {
  if (Math.abs(value - target) <= step) return target;
  return value + (value < target ? step : -step);
}

function classifyValence(delta: number): AffectiveValence {
  if (delta > 0.1) return "positive";
  if (delta < -0.1) return "negative";
  return "neutral";
}

function classifyArousal(delta: number, frustration: number): AffectiveArousal {
  const score = Math.abs(delta) + frustration;
  if (score >= 0.65) return "high";
  if (score <= 0.2) return "low";
  return "medium";
}
