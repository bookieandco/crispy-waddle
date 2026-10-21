import { describe, expect, it } from 'vitest'
import { prepareRecastPreview, type RecastPreviewRequest } from './recast-preview'

const input: RecastPreviewRequest = {
  id: 'recast:one', userId: 'owner:1', projectId: 'director:1', requestedAt: '2026-10-21T14:00:00Z',
  sourceVideoAssetId: 'video:original', characterImageAssetId: 'image:authorized-character',
  sourceAudioAssetId: 'audio:original', trackingArtifactId: 'track:1',
  approvedCharacterTracks: [{
    trackId: 'actor:one', class: 'character', instanceId: 'actor-1',
    frameStart: 0, frameEnd: 300, source: 'human', confidence: 1, approved: true, annotations: [],
  }],
  approvedVoiceTracks: [{
    startMs: 0, endMs: 10000, confidence: 1,
  }],
  characterTrackId: 'actor:one', verifiedVoiceSyncEvidenceIds: ['voice:approved:receipt'],
  sourceDurationSeconds: 10,
  consentReceiptId: 'consent:1', mediaRightsReceiptId: 'rights:1',
}

describe('Director Quick Recast preview', () => {
  it('preserves source scene and motion while requesting downstream audio resync', () => {
    const result = prepareRecastPreview(input)
    expect(result).toMatchObject({
      renderMode: 'preview',
      replacementMode: 'character-only',
      environmentMode: 'preserve-source',
      audioMode: 'resync-after-swap',
      executionAuthority: 'NONE', publicationAuthority: 'NONE', costAuthority: 'NONE',
    })
    expect(result.source.stages).toEqual(['character-replace', 'voice-sync', 'qc', 'asset-approval'])
    expect(result.source.replacement.action.parameters).toMatchObject({
      preserveMotion: true, preserveLighting: true,
      preserveOrientation: true, environmentMode: 'preserve-source',
      motionReferenceAssetId: 'video:original',
    })
    expect(result.source.lipSync?.sourceAudioAssetId).toBe('audio:original')
  })
  it('fails closed for missing consent and media rights', () => {
    expect(() => prepareRecastPreview({ ...input, consentReceiptId: '' })).toThrow(/CONSENT_REQUIRED/)
    expect(() => prepareRecastPreview({ ...input, mediaRightsReceiptId: '' })).toThrow(/MEDIA_RIGHTS_REQUIRED/)
  })
  it('rejects unapproved character and voice tracks', () => {
    expect(() => prepareRecastPreview({ ...input, approvedCharacterTracks: [{ ...input.approvedCharacterTracks[0], approved: false }] })).toThrow(/APPROVED_CHARACTER_TRACK/)
    expect(() => prepareRecastPreview({ ...input, approvedVoiceTracks: [{ ...input.approvedVoiceTracks[0], confidence: 0.1 }] })).toThrow(/USABLE_VOICE_TRACK/)
    expect(() => prepareRecastPreview({ ...input, verifiedVoiceSyncEvidenceIds: [] })).toThrow(/VERIFIED_VOICE_EVIDENCE_REQUIRED/)
  })
  it('rejects missing audio and clips beyond preview scope', () => {
    expect(() => prepareRecastPreview({ ...input, sourceAudioAssetId: '' })).toThrow(/SOURCE_AUDIO_REQUIRED/)
    expect(() => prepareRecastPreview({ ...input, sourceDurationSeconds: 31 })).toThrow(/DURATION_INVALID/)
    expect(() => prepareRecastPreview({ ...input, sourceDurationSeconds: 0 })).toThrow(/DURATION_INVALID/)
  })
})
