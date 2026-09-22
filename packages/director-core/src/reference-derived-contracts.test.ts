import { describe, expect, it } from 'vitest';
import { evaluateVisualEditEvidence, overlayAvoidsProtectedRegions } from './visual-observation-evidence';
import { decideCreativeReviewPanel } from './creative-review-panel';
import { evaluateShotDramaturgy } from './dramaturgy-gate';
import { canResumeDirectorPhase, invalidateDirectorPhase } from './phase-checkpoint';
import { validateFrameExactRenderContract, verifyPureSeekSamples } from './render-determinism';
import { evaluateSceneEmotionEvidence } from './emotion-storyboard-evidence';
import { validateCreativeExperiment } from './creative-experiment';
import { validateEditingTechniquePlan } from './editing-technique-spec';
import { decideRoughCutPlacement } from './rough-cut-evidence';
import { validateTimelineProposalSelection } from './timeline-edit-proposal';
import { validateAnimationPerformanceState } from './animation-performance-state';
import { objectDetectionsToVisualEvidence } from './object-detection-observation';
import { ROBOFLOW_CARTOON_56LLR_V11, visionModelAllowsClass } from './vision-model-profile';
import { validateShortFormProductionSpec } from './short-form-production';
import { validateLockedCharacterShot } from './locked-character-reference';
import { authorizeGenerationSpend } from './generation-spend-gate';

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
  it('preserves ambiguous and repeated rough-cut takes instead of guessing', () => {
    const decision = decideRoughCutPlacement(
      [
        { id: 'step-1', order: 1, text: 'Open the cover' },
        { id: 'step-2', order: 2, text: 'Remove the module' },
      ],
      [
        {
          id: 'take-1a',
          assetId: 'asset-a',
          sourceStartSeconds: 0,
          sourceEndSeconds: 5,
          stepId: 'step-1',
          confidence: 0.9,
          kinds: ['spoken-step-label'],
          evidenceRefs: ['transcript:a'],
          repeatedTakeGroupId: 'step-1-takes',
        },
        {
          id: 'take-1b',
          assetId: 'asset-b',
          sourceStartSeconds: 1,
          sourceEndSeconds: 6,
          stepId: 'step-1',
          confidence: 0.88,
          kinds: ['manual-label'],
          evidenceRefs: ['marker:b'],
          repeatedTakeGroupId: 'step-1-takes',
        },
        {
          id: 'take-unknown',
          assetId: 'asset-c',
          sourceStartSeconds: 0,
          sourceEndSeconds: 4,
          stepId: 'step-2',
          confidence: 0.99,
          kinds: ['procedure-order'],
          evidenceRefs: ['recording-order:c'],
        },
      ],
    );
    expect(decision.placements.map((item) => item.takeId)).toEqual(['take-1a', 'take-1b']);
    expect(decision.reviewQueue.map((item) => item.takeId)).toContain('take-unknown');
    expect(decision.missingStepIds).toContain('step-2');
  });

  it('requires ghost edit proposals to match the exact timeline snapshot and dependency closure', () => {
    const proposal = {
      id: 'proposal-1',
      projectId: 'p',
      baseTimelineVersionId: 'timeline-v2',
      baseSnapshotHash: 'hash-v2',
      status: 'ready' as const,
      createdBy: 'jhadina' as const,
      authority: 'PROPOSAL_ONLY' as const,
      changes: [
        {
          id: 'cut-a',
          command: { type: 'delete', clipId: 'clip-a' } as any,
          dependsOn: [],
          evidenceIds: ['silence:a'],
          previewArtifactIds: ['preview:a'],
          explanation: 'Remove confirmed dead air',
        },
        {
          id: 'transition-b',
          command: { type: 'transition', transition: { id: 't', fromClipId: 'clip-b', toClipId: 'clip-c', type: 'crossfade', durationSeconds: 0.2 } } as any,
          dependsOn: ['cut-a'],
          evidenceIds: ['continuity:b'],
          previewArtifactIds: ['preview:b'],
          explanation: 'Repair continuity after cut',
        },
      ],
    };

    expect(validateTimelineProposalSelection(proposal, {
      currentTimelineVersionId: 'timeline-v2',
      currentSnapshotHash: 'hash-v2',
      selectedChangeIds: ['transition-b'],
    }).reasons).toContain('DIRECTOR_TIMELINE_PROPOSAL_DEPENDENCY_REQUIRED:transition-b:cut-a');

    expect(validateTimelineProposalSelection(proposal, {
      currentTimelineVersionId: 'timeline-v3',
      currentSnapshotHash: 'hash-v3',
      selectedChangeIds: ['cut-a', 'transition-b'],
    }).reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_TIMELINE_PROPOSAL_BASE_VERSION_STALE',
      'DIRECTOR_TIMELINE_PROPOSAL_BASE_HASH_STALE',
    ]));

    expect(validateTimelineProposalSelection(proposal, {
      currentTimelineVersionId: 'timeline-v2',
      currentSnapshotHash: 'hash-v2',
      selectedChangeIds: ['cut-a', 'transition-b'],
    }).valid).toBe(true);
  });

  it('keeps animation state frame-exact so blink or gesture changes cannot lengthen the movie', () => {
    const valid = validateAnimationPerformanceState({
      id: 'anim-state-1',
      projectId: 'p',
      fps: 24,
      frameCount: 48,
      audioDurationSeconds: 2,
      runs: [
        {
          id: 'run-a',
          frameStart: 0,
          frameEndExclusive: 24,
          characterAssetId: 'char-1',
          expression: 'neutral',
          viseme: 'X',
          evidenceIds: ['word:a'],
        },
        {
          id: 'run-b',
          frameStart: 24,
          frameEndExclusive: 48,
          characterAssetId: 'char-1',
          expression: 'smile',
          viseme: 'A',
          evidenceIds: ['word:b'],
        },
      ],
    });
    expect(valid.valid).toBe(true);

    const drifted = validateAnimationPerformanceState({
      id: 'anim-state-2',
      projectId: 'p',
      fps: 24,
      frameCount: 48,
      audioDurationSeconds: 2,
      runs: [
        {
          id: 'run-a',
          frameStart: 0,
          frameEndExclusive: 24,
          characterAssetId: 'char-1',
          evidenceIds: ['word:a'],
        },
        {
          id: 'blink-inserted',
          frameStart: 24,
          frameEndExclusive: 27,
          characterAssetId: 'char-1',
          eyes: 'blink',
          evidenceIds: ['blink:1'],
        },
        {
          id: 'run-b',
          frameStart: 27,
          frameEndExclusive: 51,
          characterAssetId: 'char-1',
          evidenceIds: ['word:b'],
        },
      ],
    });
    expect(drifted.valid).toBe(false);
    expect(drifted.reasons).toContain('DIRECTOR_ANIMATION_DURATION_DRIFT');
  });

  it('maps admitted object detections into normalized one-frame visual evidence', () => {
    const evidence = objectDetectionsToVisualEvidence({
      id: 'rf-1',
      projectId: 'p',
      assetId: 'frame-asset',
      provider: 'roboflow-serverless',
      modelId: ROBOFLOW_CARTOON_56LLR_V11.modelId,
      observedAt: '2026-09-22T00:00:00Z',
      frame: 30,
      fps: 30,
      imageWidth: 1000,
      imageHeight: 500,
      predictions: [
        { className: 'mickey', confidence: 0.9, x: 500, y: 250, width: 200, height: 100 },
        { className: 'unknown', confidence: 0.99, x: 100, y: 100, width: 50, height: 50 },
      ],
      allowedClasses: ROBOFLOW_CARTOON_56LLR_V11.classes,
      evidenceRefs: ['roboflow-response:sha256'],
    });
    expect(visionModelAllowsClass(ROBOFLOW_CARTOON_56LLR_V11, 'mickey')).toBe(true);
    expect(visionModelAllowsClass(ROBOFLOW_CARTOON_56LLR_V11, 'unknown')).toBe(false);
    expect(evidence.frameStart).toBe(30);
    expect(evidence.frameEnd).toBe(31);
    expect(evidence.protectedRegions).toHaveLength(1);
    expect(evidence.protectedRegions[0]).toMatchObject({
      startSeconds: 1,
      endSeconds: 31 / 30,
      bounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    });
  });
  it('validates short-form timing and safe-region contracts without hard-coding one beat grammar', () => {
    const spec = {
      id: 'short-1',
      projectId: 'p',
      width: 1080,
      height: 1920,
      fps: 30,
      durationSeconds: 40,
      beats: [
        { id: 'hook', kind: 'hook' as const, startSeconds: 0, endSeconds: 3, intent: 'show payoff immediately', evidenceIds: ['idea:1'] },
        { id: 'setup', kind: 'setup' as const, startSeconds: 3, endSeconds: 12, intent: 'establish problem', evidenceIds: ['script:1'] },
        { id: 'reveal', kind: 'reveal' as const, startSeconds: 12, endSeconds: 34, intent: 'deliver explanation', evidenceIds: ['script:2'] },
        { id: 'loop', kind: 'loop' as const, startSeconds: 34, endSeconds: 40, intent: 'return to opening state', evidenceIds: ['loop:1'] },
      ],
      reservedRegions: [
        { id: 'platform-right', purpose: 'platform-ui' as const, x: 0.85, y: 0, width: 0.15, height: 1 },
        { id: 'platform-bottom', purpose: 'platform-ui' as const, x: 0, y: 0.82, width: 1, height: 0.18 },
      ],
      frameZeroRole: 'thumbnail-candidate' as const,
      loopMode: 'exact-frame-loop' as const,
    };
    expect(validateShortFormProductionSpec(spec).valid).toBe(true);
    expect(validateShortFormProductionSpec({
      ...spec,
      reservedRegions: [{ id: 'bad', purpose: 'custom' as const, x: 0.9, y: 0, width: 0.2, height: 1 }],
    }).reasons).toContain('DIRECTOR_SHORT_SAFE_REGION_INVALID:bad');
  });

  it('forbids re-inventing a locked recurring character from text', () => {
    const lock = {
      id: 'lock-1',
      projectId: 'p',
      characterId: 'blue-man',
      referenceAssetId: 'character-ref',
      referenceSha256: 'sha256-ref',
      continuityRef: 'continuity:blue-man:v1',
      approvedAt: '2026-09-22T00:00:00Z',
      approvedBy: 'user-1',
    };
    expect(validateLockedCharacterShot(lock, {
      id: 'shot-1',
      projectId: 'p',
      characterId: 'blue-man',
      continuityRef: 'continuity:blue-man:v1',
      referenceAssetIds: ['character-ref', 'scene-ref'],
      generationMode: 'image-to-video',
    }).valid).toBe(true);

    expect(validateLockedCharacterShot(lock, {
      id: 'shot-2',
      projectId: 'p',
      characterId: 'blue-man',
      continuityRef: 'continuity:blue-man:v1',
      referenceAssetIds: [],
      generationMode: 'text-only',
    }).reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_CHARACTER_TEXT_ONLY_REGEN_FORBIDDEN',
      'DIRECTOR_CHARACTER_LOCKED_REFERENCE_REQUIRED',
    ]));
  });

  it('requires a traceable generation estimate and explicit spend ceiling before paid generation', () => {
    const estimate = {
      id: 'cost-1',
      projectId: 'p',
      provider: 'video-provider',
      modelId: 'video-model-v1',
      pricingUnit: 'per-second' as const,
      pricingSourceRef: 'provider-pricing-snapshot:2026-09-22',
      quantity: 10,
      unitPriceUsd: 0.05,
      estimatedCostUsd: 0.5,
      derivedAt: '2026-09-22T00:00:00Z',
      assumptions: ['audio disabled'],
    };
    expect(authorizeGenerationSpend(estimate, undefined).reasons).toContain('DIRECTOR_COST_AUTHORIZATION_REQUIRED');
    expect(authorizeGenerationSpend(estimate, {
      estimateId: 'cost-1',
      approvedMaximumUsd: 0.4,
      approvedBy: 'user-1',
      approvedAt: '2026-09-22T00:00:01Z',
    }).reasons).toContain('DIRECTOR_COST_BUDGET_EXCEEDED');
    expect(authorizeGenerationSpend(estimate, {
      estimateId: 'cost-1',
      approvedMaximumUsd: 1,
      approvedBy: 'user-1',
      approvedAt: '2026-09-22T00:00:01Z',
    }).authorized).toBe(true);
  });
});
