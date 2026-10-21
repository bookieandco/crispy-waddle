import { isVoiceSyncTrackUsable, type VideoTrack, type VoiceSyncTrack } from './studio-contracts'
import { prepareRecastPreview, type RecastPreviewPlan } from './recast-preview'

/**
 * Server-derived, read-only review records. Never deserialize these directly
 * from a browser request or let a model certify its own tracking.
 */
export interface RecastReviewedMedia {
  projectId: string
  ownerUserId: string
  sourceVideoAssetId: string
  sourceVideoSha256: string
  characterImageAssetId: string
  characterImageSha256: string
  sourceAudioAssetId: string
  sourceAudioSha256: string
  decodedDurationSeconds: number
  verified: boolean
}

export interface RecastReviewedTracking {
  projectId: string
  sourceVideoAssetId: string
  sourceVideoSha256: string
  trackingArtifactId: string
  reviewedByUserId: string
  reviewReceiptId: string
  tracks: readonly VideoTrack[]
  approved: boolean
}

export interface RecastReviewedVoice {
  projectId: string
  sourceAudioAssetId: string
  sourceAudioSha256: string
  sourceVideoAssetId: string
  reviewerUserId: string
  reviewReceiptId: string
  evidenceIds: readonly string[]
  tracks: readonly VoiceSyncTrack[]
  approved: boolean
}

export interface RecastReviewedRights {
  projectId: string
  ownerUserId: string
  sourceVideoAssetId: string
  characterImageAssetId: string
  sourceAudioAssetId: string
  consentReceiptId: string
  rightsReceiptId: string
  reviewedByUserId: string
  approved: boolean
}

export type RecastReviewedEvidence = Readonly<{
  media: RecastReviewedMedia | null
  tracking: RecastReviewedTracking | null
  voice: RecastReviewedVoice | null
  rights: RecastReviewedRights | null
}>

export type RecastCandidateSelection = Readonly<{
  projectId: string
  ownerUserId: string
  sourceVideoAssetId: string
  characterImageAssetId: string
  sourceAudioAssetId: string
}>

export type RecastReviewedDecision = Readonly<{
  planningAdmissible: boolean
  blockers: readonly string[]
  renderAdmissible: false
  spendAuthority: 'NONE'
  publicationAuthority: 'NONE'
}>

const digest = (v: unknown): boolean => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v)
const nonempty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0
const safeRefs = (v: readonly string[] | undefined): boolean =>
  Array.isArray(v) && v.length > 0 && v.every(nonempty)

/** Reads are to be performed by a privileged server resolver after project
 * authorization. Reviewed fields are checked for full lineage coherence. */
export function evaluateRecastReviewedEvidence(
  selection: RecastCandidateSelection,
  evidence: RecastReviewedEvidence,
): RecastReviewedDecision {
  const blockers: string[] = []
  const m = evidence.media
  if (!m || !m.verified || m.projectId !== selection.projectId ||
    m.ownerUserId !== selection.ownerUserId ||
    m.sourceVideoAssetId !== selection.sourceVideoAssetId ||
    m.characterImageAssetId !== selection.characterImageAssetId ||
    m.sourceAudioAssetId !== selection.sourceAudioAssetId ||
    !digest(m.sourceVideoSha256) || !digest(m.characterImageSha256) || !digest(m.sourceAudioSha256) ||
    !Number.isFinite(m.decodedDurationSeconds) || m.decodedDurationSeconds <= 0 ||
    m.decodedDurationSeconds > 30) {
    blockers.push('DIRECTOR_RECAST_VERIFIED_MEDIA_OR_DURATION_REQUIRED')
  }

  const t = evidence.tracking
  if (!m || !t || !t.approved || t.projectId !== selection.projectId ||
    t.sourceVideoAssetId !== selection.sourceVideoAssetId ||
    t.sourceVideoSha256 !== m.sourceVideoSha256 ||
    !nonempty(t.trackingArtifactId) || !nonempty(t.reviewReceiptId) ||
    !nonempty(t.reviewedByUserId) || !t.tracks.length ||
    t.tracks.some(track => track.class !== 'character' || !track.approved ||
      !nonempty(track.trackId) || !Number.isFinite(track.confidence) ||
      track.confidence < .5 || track.frameEnd < track.frameStart ||
      track.source === 'model')) {
    blockers.push('DIRECTOR_RECAST_APPROVED_TRACKING_LINEAGE_REQUIRED')
  }

  const voice = evidence.voice
  if (!m || !voice || !voice.approved ||
    voice.projectId !== selection.projectId ||
    voice.sourceAudioAssetId !== selection.sourceAudioAssetId ||
    voice.sourceVideoAssetId !== selection.sourceVideoAssetId ||
    voice.sourceAudioSha256 !== m.sourceAudioSha256 ||
    !nonempty(voice.reviewerUserId) || !nonempty(voice.reviewReceiptId) ||
    !safeRefs(voice.evidenceIds) || !voice.tracks.length ||
    voice.tracks.some(track => !isVoiceSyncTrackUsable(track) ||
      track.endMs > m.decodedDurationSeconds * 1000 + 250)) {
    blockers.push('DIRECTOR_RECAST_REVIEWED_VOICE_LINEAGE_REQUIRED')
  }

  const rights = evidence.rights
  if (!rights || !rights.approved || rights.projectId !== selection.projectId ||
    rights.ownerUserId !== selection.ownerUserId ||
    rights.sourceVideoAssetId !== selection.sourceVideoAssetId ||
    rights.characterImageAssetId !== selection.characterImageAssetId ||
    rights.sourceAudioAssetId !== selection.sourceAudioAssetId ||
    !nonempty(rights.reviewedByUserId) || !nonempty(rights.consentReceiptId) ||
    !nonempty(rights.rightsReceiptId)) {
    blockers.push('DIRECTOR_RECAST_REVIEWED_CONSENT_AND_RIGHTS_REQUIRED')
  }

  return Object.freeze({
    planningAdmissible: blockers.length === 0,
    blockers: Object.freeze(blockers),
    renderAdmissible: false,
    spendAuthority: 'NONE',
    publicationAuthority: 'NONE',
  })
}

/**
 * Bind reviewed records to the existing governed Director planning adapter.
 * Note: input must come from a trusted, independently authorized repository,
 * not a JSON body sent by a user or worker.
 */
export function planReviewedRecastPreview(
  id: string,
  requestedAt: string,
  selection: RecastCandidateSelection,
  evidence: RecastReviewedEvidence,
): RecastPreviewPlan {
  const decision = evaluateRecastReviewedEvidence(selection, evidence)
  if (!decision.planningAdmissible) {
    throw new Error('DIRECTOR_RECAST_REVIEW_BLOCKED:' + decision.blockers.join(','))
  }
  const media = evidence.media!
  const tracking = evidence.tracking!
  const voice = evidence.voice!
  const rights = evidence.rights!
  return prepareRecastPreview({
    id, requestedAt, userId: selection.ownerUserId, projectId: selection.projectId,
    sourceVideoAssetId: media.sourceVideoAssetId,
    characterImageAssetId: media.characterImageAssetId,
    sourceAudioAssetId: media.sourceAudioAssetId,
    sourceDurationSeconds: media.decodedDurationSeconds,
    trackingArtifactId: tracking.trackingArtifactId,
    approvedCharacterTracks: [...tracking.tracks],
    approvedVoiceTracks: [...voice.tracks],
    verifiedVoiceSyncEvidenceIds: [...voice.evidenceIds, voice.reviewReceiptId],
    consentReceiptId: rights.consentReceiptId,
    mediaRightsReceiptId: rights.rightsReceiptId,
  })
}
