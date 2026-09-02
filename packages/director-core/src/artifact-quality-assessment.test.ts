import { describe, expect, it } from 'vitest';
import { createArtifactQualityAssessment, retrySignal } from './artifact-quality-assessment';

describe('artifact quality assessment', () => {
  const base = {
    id: 'qa:asset-1:1',
    assetId: 'asset-1',
    evaluator: 'director-vision-audit',
    dimensions: [
      { dimension: 'continuity', score: 0.9, passed: true },
      { dimension: 'composition', score: 0.8, passed: true },
    ],
    overallScore: 0.85,
    passed: true,
    retryRecommended: false,
    retryCount: 0,
    reasons: [],
    evidence: ['vision:audit:1'],
    assessedAt: '2026-09-02T00:00:00.000Z',
  };

  it('validates and preserves dimension-level results', () => {
    const assessment = createArtifactQualityAssessment(base);
    expect(assessment.dimensions[0].dimension).toBe('continuity');
  });

  it('rejects scores outside the normalized range', () => {
    expect(() => createArtifactQualityAssessment({ ...base, overallScore: 1.1 })).toThrow('artifact_quality_overall_score_invalid');
  });

  it('rejects duplicate dimensions', () => {
    expect(() => createArtifactQualityAssessment({
      ...base,
      dimensions: [base.dimensions[0], { ...base.dimensions[0] }],
    })).toThrow('artifact_quality_duplicate_dimension');
  });

  it('does not mutate caller-owned arrays', () => {
    const assessment = createArtifactQualityAssessment(base);
    expect(assessment.reasons).not.toBe(base.reasons);
    expect(assessment.evidence).not.toBe(base.evidence);
  });

  it('turns a failed assessment into a retry planning signal only', () => {
    const failed = createArtifactQualityAssessment({
      ...base,
      id: 'qa:asset-1:2',
      overallScore: 0.42,
      passed: false,
      retryRecommended: true,
      retryCount: 2,
      reasons: ['continuity below threshold'],
    });
    expect(retrySignal(failed)).toEqual({
      assetId: 'asset-1',
      retryRecommended: true,
      reasons: ['continuity below threshold'],
      nextRetryCount: 3,
    });
  });
});
