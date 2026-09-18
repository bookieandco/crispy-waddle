import type { ActionRequest } from '@jhadina/action-core'
import type { VideoTrack } from './studio-contracts'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'

export interface CharacterReplacementInput {
  sourceAssetId: string
  replacementAssetId: string
  trackingArtifactId: string
  tracks: VideoTrack[]
  preserveMotion: boolean
  preserveLighting: boolean
  continuityRef?: string
}

export interface CharacterReplacementArtifact {
  artifactId: string
  sourceAssetId: string
  replacementAssetId: string
  trackingArtifactId: string
  provider: string
  compositeEvidenceIds: string[]
  continuityRef?: string
}

export interface CharacterReplacementAdapter {
  readonly name: string
  composite(input: CharacterReplacementInput): Promise<CharacterReplacementArtifact>
}

export function validateCharacterReplacementInput(input: CharacterReplacementInput): string[] {
  const errors: string[]=[]
  if (!input.sourceAssetId) errors.push('sourceAssetId is required')
  if (!input.replacementAssetId) errors.push('replacementAssetId is required')
  if (!input.trackingArtifactId) errors.push('trackingArtifactId is required')
  if (!input.tracks.length) errors.push('at least one approved character track is required')
  if (input.tracks.some(track => track.class !== 'character')) errors.push('replacement accepts character tracks only')
  if (input.tracks.some(track => !track.approved)) errors.push('all replacement tracks must be approved')
  return errors
}

function parseTracks(value: unknown): VideoTrack[] {
  return Array.isArray(value) ? value as VideoTrack[] : []
}

function readInput(action: DirectorStudioAction): CharacterReplacementInput {
  const p=action.parameters ?? {}
  const input: CharacterReplacementInput={
    sourceAssetId: action.inputAssetIds[0] ?? '',
    replacementAssetId: action.inputAssetIds[1] ?? '',
    trackingArtifactId: typeof p.trackingArtifactId === 'string' ? p.trackingArtifactId : '',
    tracks: parseTracks(p.tracks),
    preserveMotion: p.preserveMotion !== false,
    preserveLighting: p.preserveLighting !== false,
    continuityRef: typeof p.continuityRef === 'string' ? p.continuityRef : undefined,
  }
  const errors=validateCharacterReplacementInput(input)
  if (errors.length) throw new Error(`Invalid character replacement: ${errors.join('; ')}`)
  return input
}

/**
 * Character replacement is downstream of governed Studio execution. It accepts
 * only explicitly approved character tracks; raw model tracks cannot silently
 * become a composite.
 */
export function createCharacterReplacementProvider(adapter: CharacterReplacementAdapter): DirectorStudioCapabilityProvider {
  return {
    supports: capability => capability === 'character-replace',
    async execute(action: DirectorStudioAction, _request: ActionRequest<DirectorStudioAction>) {
      if (action.capability !== 'character-replace') throw new Error('Character replacement provider received wrong capability')
      const input=readInput(action)
      const artifact=await adapter.composite(input)
      return {
        capability: 'character-replace',
        projectId: action.projectId,
        outputAssetIds: [artifact.artifactId],
        evidenceIds: [
          artifact.trackingArtifactId,
          ...artifact.compositeEvidenceIds,
          `character-replacement-provider:${artifact.provider}`,
          `preserve-motion:${input.preserveMotion}`,
          `preserve-lighting:${input.preserveLighting}`,
          ...(artifact.continuityRef ? [`continuity:${artifact.continuityRef}`] : []),
        ],
      }
    },
  }
}
