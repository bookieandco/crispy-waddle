import { describe, expect, it } from 'vitest';
import { validateCharacterSceneBinding, validateMovieGradeCastRecord } from './cast-bible';
import { DIRECTOR_VOICE_PROVIDER_PROFILES, resolveDialogueVoice, validateGeneratedDialogueVoice, validateMovieGradeVoiceIdentity } from './voice-identity';
import { validateMovieAudioBible, validateMovieGradeAudioBible } from './movie-audio-bible';
import { evaluateCharacterIdentityContinuity } from './character-identity-qc';
import { LONG_FORM_TAKE_POLICY, rankMultimodalTakes, withCharacterIdentityQc } from './multimodal-take-selection';

describe('Director cast and voice continuity', () => {
  const cast = {
    id: 'cast-1',
    projectId: 'movie-1',
    characterId: 'hero',
    displayName: 'Hero',
    archetype: 'human' as const,
    continuityRef: 'character:hero:v1',
    canonicalAppearanceVariantId: 'hero-base',
    appearanceVariants: [
      {
        id: 'hero-base',
        characterId: 'hero',
        kind: 'base' as const,
        label: 'Base',
        referenceAssetIds: ['hero-ref-base'],
        referenceSha256s: ['sha-base'],
        approvedAt: '2026-09-22T00:00:00Z',
        approvedBy: 'user-1',
      },
      {
        id: 'hero-suit',
        characterId: 'hero',
        kind: 'wardrobe' as const,
        label: 'Suit',
        referenceAssetIds: ['hero-ref-suit'],
        referenceSha256s: ['sha-suit'],
        wardrobeNotes: ['black suit'],
        approvedAt: '2026-09-22T00:00:00Z',
        approvedBy: 'user-1',
      },
    ],
    voice: {
      voiceIdentityId: 'voice-hero',
      primaryLanguage: 'en',
      defaultVariantId: 'voice-hero-en',
    },
    lockedTraits: ['brown eyes', 'scar over left eyebrow'],
    identityFingerprintRefs: ['identity:hero:face:v1', 'identity:hero:body:v1'],
    approvedAt: '2026-09-22T00:00:00Z',
    approvedBy: 'user-1',
  };

  it('allows outfit changes without changing canonical character identity', () => {
    expect(validateCharacterSceneBinding(cast, {
      projectId: 'movie-1',
      characterId: 'hero',
      continuityRef: 'character:hero:v1',
      appearanceVariantId: 'hero-suit',
      voiceIdentityId: 'voice-hero',
      voiceVariantId: 'voice-hero-en',
      language: 'en',
      referenceAssetIds: ['hero-ref-base', 'hero-ref-suit'],
    }).valid).toBe(true);
  });

  it('rejects an unapproved look-alike reference as character drift', () => {
    expect(validateCharacterSceneBinding(cast, {
      projectId: 'movie-1',
      characterId: 'hero',
      continuityRef: 'character:hero:v1',
      appearanceVariantId: 'hero-suit',
      referenceAssetIds: ['random-lookalike'],
    }).reasons).toContain('DIRECTOR_CAST_APPROVED_APPEARANCE_REFERENCE_REQUIRED');
  });

  it('keeps one voice identity across languages while allowing language-specific providers', () => {
    const identity = {
      id: 'voice-hero',
      projectId: 'movie-1',
      characterId: 'hero',
      displayName: 'Hero voice',
      source: 'consented-clone' as const,
      consentRef: 'consent:hero',
      primaryLanguage: 'en',
      referenceSamples: [{
        id: 'sample-1',
        assetId: 'voice-sample',
        sha256: 'voice-sha',
        language: 'en',
        transcript: 'Reference line',
        durationSeconds: 8,
        rightsRef: 'rights:owned',
        qualityEvidenceIds: ['voice-qc:1'],
      }],
      providerBindings: [
        {
          id: 'qwen',
          provider: 'qwen3-tts',
          modelId: 'Qwen3-TTS',
          referenceSampleIds: ['sample-1'],
          supportedLanguages: ['en','es','fr','de','it','pt','ja','ko','zh','ru'],
          sampleRateHz: 24000,
          provenanceRefs: ['ref:qwen3-tts'],
        },
        {
          id: 'voxcpm',
          provider: 'voxcpm2',
          modelId: 'VoxCPM2',
          referenceSampleIds: ['sample-1'],
          supportedLanguages: ['en','es','fr','de','it','pt','ja','ko','zh','ru','ar','hi','sw','tr'],
          sampleRateHz: 48000,
          provenanceRefs: ['ref:voxcpm2'],
        },
      ],
      languageVariants: [
        { id: 'voice-hero-en', voiceIdentityId: 'voice-hero', language: 'en', accentPolicy: 'preserve-identity' as const, providerBindingIds: ['qwen','voxcpm'] },
        { id: 'voice-hero-es', voiceIdentityId: 'voice-hero', language: 'es', accentPolicy: 'native-target' as const, providerBindingIds: ['qwen','voxcpm'] },
      ],
      defaultVariantId: 'voice-hero-en',
      speakerFingerprintRefs: ['speaker:hero:v1'],
      minimumSpeakerSimilarity: 0.82,
      approvedAt: '2026-09-22T00:00:00Z',
      approvedBy: 'user-1',
    };

    const result = resolveDialogueVoice(identity, {
      id: 'line-1',
      projectId: 'movie-1',
      characterId: 'hero',
      voiceIdentityId: 'voice-hero',
      voiceVariantId: 'voice-hero-es',
      language: 'es',
      text: 'Tenemos que salir ahora.',
      sceneId: 'scene-12',
      lineId: 'line-12-4',
      evidenceIds: ['script:scene-12'],
    });
    expect(result.valid).toBe(true);
    expect(result.providerBindings.map((item) => item.id)).toEqual(['qwen','voxcpm']);
  });

  it('keeps score cues attached to canonical themes and evidence', () => {
    expect(validateMovieAudioBible({
      projectId: 'movie-1',
      scoreThemes: [{
        id: 'theme-hero',
        projectId: 'movie-1',
        name: 'Hero motif',
        stemAssetIds: ['strings','piano'],
        instrumentation: ['strings','piano'],
      }],
      sceneCues: [{
        id: 'cue-1',
        sceneId: 'scene-12',
        themeId: 'theme-hero',
        startSeconds: 0,
        endSeconds: 35,
        intensity: 0.7,
        dialoguePriority: true,
        evidenceIds: ['scene:12:dramaturgy'],
      }],
      dialogueLoudnessTargetLufs: -16,
      musicLoudnessTargetLufs: -24,
      foleyLoudnessTargetLufs: -22,
      finalPeakDbfs: -1,
    })).toEqual([]);
  });
  it('requires movie-grade cast identity fingerprints even when wardrobe changes are valid', () => {
    expect(validateMovieGradeCastRecord(cast)).toEqual([]);
    expect(validateMovieGradeCastRecord({
      ...cast,
      identityFingerprintRefs: [],
    })).toContain('DIRECTOR_CAST_IDENTITY_FINGERPRINT_REQUIRED');
  });

  it('separates visual identity continuity from intended outfit similarity', () => {
    const result = evaluateCharacterIdentityContinuity({
      projectId: 'movie-1',
      characterId: 'hero',
      takeId: 'take-suit',
      expectedFingerprintRefs: ['identity:hero:face:v1'],
      expectedAppearanceVariantId: 'hero-suit',
      frameStart: 0,
      frameEnd: 89,
      observations: [{
        id: 'obs-hero',
        projectId: 'movie-1',
        characterId: 'hero',
        takeId: 'take-suit',
        frameStart: 0,
        frameEnd: 89,
        identitySimilarity: 0.94,
        identityFingerprintRefs: ['identity:hero:face:v1'],
        appearanceVariantId: 'hero-suit',
        appearanceSimilarity: 0.88,
        evidenceIds: ['vision:hero:take-suit'],
        limitations: [],
      }],
    }, {
      minimumIdentitySimilarity: 0.85,
      minimumObservationCoverage: 0.8,
      minimumAppearanceSimilarity: 0.75,
    });
    expect(result.admissible).toBe(true);

    const drift = evaluateCharacterIdentityContinuity({
      projectId: 'movie-1',
      characterId: 'hero',
      takeId: 'take-bad',
      expectedFingerprintRefs: ['identity:hero:face:v1'],
      expectedAppearanceVariantId: 'hero-suit',
      frameStart: 0,
      frameEnd: 89,
      observations: [{
        id: 'obs-drift',
        projectId: 'movie-1',
        characterId: 'hero',
        takeId: 'take-bad',
        frameStart: 0,
        frameEnd: 89,
        identitySimilarity: 0.61,
        identityFingerprintRefs: ['identity:hero:face:v1'],
        appearanceVariantId: 'hero-suit',
        appearanceSimilarity: 0.91,
        evidenceIds: ['vision:hero:take-bad'],
        limitations: [],
      }],
    }, {
      minimumIdentitySimilarity: 0.85,
      minimumObservationCoverage: 0.8,
      minimumAppearanceSimilarity: 0.75,
    });
    expect(drift.admissible).toBe(false);
    expect(drift.reasons).toContain('DIRECTOR_CHARACTER_IDENTITY_DRIFT');
    expect(drift.reasons).not.toContain('DIRECTOR_CHARACTER_APPEARANCE_VARIANT_DRIFT');
  });

  it('rejects a translated line that no longer sounds like the same character', () => {
    const identity = {
      id: 'voice-hero',
      projectId: 'movie-1',
      characterId: 'hero',
      displayName: 'Hero voice',
      source: 'consented-clone' as const,
      consentRef: 'consent:hero',
      primaryLanguage: 'en',
      referenceSamples: [{
        id: 'sample-1',
        assetId: 'voice-sample',
        sha256: 'voice-sha',
        language: 'en',
        transcript: 'Reference line',
        durationSeconds: 8,
        rightsRef: 'rights:owned',
        qualityEvidenceIds: ['voice-qc:1'],
      }],
      providerBindings: [{
        id: 'voxcpm',
        provider: 'voxcpm2',
        modelId: 'VoxCPM2',
        referenceSampleIds: ['sample-1'],
        supportedLanguages: ['en','es'],
        sampleRateHz: 48000,
        provenanceRefs: ['ref:voxcpm2'],
      }],
      languageVariants: [
        { id: 'voice-hero-en', voiceIdentityId: 'voice-hero', language: 'en', accentPolicy: 'preserve-identity' as const, providerBindingIds: ['voxcpm'] },
        { id: 'voice-hero-es', voiceIdentityId: 'voice-hero', language: 'es', accentPolicy: 'native-target' as const, providerBindingIds: ['voxcpm'] },
      ],
      defaultVariantId: 'voice-hero-en',
      speakerFingerprintRefs: ['speaker:hero:v1'],
      minimumSpeakerSimilarity: 0.82,
      approvedAt: '2026-09-22T00:00:00Z',
      approvedBy: 'user-1',
    };
    expect(validateMovieGradeVoiceIdentity(identity)).toEqual([]);

    const request = {
      id: 'line-es',
      projectId: 'movie-1',
      characterId: 'hero',
      voiceIdentityId: 'voice-hero',
      voiceVariantId: 'voice-hero-es',
      language: 'es',
      text: 'Tenemos que salir ahora.',
      sceneId: 'scene-12',
      lineId: 'line-12-4',
      targetDurationSeconds: 2.5,
      evidenceIds: ['script:scene-12'],
    };
    const bad = validateGeneratedDialogueVoice(identity, request, {
      id: 'voice-render-es',
      requestId: 'line-es',
      projectId: 'movie-1',
      characterId: 'hero',
      voiceIdentityId: 'voice-hero',
      voiceVariantId: 'voice-hero-es',
      providerBindingId: 'voxcpm',
      audioAssetId: 'audio-es',
      audioSha256: 'audio-es-sha',
      language: 'es',
      sampleRateHz: 48000,
      durationSeconds: 2.45,
      wordTimingEvidenceId: 'timing:es',
      speakerSimilarity: 0.71,
      intelligibilityScore: 0.96,
      prosodyMatchScore: 0.9,
      pronunciationConfidence: 0.95,
      clippingDetected: false,
      evidenceIds: ['speaker-qc:es'],
    }, {
      minimumSpeakerSimilarity: 0.8,
      minimumIntelligibility: 0.9,
      minimumProsodyMatch: 0.75,
      minimumPronunciationConfidence: 0.85,
      maximumDurationDriftSeconds: 0.25,
      requireWordTimingEvidence: true,
    });
    expect(bad.admissible).toBe(false);
    expect(bad.reasons).toContain('DIRECTOR_VOICE_SPEAKER_SIMILARITY_LOW');
  });

  it('requires feature-film score rights and dramatic purpose', () => {
    const bible = {
      projectId: 'movie-1',
      scoreThemes: [{
        id: 'theme-hero',
        projectId: 'movie-1',
        name: 'Hero motif',
        stemAssetIds: ['strings','piano'],
        instrumentation: ['strings','piano'],
        source: 'generated' as const,
        rightsEvidenceIds: ['rights:score:hero'],
      }],
      sceneCues: [{
        id: 'cue-1',
        sceneId: 'scene-12',
        themeId: 'theme-hero',
        startSeconds: 0,
        endSeconds: 35,
        intensity: 0.7,
        dialoguePriority: true,
        dramaticPurpose: 'support the hero decision without overpowering dialogue',
        evidenceIds: ['scene:12:dramaturgy'],
      }],
      dialogueLoudnessTargetLufs: -16,
      musicLoudnessTargetLufs: -24,
      foleyLoudnessTargetLufs: -22,
      finalPeakDbfs: -1,
    };
    expect(validateMovieGradeAudioBible(bible, true)).toEqual([]);
    expect(validateMovieGradeAudioBible({
      ...bible,
      scoreThemes: [{ ...bible.scoreThemes[0], rightsEvidenceIds: [] }],
    }, true)).toContain('DIRECTOR_SCORE_THEME_RIGHTS_REQUIRED:theme-hero');
  });
  it('never selects a visually strong take when canonical character identity drifted', () => {
    const baseCandidate = (takeId: string, score: number) => ({
      takeId,
      assetId: `asset-${takeId}`,
      observationIds: [`obs-${takeId}`],
      hardFailures: [] as string[],
      dimensions: [
        { dimension: 'technical' as const, score, confidence: 0.95, evidenceIds: [`tech-${takeId}`] },
        { dimension: 'visual-readability' as const, score, confidence: 0.95, evidenceIds: [`visual-${takeId}`] },
        { dimension: 'performance' as const, score, confidence: 0.95, evidenceIds: [`perf-${takeId}`] },
        { dimension: 'dialogue' as const, score, confidence: 0.95, evidenceIds: [`dialogue-${takeId}`] },
        { dimension: 'story-function' as const, score, confidence: 0.95, evidenceIds: [`story-${takeId}`] },
        { dimension: 'continuity' as const, score, confidence: 0.95, evidenceIds: [`continuity-${takeId}`] },
      ],
    });

    const wrongFace = withCharacterIdentityQc(baseCandidate('beautiful-wrong-face', 0.98), [{
      admissible: false,
      identityScore: 0.62,
      appearanceScore: 0.94,
      coverage: 1,
      reasons: ['DIRECTOR_CHARACTER_IDENTITY_DRIFT'],
      evidenceIds: ['identity-qc:wrong'],
    }]);
    const correctFace = withCharacterIdentityQc(baseCandidate('correct-character', 0.86), [{
      admissible: true,
      identityScore: 0.93,
      appearanceScore: 0.88,
      coverage: 1,
      reasons: [],
      evidenceIds: ['identity-qc:correct'],
    }]);

    const result = rankMultimodalTakes([wrongFace, correctFace], LONG_FORM_TAKE_POLICY);
    expect(result.selectedTakeId).toBe('correct-character');
    expect(result.ranked.find((take) => take.takeId === 'beautiful-wrong-face')?.reasons)
      .toContain('DIRECTOR_CHARACTER_IDENTITY_DRIFT');
  });
  it('keeps VibeVoiceFusion reference-only until its repository license is explicitly admitted', () => {
    const profile = DIRECTOR_VOICE_PROVIDER_PROFILES.find((item) => item.id === 'vibevoice-fusion');
    expect(profile).toBeDefined();
    expect(profile?.runtimeRole).toBe('reference-only');
    expect(profile?.license).toContain('UNVERIFIED');
    expect(profile?.capabilities).toEqual(expect.arrayContaining([
      'voice-clone',
      'multi-speaker',
      'lora-adaptation',
      'batch-variation',
      'queue-management',
    ]));
  });
});
