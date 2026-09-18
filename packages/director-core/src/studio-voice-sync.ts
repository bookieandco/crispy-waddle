import type { ActionRequest } from '@jhadina/action-core'
import { isVoiceSyncTrackUsable, type VoiceSyncMode, type VoiceSyncTrack } from './studio-contracts'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'

export interface VoiceSyncInput {
  videoAssetId: string
  audioAssetId: string
  mode: VoiceSyncMode
  tracks: VoiceSyncTrack[]
  characterTrackId?: string
  continuityRef?: string
}

export interface VoiceSyncArtifact {
  artifactId: string
  videoAssetId: string
  audioAssetId: string
  provider: string
  syncEvidenceIds: string[]
  averageConfidence: number
}

export interface VoiceSyncAdapter {
  readonly name: string
  synchronize(input: VoiceSyncInput): Promise<VoiceSyncArtifact>
}

export function validateVoiceSyncInput(input: VoiceSyncInput): string[] {
  const errors:string[]=[]
  if (!input.videoAssetId) errors.push('videoAssetId is required')
  if (!input.audioAssetId) errors.push('audioAssetId is required')
  if (!input.tracks.length) errors.push('at least one voice-sync track is required')
  if (input.tracks.some(track => !isVoiceSyncTrackUsable(track))) errors.push('all voice-sync tracks must meet duration and confidence thresholds')
  return errors
}

function readTracks(value:unknown):VoiceSyncTrack[] {
  return Array.isArray(value) ? value as VoiceSyncTrack[] : []
}

function readInput(action:DirectorStudioAction):VoiceSyncInput {
  const p=action.parameters ?? {}
  const mode:VoiceSyncMode=p.mode === 'phoneme-driven' || p.mode === 'viseme-driven' ? p.mode : 'lip-sync'
  const input:VoiceSyncInput={
    videoAssetId:action.inputAssetIds[0] ?? '',
    audioAssetId:action.inputAssetIds[1] ?? '',
    mode,
    tracks:readTracks(p.tracks),
    characterTrackId:typeof p.characterTrackId === 'string' ? p.characterTrackId : undefined,
    continuityRef:typeof p.continuityRef === 'string' ? p.continuityRef : undefined,
  }
  const errors=validateVoiceSyncInput(input)
  if(errors.length) throw new Error(`Invalid voice sync: ${errors.join('; ')}`)
  return input
}

/**
 * Provider-neutral lip/phoneme/viseme synchronization. Concrete Wav2Lip,
 * MuseTalk, Rhubarb or future adapters live behind this boundary and therefore
 * cannot bypass the canonical Studio ActionExecutor gate.
 */
export function createVoiceSyncProvider(adapter:VoiceSyncAdapter):DirectorStudioCapabilityProvider {
  return {
    supports:capability=>capability === 'voice-sync',
    async execute(action:DirectorStudioAction,_request:ActionRequest<DirectorStudioAction>) {
      if(action.capability !== 'voice-sync') throw new Error('Voice sync provider received wrong capability')
      const input=readInput(action)
      const artifact=await adapter.synchronize(input)
      if(artifact.averageConfidence < .7) throw new Error('Voice sync output confidence is below acceptance threshold')
      return {
        capability:'voice-sync',
        projectId:action.projectId,
        outputAssetIds:[artifact.artifactId],
        evidenceIds:[
          ...artifact.syncEvidenceIds,
          `voice-sync-provider:${artifact.provider}`,
          `voice-sync-mode:${input.mode}`,
          `voice-sync-confidence:${artifact.averageConfidence}`,
          ...(input.characterTrackId ? [`character-track:${input.characterTrackId}`] : []),
          ...(input.continuityRef ? [`continuity:${input.continuityRef}`] : []),
        ],
      }
    },
  }
}
