import type { SharkObservation } from '../observations/SharkObservation';
import { evaluateStreetSmartRisk, type SharkStreetSmartRisk } from './SharkStreetSmartRisk';

export interface SharkFusedSignal {
  readonly score: number;
  readonly confidence: number;
  readonly corroboration: number;
  readonly contradiction: number;
  readonly risk: SharkStreetSmartRisk;
  readonly reasons: readonly string[];
  readonly observationIds: readonly string[];
}

/**
 * Fuses independent observations without granting execution authority.
 * Corroboration increases confidence; contradictory evidence reduces it.
 */
export function fuseSharkSignals(
  observations: readonly SharkObservation[],
): SharkFusedSignal {
  if (observations.length === 0) {
    return {
      score: 0,
      confidence: 0,
      corroboration: 0,
      contradiction: 0,
      risk: evaluateStreetSmartRisk([]),
      reasons: ['No observations available.'],
      observationIds: [],
    };
  }

  const risk = evaluateStreetSmartRisk(observations);
  const reliable = observations.filter((o) => o.confidence >= 0.7);
  const sources = new Set(reliable.map((o) => o.evidence.map((e) => e.source)).flat());
  const corroboration = Math.min(1, sources.size / 4);
  const contradictionCount = observations.reduce((n, o) => n + (o.contradictions?.length ?? 0), 0);
  const contradiction = Math.min(1, contradictionCount / Math.max(1, observations.length));

  const confidence = Math.max(0, Math.min(1,
    (reliable.length / observations.length) * 0.65 + corroboration * 0.35 - contradiction * 0.3,
  ));
  const score = Math.max(0, Math.min(1, confidence * (1 - risk.rugRisk)));

  const reasons = [
    `${sources.size} independent source type(s) corroborate the signal.`,
    `${reliable.length}/${observations.length} observations meet the reliability threshold.`,
    ...(risk.flags.map((flag) => flag.title)),
    ...(contradictionCount > 0 ? [`${contradictionCount} contradiction(s) detected; confidence reduced.`] : []),
  ];

  return {
    score,
    confidence,
    corroboration,
    contradiction,
    risk,
    reasons,
    observationIds: observations.map((o) => o.id),
  };
}
