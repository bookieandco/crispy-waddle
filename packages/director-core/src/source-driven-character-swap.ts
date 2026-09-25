import type { ActionRequest } from '@jhadina/action-core'
import type { VideoTrack, VoiceSyncTrack } from './studio-contracts'
import {
  createDirectorStudioAction,
  type DirectorStudioAction,
} from './studio-governed-action'
import type {
  CharacterReplacementAspectRatioPolicy,
  CharacterReplacementDimensions,
  CharacterReplacementEnvironmentMode,
} from './studio-character-replacement'

export type CharacterSwapLipSyncMode =
  | 'preserve-source-facial-motion'
  | 'resync-after-swap'
  | 'none'

export interface SourceDrivenCharacterSwapInput {
  id: string
  userId: string
  requestedAt: string
  projectId: string
  sourceVideoAssetId: string
  replacementCharacterAssetId: string
  trackingArtifactId: string
  tracks: VideoTrack[]
  sourceDimensions?: CharacterReplacementDimensions
  replacementDimensions?: CharacterReplacementDimensions
  aspectRatioPolicy?: CharacterReplacementAspectRatioPolicy
  environmentMode?: CharacterReplacementEnvironmentMode
  environmentReferenceAssetId?: string
  continuityRef?: string
  lipSyncMode?: CharacterSwapLipSyncMode
  sourceAudioAssetId?: string
  voiceSyncTracks?: VoiceSyncTrack[]
  characterTrackId?: string
  approvalReceiptId?: string
}

export interface CharacterSwapLipSyncHandoff {
  mode: 'lip-sync'
  sourceAudioAssetId: string
  tracks: VoiceSyncTrack[]
  characterTrackId?: string
  continuityRef?: string
  authority: 'DIRECTOR_CHARACTER_SWAP_LIP_SYNC_HANDOFF'
}

export interface SourceDrivenCharacterSwapPlan {
  replacement: ActionRequest<DirectorStudioAction>
  lipSync?: CharacterSwapLipSyncHandoff
  stages: readonly ('character-replace' | 'voice-sync' | 'qc' | 'asset-approval')[]
  authority: 'DIRECTOR_SOURCE_DRIVEN_CHARACTER_SWAP'
}

export function planSourceDrivenCharacterSwap(
  input: SourceDrivenCharacterSwapInput,
): SourceDrivenCharacterSwapPlan {
  const lipSyncMode=input.lipSyncMode ?? 'preserve-source-facial-motion'
  if (!input.id.trim() || !input.userId.trim() || !input.requestedAt.trim() || !input.projectId.trim()) {
    throw new Error('DIRECTOR_CHARACTER_SWAP_REQUEST_IDENTITY_REQUIRED')
  }
  if (!input.sourceVideoAssetId.trim()) throw new Error('DIRECTOR_CHARACTER_SWAP_SOURCE_VIDEO_REQUIRED')
  if (!input.replacementCharacterAssetId.trim()) throw new Error('DIRECTOR_CHARACTER_SWAP_REPLACEMENT_IDENTITY_REQUIRED')
  if (!input.trackingArtifactId.trim() || !input.tracks.length) throw new Error('DIRECTOR_CHARACTER_SWAP_TRACKING_REQUIRED')

  const environmentMode=input.environmentMode ?? 'preserve-source'
  if (environmentMode === 'reference-frame' && !input.environmentReferenceAssetId?.trim()) {
    throw new Error('DIRECTOR_CHARACTER_SWAP_ENVIRONMENT_REFERENCE_REQUIRED')
  }
  if (environmentMode !== 'reference-frame' && input.environmentReferenceAssetId) {
    throw new Error('DIRECTOR_CHARACTER_SWAP_ENVIRONMENT_REFERENCE_UNEXPECTED')
  }

  if (lipSyncMode === 'resync-after-swap') {
    if (!input.sourceAudioAssetId?.trim()) throw new Error('DIRECTOR_CHARACTER_SWAP_AUDIO_REQUIRED_FOR_RESYNC')
    if (!input.voiceSyncTracks?.length) throw new Error('DIRECTOR_CHARACTER_SWAP_VOICE_TRACKS_REQUIRED_FOR_RESYNC')
  }

  const replacement=createDirectorStudioAction({
    id:input.id,
    userId:input.userId,
    requestedAt:input.requestedAt,
    projectId:input.projectId,
    capability:'character-replace',
    inputAssetIds:[input.sourceVideoAssetId,input.replacementCharacterAssetId],
    approvalReceiptId:input.approvalReceiptId,
    parameters:{
      trackingArtifactId:input.trackingArtifactId,
      tracks:input.tracks,
      preserveMotion:true,
      preserveFacialMotion:lipSyncMode !== 'none',
      preserveLighting:true,
      preserveOrientation:true,
      environmentMode,
      environmentReferenceAssetId:input.environmentReferenceAssetId,
      motionReferenceAssetId:input.sourceVideoAssetId,
      sourceDimensions:input.sourceDimensions,
      replacementDimensions:input.replacementDimensions,
      aspectRatioPolicy:input.aspectRatioPolicy ?? 'strict-match',
      continuityRef:input.continuityRef,
    },
  })

  const lipSync:CharacterSwapLipSyncHandoff|undefined=
    lipSyncMode === 'resync-after-swap'
      ? {
          mode:'lip-sync',
          sourceAudioAssetId:input.sourceAudioAssetId!,
          tracks:[...(input.voiceSyncTracks ?? [])],
          characterTrackId:input.characterTrackId,
          continuityRef:input.continuityRef,
          authority:'DIRECTOR_CHARACTER_SWAP_LIP_SYNC_HANDOFF',
        }
      : undefined

  const stages:SourceDrivenCharacterSwapPlan['stages']=Object.freeze([
    'character-replace',
    ...(lipSync ? ['voice-sync' as const] : []),
    'qc',
    'asset-approval',
  ])

  return Object.freeze({
    replacement,
    lipSync,
    stages,
    authority:'DIRECTOR_SOURCE_DRIVEN_CHARACTER_SWAP',
  })
}
