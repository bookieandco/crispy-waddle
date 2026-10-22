import type { SourceDrivenCharacterSwapInput, SourceDrivenCharacterSwapPlan } from './source-driven-character-swap'
import { planSourceDrivenCharacterSwap } from './source-driven-character-swap'
import { isVoiceSyncTrackUsable, type VideoTrack, type VoiceSyncTrack } from './studio-contracts'

/** Quick Recast does not upload media or execute a worker. Owner-supplied IDs
 * must resolve via the canonical Director asset/approval system at execution. */
export interface RecastPreviewRequest {
  id: string
  projectId: string
  userId: string
  requestedAt: string
  sourceVideoAssetId: string
  characterImageAssetId: string
  trackingArtifactId: string
  approvedCharacterTracks: VideoTrack[]
  sourceAudioAssetId: string
  approvedVoiceTracks: VoiceSyncTrack[]
  verifiedVoiceSyncEvidenceIds: readonly string[]
  sourceDurationSeconds: number
  characterTrackId?: string
  consentReceiptId: string
  mediaRightsReceiptId: string
  approvalReceiptId?: string
}

export interface RecastPreviewPlan {
  id: string
  source: SourceDrivenCharacterSwapPlan
  sourceDurationSeconds: number
  replacementMode: 'character-only'
  environmentMode: 'preserve-source'
  audioMode: 'resync-after-swap'
  renderMode: 'preview'
  continuity: Readonly<{
    preserveMotion: true
    preserveLighting: true
    preserveOrientation: true
    preserveSourceEnvironment: true
  }>
  requiredEvidence: readonly string[]
  readiness: 'SOURCE_PREVIEW_PLAN_ONLY'
  executionAuthority: 'NONE'
  publicationAuthority: 'NONE'
  costAuthority: 'NONE'
}

/** This creates a governed *proposal*, never a runnable approval token.
 * Lip sync remains a separate downstream approval-bound capability. */
export function prepareRecastPreview(input: RecastPreviewRequest): RecastPreviewPlan {
  if (!input.consentReceiptId?.trim()) throw new Error('DIRECTOR_RECAST_CONSENT_REQUIRED')
  if (!input.mediaRightsReceiptId?.trim()) throw new Error('DIRECTOR_RECAST_MEDIA_RIGHTS_REQUIRED')
  if (!Number.isFinite(input.sourceDurationSeconds) ||
      input.sourceDurationSeconds <= 0 || input.sourceDurationSeconds > 30) {
    throw new Error('DIRECTOR_RECAST_PREVIEW_DURATION_INVALID')
  }
  if (!input.approvedCharacterTracks?.length || input.approvedCharacterTracks.some(t => !t.approved || t.class !== 'character')) {
    throw new Error('DIRECTOR_RECAST_APPROVED_CHARACTER_TRACK_REQUIRED')
  }
  if (!input.approvedVoiceTracks?.length || input.approvedVoiceTracks.some(t => !isVoiceSyncTrackUsable(t))) {
    throw new Error('DIRECTOR_RECAST_USABLE_VOICE_TRACK_REQUIRED')
  }
  if (!input.verifiedVoiceSyncEvidenceIds?.length || input.verifiedVoiceSyncEvidenceIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('DIRECTOR_RECAST_VERIFIED_VOICE_EVIDENCE_REQUIRED')
  }
  if (!input.sourceAudioAssetId?.trim()) throw new Error('DIRECTOR_RECAST_SOURCE_AUDIO_REQUIRED')
  const action: SourceDrivenCharacterSwapInput = {
    id: input.id,
    userId: input.userId,
    requestedAt: input.requestedAt,
    projectId: input.projectId,
    sourceVideoAssetId: input.sourceVideoAssetId,
    replacementCharacterAssetId: input.characterImageAssetId,
    trackingArtifactId: input.trackingArtifactId,
    tracks: input.approvedCharacterTracks,
    environmentMode: 'preserve-source',
    lipSyncMode: 'resync-after-swap',
    sourceAudioAssetId: input.sourceAudioAssetId,
    voiceSyncTracks: input.approvedVoiceTracks,
    characterTrackId: input.characterTrackId,
    approvalReceiptId: input.approvalReceiptId,
  }
  const source = planSourceDrivenCharacterSwap(action)
  return Object.freeze({
    id: input.id,
    source,
    sourceDurationSeconds: input.sourceDurationSeconds,
    replacementMode: 'character-only',
    environmentMode: 'preserve-source',
    audioMode: 'resync-after-swap',
    renderMode: 'preview',
    continuity: Object.freeze({
      preserveMotion: true,
      preserveLighting: true,
      preserveOrientation: true,
      preserveSourceEnvironment: true,
    }),
    requiredEvidence: Object.freeze([
      input.consentReceiptId,
      input.mediaRightsReceiptId,
      input.trackingArtifactId,
      ...input.verifiedVoiceSyncEvidenceIds,
      ...(input.approvalReceiptId ? [input.approvalReceiptId] : []),
    ]),
    readiness: 'SOURCE_PREVIEW_PLAN_ONLY',
    executionAuthority: 'NONE',
    publicationAuthority: 'NONE',
    costAuthority: 'NONE',
  })
}
