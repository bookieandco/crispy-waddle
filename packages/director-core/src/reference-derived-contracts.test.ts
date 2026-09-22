import { describe, expect, it } from 'vitest';
import { evaluateVisualEditEvidence, overlayAvoidsProtectedRegions } from './visual-observation-evidence';
import { decideCreativeReviewPanel } from './creative-review-panel';
import { evaluateShotDramaturgy } from './dramaturgy-gate';
import { canResumeDirectorPhase, invalidateDirectorPhase } from './phase-checkpoint';

describe('reference-derived Director contracts', () => {
  it('fails visual edits closed when no frame evidence covers the interval', () => {
    const decision = evaluateVisualEditEvidence({
      editKind: 'zoom',
      startSeconds: 2,
      endSeconds: 4,
      timebase: { fps: 30, durationSeconds: 10, width: 1920, height: 1080 },
      observations: [],
    });
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_FRAME_EVIDENCE_REQUIRED');
  });

  it('accepts frame evidence and rejects overlays that cross a protected face region', () => {
    const observation = {
      id: 'obs-1',
      projectId: 'p',
      assetId: 'a',
      annotationKind: 'track' as const,
      observedAt: '2026-09-22T00:00:00Z',
      provider: 'vision-provider',
      frameStart: 0,
      frameEnd: 180,
      confidence: 0.95,
      evidenceRefs: ['frame-run:1'],
      limitations: [],
      protectedRegions: [{
        id: 'face-1',
        kind: 'face' as const,
        startSeconds: 1,
        endSeconds: 5,
        bounds: { x: 0.35, y: 0.15, width: 0.3, height: 0.45 },
        confidence: 0.99,
        trackId: 'person-1',
      }],
    };
    const decision = evaluateVisualEditEvidence({
      editKind: 'caption-layout',
      startSeconds: 2,
      endSeconds: 4,
      timebase: { fps: 30, durationSeconds: 10, width: 1920, height: 1080 },
      observations: [observation],
    });
    expect(decision.admissible).toBe(true);
    expect(decision.evidenceIds).toEqual(['obs-1']);
    expect(overlayAvoidsProtectedRegions({
      x: 0.4, y: 0.2, width: 0.2, height: 0.2, startSeconds: 2, endSeconds: 4,
    }, decision.protectedRegions)).toBe(false);
    expect(overlayAvoidsProtectedRegions({
      x: 0.02, y: 0.75, width: 0.25, height: 0.15, startSeconds: 2, endSeconds: 4,
    }, decision.protectedRegions)).toBe(true);
  });

  it('does not let a producer family self-acquit an artifact', () => {
    const decision = decideCreativeReviewPanel([
      {
        id: 'r-self',
        artifactId: 'asset-1',
        artifactSha256: 'abc',
        reviewerId: 'generator-reviewer',
        reviewerFamily: 'openai',
        producerFamily: 'openai',
        verdict: 'pass',
        evidenceRefs: ['e-self'],
        reviewedAt: '2026-09-22T00:00:00Z',
      },
      {
        id: 'r-google',
        artifactId: 'asset-1',
        artifactSha256: 'abc',
        reviewerId: 'reviewer-2',
        reviewerFamily: 'google',
        producerFamily: 'openai',
        verdict: 'pass',
        evidenceRefs: ['e-google'],
        reviewedAt: '2026-09-22T00:00:01Z',
      },
    ], {
      minimumDistinctReviewerFamilies: 2,
      allowWarnings: false,
      requireProducerIndependence: true,
    });
    expect(decision.accepted).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_REVIEW_SELF_ACQUITTAL_EXCLUDED');
    expect(decision.reasons).toContain('DIRECTOR_REVIEW_FAMILY_QUORUM_NOT_MET');
  });

  it('accepts two independent reviewer families over the same exact artifact digest', () => {
    const decision = decideCreativeReviewPanel([
      {
        id: 'r-google',
        artifactId: 'asset-1',
        artifactSha256: 'abc',
        reviewerId: 'reviewer-google',
        reviewerFamily: 'google',
        producerFamily: 'openai',
        verdict: 'pass',
        evidenceRefs: ['e-google'],
        reviewedAt: '2026-09-22T00:00:00Z',
      },
      {
        id: 'r-anthropic',
        artifactId: 'asset-1',
        artifactSha256: 'abc',
        reviewerId: 'reviewer-anthropic',
        reviewerFamily: 'anthropic',
        producerFamily: 'openai',
        verdict: 'pass',
        evidenceRefs: ['e-anthropic'],
        reviewedAt: '2026-09-22T00:00:01Z',
      },
    ], {
      minimumDistinctReviewerFamilies: 2,
      allowWarnings: false,
      requireProducerIndependence: true,
    });
    expect(decision.accepted).toBe(true);
  });

  it('requires a shot to do a narrative job and use motivated camera direction', () => {
    const bad = evaluateShotDramaturgy({
      shotId: 'shot-1',
      narrativeFunctions: [],
      motivatedCamera: false,
      readableSubjectGeometry: true,
      physicalDetailCount: 0,
    });
    expect(bad.admissible).toBe(false);
    expect(bad.reasons).toContain('DIRECTOR_DRAMATURGY_FUNCTION_REQUIRED');
    expect(bad.reasons).toContain('DIRECTOR_DRAMATURGY_CAMERA_UNMOTIVATED');

    const good = evaluateShotDramaturgy({
      shotId: 'shot-2',
      narrativeFunctions: ['emotion-change', 'advance-action'],
      motivatedCamera: true,
      readableSubjectGeometry: true,
      physicalDetailCount: 3,
      soundOrVisualAnchor: 'clock tick',
      intendedEmotion: 'rising dread',
      endingImageOrState: 'subject alone under dying practical light',
    });
    expect(good.admissible).toBe(true);
  });

  it('resumes a phase only when run, project, phase and exact input fingerprint still match', () => {
    const checkpoint = {
      id: 'cp-1',
      runId: 'run-1',
      projectId: 'p',
      phase: 'render',
      status: 'completed' as const,
      inputFingerprint: 'input-v1',
      outputArtifactIds: ['asset-1'],
      outputFingerprint: 'output-v1',
      completedAt: '2026-09-22T00:00:00Z',
    };

    expect(canResumeDirectorPhase(checkpoint, {
      runId: 'run-1', projectId: 'p', phase: 'render', inputFingerprint: 'input-v1',
    })).toBe(true);
    expect(canResumeDirectorPhase(checkpoint, {
      runId: 'run-1', projectId: 'p', phase: 'render', inputFingerprint: 'input-v2',
    })).toBe(false);
    expect(invalidateDirectorPhase(checkpoint, 'input-v2').status).toBe('stale');
  });
});
