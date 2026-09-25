import { describe, expect, it } from 'vitest';
import {
  evaluateDirectedTakeQc,
  planDirectedTakeRepair,
  REALISTIC_CHARACTER_TAKE_QC,
  SOURCE_PRESERVING_VIDEO_EDIT_QC,
  ACTION_SEQUENCE_TAKE_QC,
  CINEMATOGRAPHY_CAMERA_TAKE_QC,
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

  it('proposes a narrow region repair when QC localizes the failure', () => {
    const observations = REALISTIC_CHARACTER_TAKE_QC.requiredMetrics.map((metric) =>
      metric === 'hand-anatomy'
        ? {
            ...observation(metric, 0.4),
            hardFailure: true,
            startSeconds: 3.7,
            endSeconds: 4.1,
          }
        : observation(metric),
    );
    const decision = evaluateDirectedTakeQc(observations, REALISTIC_CHARACTER_TAKE_QC);
    const repair = planDirectedTakeRepair(decision);
    expect(repair.scope).toBe('region');
    expect(repair.startSeconds).toBe(3.7);
    expect(repair.endSeconds).toBe(4.1);
    expect(repair.failingMetrics).toContain('hand-anatomy');
    expect(repair.preserve).toContain('camera-plan');
    expect(repair.authority).toBe('PROPOSAL_ONLY');
  });

  it('proposes audio-only repair when picture passes and only audio metrics fail', () => {
    const policy = {
      id: 'dialogue',
      requiredMetrics: ['dialogue-prosody', 'audio-sync'] as const,
      minimumScoreByMetric: { 'dialogue-prosody': 0.8, 'audio-sync': 0.8 },
      minimumConfidence: 0.5,
      failOnHardFailure: true,
    };
    const decision = evaluateDirectedTakeQc([
      observation('dialogue-prosody', 0.5),
      observation('audio-sync', 0.6),
    ], policy);
    const repair = planDirectedTakeRepair(decision);
    expect(repair.scope).toBe('audio-only');
    expect(repair.instruction).toContain('Preserve picture and camera timing');
  });

  it('fails a fast action take on body warp, flicker or detail loss even when motion is energetic', () => {
    const observations = ACTION_SEQUENCE_TAKE_QC.requiredMetrics.map((metric) =>
      metric === 'body-structure'
        ? { ...observation(metric, 0.45), hardFailure: true }
        : metric === 'temporal-flicker'
          ? observation(metric, 0.5)
          : metric === 'detail-retention'
            ? observation(metric, 0.55)
            : observation(metric),
    );
    const decision = evaluateDirectedTakeQc(observations, ACTION_SEQUENCE_TAKE_QC);
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_DIRECTED_TAKE_QC_SCORE_LOW:body-structure',
      'DIRECTOR_DIRECTED_TAKE_QC_HARD_FAILURE:body-structure',
      'DIRECTOR_DIRECTED_TAKE_QC_SCORE_LOW:temporal-flicker',
      'DIRECTOR_DIRECTED_TAKE_QC_SCORE_LOW:detail-retention',
    ]));
  });

  it('separates camera position, composition, and movement QC', () => {
    const observations = CINEMATOGRAPHY_CAMERA_TAKE_QC.requiredMetrics.map((metric) =>
      metric === 'camera-composition-match'
        ? observation(metric, 0.55)
        : observation(metric),
    );
    const decision = evaluateDirectedTakeQc(observations, CINEMATOGRAPHY_CAMERA_TAKE_QC);
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_DIRECTED_TAKE_QC_SCORE_LOW:camera-composition-match');
    expect(planDirectedTakeRepair(decision).preserve).not.toContain('camera-plan');
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
