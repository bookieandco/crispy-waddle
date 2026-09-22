import { describe, expect, it } from 'vitest';
import { validateCharacterSceneBinding } from './cast-bible';
import { resolveDialogueVoice } from './voice-identity';
import { validateMovieAudioBible } from './movie-audio-bible';

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
      referenceAssetIds: ['hero-ref-suit'],
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
});
