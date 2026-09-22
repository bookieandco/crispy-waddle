import { describe, expect, it } from 'vitest';
import { evaluateVisualEditEvidence, overlayAvoidsProtectedRegions } from './visual-observation-evidence';
import { decideCreativeReviewPanel } from './creative-review-panel';
import { evaluateShotDramaturgy } from './dramaturgy-gate';
import { canResumeDirectorPhase, invalidateDirectorPhase } from './phase-checkpoint';
import { validateFrameExactRenderContract, verifyPureSeekSamples } from './render-determinism';
import { evaluateSceneEmotionEvidence } from './emotion-storyboard-evidence';
import { validateCreativeExperiment } from './creative-experiment';
import { validateEditingTechniquePlan } from './editing-technique-spec';

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

    const malformed = evaluateVisualEditEvidence({
      editKind: 'overlay',
      startSeconds: 2,
      endSeconds: 4,
      timebase: { fps: 30, durationSeconds: 10, width: 1920, height: 1080 },
      observations: [{
        ...observation,
        id: 'obs-malformed',
        protectedRegions: [{
          ...observation.protectedRegions[0],
          bounds: { x: 0.9, y: 0.2, width: 0.4, height: 0.2 },
        }],
      }],
    });
    expect(malformed.admissible).toBe(false);
    expect(malformed.reasons).toContain('DIRECTOR_VISUAL_REGION_INVALID');
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
    expect(decision.reasons).toContain('DIRECTOR_REVIEW_FAMILY_QUORUM_NOT_MET');
    expect(decision.excludedReviewIds).toContain('r-self');
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
  it('requires frame-exact duration and detects hidden mutable render state', () => {
    expect(validateFrameExactRenderContract({
      fps: 30, width: 1920, height: 1080, durationSeconds: 2, pureSeekRequired: true,
    })).toMatchObject({ deterministic: true, frameCount: 60 });

    expect(validateFrameExactRenderContract({
      fps: 30, width: 1920, height: 1080, durationSeconds: 2.05, pureSeekRequired: true,
    }).reasons).toContain('DIRECTOR_RENDER_DURATION_NOT_FRAME_EXACT');

    expect(verifyPureSeekSamples([
      { timeSeconds: 1, frameSha256: 'frame-a' },
      { timeSeconds: 2, frameSha256: 'frame-b' },
      { timeSeconds: 1, frameSha256: 'frame-changed' },
    ]).reasons).toContain('DIRECTOR_RENDER_HIDDEN_STATE_DETECTED');
  });

  it('keeps emotion classification advisory and rejects fallback labels as creative truth', () => {
    const fallback = evaluateSceneEmotionEvidence({
      id: 'emotion-1',
      projectId: 'p',
      sceneId: 'scene-1',
      label: 'neutral',
      confidence: 1,
      provider: 'classifier',
      status: 'fallback',
      evidenceRefs: ['classifier-unavailable'],
      limitations: ['model unavailable'],
      observedAt: '2026-09-22T00:00:00Z',
    });
    expect(fallback.usableAsAdvisoryEvidence).toBe(false);
    expect(fallback.authority).toBe('ADVISORY_ONLY');
    expect(fallback.reasons).toContain('DIRECTOR_EMOTION_NOT_OBSERVED');

    const observed = evaluateSceneEmotionEvidence({
      id: 'emotion-2',
      projectId: 'p',
      sceneId: 'scene-1',
      label: 'tension',
      confidence: 0.87,
      provider: 'classifier',
      modelId: 'emotion-model-v1',
      status: 'observed',
      evidenceRefs: ['scene-text:1'],
      limitations: [],
      observedAt: '2026-09-22T00:00:01Z',
    });
    expect(observed.usableAsAdvisoryEvidence).toBe(true);
  });

  it('preserves creative variants and requires an explicit selection receipt', () => {
    const experiment = {
      id: 'exp-1',
      projectId: 'p',
      hypothesis: 'A hand-drawn treatment carries the intended emotional contrast better than photorealism',
      variable: 'visual-style',
      status: 'completed' as const,
      variants: [
        { id: 'photo', label: 'photoreal', artifactIds: ['a1'], generationAttemptIds: ['g1'] },
        { id: 'drawn', label: 'hand-drawn', artifactIds: ['a2'], generationAttemptIds: ['g2', 'g3'] },
      ],
      evidenceRefs: ['review:1'],
      selectedVariantId: 'drawn',
    };
    expect(validateCreativeExperiment(experiment).reasons).toContain('DIRECTOR_EXPERIMENT_SELECTION_RECEIPT_REQUIRED');
    expect(validateCreativeExperiment({
      ...experiment,
      selectedBy: 'user-1',
      selectedAt: '2026-09-22T00:00:00Z',
    }).valid).toBe(true);
  });
  it('keeps editing technique knowledge provider-neutral and proposal-only', () => {
    const spec = {
      id: 'match-cut:v1',
      kind: 'match-cut' as const,
      purpose: 'preserve a visual action or composition across a cut',
      requiredEvidenceKinds: ['visual-observation'],
      requiredCapabilities: ['timeline.transition'],
      parameters: [
        { key: 'overlapSeconds', type: 'number' as const, required: false, minimum: 0, maximum: 1 },
      ],
      qcChecks: ['composition-continuity', 'subject-visibility'],
      reversible: true,
    };
    const plan = {
      id: 'tech-plan-1',
      specId: spec.id,
      projectId: 'p',
      timelineVersionId: 'timeline-v4',
      sourceClipIds: ['clip-a', 'clip-b'],
      parameters: { overlapSeconds: 0.25 },
      evidenceIds: ['visual:1'],
      authority: 'PROPOSAL_ONLY' as const,
    };
    expect(validateEditingTechniquePlan(spec, plan).valid).toBe(true);
    expect(validateEditingTechniquePlan(spec, {
      ...plan,
      evidenceIds: [],
      parameters: { overlapSeconds: 2 },
    }).reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_TECHNIQUE_EVIDENCE_REQUIRED',
      'DIRECTOR_TECHNIQUE_PARAMETER_MAX:overlapSeconds',
    ]));
  });
});
