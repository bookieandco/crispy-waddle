import { describe, expect, it } from 'vitest';
import {
  chooseBestCharacterReference,
  planCharacterReferenceBootstrap,
} from './character-reference-bootstrap';
import {
  chooseBestGeneratedExtension,
  planClipExtension,
  validateGenerativeExtendRequest,
} from './generative-extend';
import type { TimelineClip } from './timeline-model';

describe('reference-character bootstrap and generative extension', () => {
  it('can bootstrap a reusable character identity from one uploaded reference', () => {
    const plan = planCharacterReferenceBootstrap({
      id: 'bootstrap-1',
      projectId: 'movie-1',
      characterId: 'ela',
      displayName: 'Ela',
      archetype: 'cartoon',
      uploads: [{
        id: 'upload-1',
        assetId: 'ela-source',
        sha256: 'sha-source',
        width: 1024,
        height: 1024,
        view: 'full-body',
        rightsRef: 'rights:client-provided',
        evidenceIds: ['upload-admission:1'],
      }],
      requestedAppearanceLabels: ['beekeeping-suit', 'night-lighting'],
      buildMotionProbes: true,
      commercialUse: true,
    });

    expect(plan.characterId).toBe('ela');
    expect(plan.continuityRef).toBe('character:ela:v1');
    expect(plan.canonicalUploadId).toBe('upload-1');
    expect(plan.stages).toEqual(expect.arrayContaining([
      'neutral-anchor',
      'multi-angle',
      'expression-sheet',
      'appearance-variants',
      'motion-probes',
      'qa',
      'lock',
    ]));
  });

  it('keeps the best identity-preserving derived reference instead of the prettiest drifter', () => {
    const policy = {
      minimumIdentityScore: 0.85,
      minimumStyleScore: 0.75,
      minimumAnatomyScore: 0.8,
      minimumQualityScore: 0.75,
    };
    const best = chooseBestCharacterReference([
      {
        id: 'drifted',
        projectId: 'movie-1',
        characterId: 'ela',
        parentReferenceAssetIds: ['ela-source'],
        assetId: 'ela-angle-a',
        sha256: 'sha-a',
        kind: 'angle',
        view: 'three-quarter-left',
        identityScore: 0.7,
        styleScore: 0.98,
        anatomyScore: 0.95,
        qualityScore: 0.98,
        evidenceIds: ['qa:a'],
        generationAttemptId: 'attempt-a',
      },
      {
        id: 'consistent',
        projectId: 'movie-1',
        characterId: 'ela',
        parentReferenceAssetIds: ['ela-source'],
        assetId: 'ela-angle-b',
        sha256: 'sha-b',
        kind: 'angle',
        view: 'three-quarter-left',
        identityScore: 0.95,
        styleScore: 0.9,
        anatomyScore: 0.92,
        qualityScore: 0.9,
        evidenceIds: ['qa:b'],
        generationAttemptId: 'attempt-b',
      },
    ], policy);

    expect(best?.id).toBe('consistent');
  });

  it('uses real source handles before requesting AI-generated frames', () => {
    const clip: TimelineClip = {
      id: 'clip-1',
      assetId: 'asset-1',
      trackId: 'video-1',
      startSeconds: 10,
      durationSeconds: 5,
      sourceInSeconds: 2,
      sourceOutSeconds: 7,
      sourceDurationSeconds: 10,
      effects: [],
      generativeRegions: [],
    };

    expect(planClipExtension(clip, { side: 'end', seconds: 2 })).toEqual({
      mode: 'source-handle',
      seconds: 2,
      side: 'end',
    });

    expect(planClipExtension(clip, { side: 'end', seconds: 5 })).toEqual({
      mode: 'generative-proposal',
      sourceHandleSeconds: 3,
      generatedSeconds: 2,
      side: 'end',
    });
  });

  it('refuses to invent dialogue or music when extending audio', () => {
    const policy = {
      maximumVideoSeconds: 4,
      maximumAudioSeconds: 10,
      minimumSourceContextSeconds: 1,
      allowDialogueExtension: false as const,
      allowMusicExtension: false as const,
      requireDeterministicSeedForLocalProvider: false,
    };

    expect(validateGenerativeExtendRequest({
      id: 'extend-dialogue',
      projectId: 'movie-1',
      timelineVersionId: 'timeline-v7',
      clipId: 'dialogue-clip',
      sourceAssetId: 'dialogue-audio',
      sourceSha256: 'dialogue-sha',
      mediaKind: 'audio',
      side: 'end',
      requestedSeconds: 2,
      sourceContextSeconds: 3,
      audioContent: 'dialogue',
      evidenceIds: ['audio-classification:dialogue'],
    }, policy).reasons).toContain('DIRECTOR_EXTEND_DIALOGUE_FORBIDDEN');

    expect(validateGenerativeExtendRequest({
      id: 'extend-room',
      projectId: 'movie-1',
      timelineVersionId: 'timeline-v7',
      clipId: 'room-clip',
      sourceAssetId: 'room-audio',
      sourceSha256: 'room-sha',
      mediaKind: 'audio',
      side: 'end',
      requestedSeconds: 4,
      sourceContextSeconds: 3,
      audioContent: 'room-tone',
      evidenceIds: ['audio-classification:room-tone'],
    }, policy).admissible).toBe(true);
  });

  it('selects the best AI extension only after continuity and artifact QC', () => {
    const request = {
      id: 'extend-video-1',
      projectId: 'movie-1',
      timelineVersionId: 'timeline-v7',
      clipId: 'shot-9',
      sourceAssetId: 'shot-9-source',
      sourceSha256: 'source-sha',
      mediaKind: 'video' as const,
      side: 'end' as const,
      requestedSeconds: 2,
      sourceContextSeconds: 2,
      evidenceIds: ['motion-track:9', 'character-lock:ela'],
    };
    const policy = {
      durationToleranceSeconds: 1 / 30,
      minimumQualityScore: 0.8,
      minimumContinuityScore: 0.85,
      maximumArtifactScore: 0.2,
    };

    const selected = chooseBestGeneratedExtension(request, [
      {
        id: 'candidate-1',
        requestId: request.id,
        provider: 'video-provider',
        modelId: 'model-v1',
        assetId: 'extension-a',
        sha256: 'sha-a',
        durationSeconds: 2,
        generatedRange: { startSeconds: 5, endSeconds: 7 },
        candidateIndex: 0,
        attemptId: 'attempt-1',
        qualityScore: 0.97,
        continuityScore: 0.72,
        artifactScore: 0.05,
        evidenceIds: ['qc:a'],
        provenanceRefs: ['provider:a'],
        label: 'AI-generated' as const,
      },
      {
        id: 'candidate-2',
        requestId: request.id,
        provider: 'video-provider',
        modelId: 'model-v1',
        assetId: 'extension-b',
        sha256: 'sha-b',
        durationSeconds: 2,
        generatedRange: { startSeconds: 5, endSeconds: 7 },
        candidateIndex: 1,
        attemptId: 'attempt-2',
        qualityScore: 0.91,
        continuityScore: 0.96,
        artifactScore: 0.06,
        evidenceIds: ['qc:b'],
        provenanceRefs: ['provider:b'],
        label: 'AI-generated' as const,
      },
    ], policy);

    expect(selected?.id).toBe('candidate-2');
  });
});
