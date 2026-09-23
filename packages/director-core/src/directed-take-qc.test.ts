import { describe, expect, it } from 'vitest';
import {
  evaluateDirectedTakeQc,
  REALISTIC_CHARACTER_TAKE_QC,
  SOURCE_PRESERVING_VIDEO_EDIT_QC,
  type DirectedTakeQcObservation,
} from './directed-take-qc.js';

function observation(
  metric: DirectedTakeQcObservation['metric'],
  score = 0.95,
  confidence = 0.9,
): DirectedTakeQcObservation {
  return {
    metric,
    score,
    confidence,
    evidenceIds: [`evidence:${metric}`],
  };
}

describe('directed take QC', () => {
  it('passes a realistic character take only when all required directed metrics have evidence', () => {
    const observations = REALISTIC_CHARACTER_TAKE_QC.requiredMetrics.map((metric) => observation(metric));
    const decision = evaluateDirectedTakeQc(observations, REALISTIC_CHARACTER_TAKE_QC);
    expect(decision.admissible).toBe(true);
    expect(decision.authority).toBe('DIRECTOR_QC');
  });

  it('fails on anatomy drift even when other metrics are strong', () => {
    const observations = REALISTIC_CHARACTER_TAKE_QC.requiredMetrics.map((metric) =>
      metric === 'hand-anatomy'
        ? { ...observation(metric, 0.4), hardFailure: true }
        : observation(metric),
    );
    const decision = evaluateDirectedTakeQc(observations, REALISTIC_CHARACTER_TAKE_QC);
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_DIRECTED_TAKE_QC_SCORE_LOW:hand-anatomy');
    expect(decision.reasons).toContain('DIRECTOR_DIRECTED_TAKE_QC_HARD_FAILURE:hand-anatomy');
  });

  it('fails closed when source preservation has not been observed', () => {
    const observations = SOURCE_PRESERVING_VIDEO_EDIT_QC.requiredMetrics
      .filter((metric) => metric !== 'source-preservation')
      .map((metric) => observation(metric));
    const decision = evaluateDirectedTakeQc(observations, SOURCE_PRESERVING_VIDEO_EDIT_QC);
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_DIRECTED_TAKE_QC_MISSING:source-preservation');
  });
});
