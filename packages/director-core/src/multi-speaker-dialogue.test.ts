import { describe, expect, it } from 'vitest';
import {
  chooseBestMultiSpeakerSceneCandidate,
  evaluateMultiSpeakerSceneCandidate,
  lineToDialogueGenerationRequest,
  validateMultiSpeakerDialogueSceneRequest,
} from './multi-speaker-dialogue';

const policy = {
  maximumBatchSize: 20,
  minimumSceneNaturalness: 0.8,
  minimumTurnTakingScore: 0.8,
  minimumTimingScore: 0.8,
  requirePerLineVoiceEvidence: true,
  requireWordTimingEvidence: true,
};

const request = {
  id: 'scene-dialogue-12',
  projectId: 'movie-1',
  sceneId: 'scene-12',
  batchSize: 4,
  seed: 42,
  evidenceIds: ['script:scene-12'],
  lines: [
    {
      id: 'line-1',
      sceneId: 'scene-12',
      order: 0,
      characterId: 'hero',
      voiceIdentityId: 'voice-hero',
      voiceVariantId: 'voice-hero-en',
      language: 'en',
      text: 'We need to leave now.',
      evidenceIds: ['script:line-1'],
    },
    {
      id: 'line-2',
      sceneId: 'scene-12',
      order: 1,
      characterId: 'friend',
      voiceIdentityId: 'voice-friend',
      voiceVariantId: 'voice-friend-en',
      language: 'en',
      text: 'I am right behind you.',
      evidenceIds: ['script:line-2'],
    },
  ],
};

function candidate(id: string, naturalness: number) {
  return {
    id,
    requestId: request.id,
    providerId: 'vibevoice-fusion',
    providerJobId: `provider-${id}`,
    seed: id === 'take-a' ? 42 : 43,
    audioAssetId: `audio-${id}`,
    audioSha256: `sha-${id}`,
    sampleRateHz: 48000,
    durationSeconds: 4,
    dialogueArtifacts: [
      {
        id: `${id}:line-1`,
        requestId: `${request.id}:line-1`,
        projectId: 'movie-1',
        characterId: 'hero',
        voiceIdentityId: 'voice-hero',
        voiceVariantId: 'voice-hero-en',
        providerBindingId: 'vibevoice',
        audioAssetId: `${id}:hero`,
        audioSha256: 'sha-hero',
        language: 'en',
        sampleRateHz: 48000,
        durationSeconds: 2,
        speakerSimilarity: 0.92,
        intelligibilityScore: 0.96,
        evidenceIds: ['voice-qc:hero'],
        lineId: 'line-1',
      },
      {
        id: `${id}:line-2`,
        requestId: `${request.id}:line-2`,
        projectId: 'movie-1',
        characterId: 'friend',
        voiceIdentityId: 'voice-friend',
        voiceVariantId: 'voice-friend-en',
        providerBindingId: 'vibevoice',
        audioAssetId: `${id}:friend`,
        audioSha256: 'sha-friend',
        language: 'en',
        sampleRateHz: 48000,
        durationSeconds: 2,
        speakerSimilarity: 0.91,
        intelligibilityScore: 0.95,
        evidenceIds: ['voice-qc:friend'],
        lineId: 'line-2',
      },
    ],
    sceneNaturalnessScore: naturalness,
    turnTakingScore: 0.94,
    timingScore: 0.91,
    crosstalkDetected: false,
    clippingDetected: false,
    wordTimingEvidenceIds: ['timing:scene-12'],
    evidenceIds: ['scene-qc:12'],
    provenanceRefs: ['provider:vibevoice-fusion'],
  };
}

describe('multi-speaker dialogue scenes', () => {
  it('keeps canonical character and voice identity for every line', () => {
    expect(validateMultiSpeakerDialogueSceneRequest(request, policy)).toEqual([]);
    expect(lineToDialogueGenerationRequest(request, request.lines[0])).toMatchObject({
      characterId: 'hero',
      voiceIdentityId: 'voice-hero',
      sceneId: 'scene-12',
      lineId: 'line-1',
    });
    expect(evaluateMultiSpeakerSceneCandidate(request, candidate('take-a', 0.9), policy).admissible).toBe(true);
  });

  it('rejects speaker drift even if the scene sounds good', () => {
    const drifted = candidate('take-drift', 0.98);
    drifted.dialogueArtifacts[1] = {
      ...drifted.dialogueArtifacts[1],
      voiceIdentityId: 'voice-wrong',
    };
    expect(evaluateMultiSpeakerSceneCandidate(request, drifted, policy).reasons)
      .toContain('DIRECTOR_MULTI_SPEAKER_VOICE_DRIFT:line-2');
  });

  it('selects the best admitted seeded scene variation', () => {
    const selection = chooseBestMultiSpeakerSceneCandidate(request, [
      candidate('take-a', 0.86),
      candidate('take-b', 0.95),
    ], policy);
    expect(selection.selectedCandidateId).toBe('take-b');
    expect(selection.authority).toBe('DIRECTOR_SELECTION');
  });
});
