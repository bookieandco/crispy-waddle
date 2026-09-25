import type { ActionRequest } from '@jhadina/action-core'
import type { VideoTrack } from './studio-contracts'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'

export type CharacterReplacementEnvironmentMode = 'preserve-source' | 'reference-frame' | 'regenerate'
export type CharacterReplacementAspectRatioPolicy = 'strict-match' | 'fit-crop'
export interface CharacterReplacementDimensions { width: number; height: number }

export interface CharacterReplacementInput {
  sourceAssetId: string
  replacementAssetId: string
  trackingArtifactId: string
  tracks: VideoTrack[]
  preserveMotion: boolean
  preserveFacialMotion: boolean
  preserveLighting: boolean
  preserveOrientation: boolean
  environmentMode: CharacterReplacementEnvironmentMode
  environmentReferenceAssetId?: string
  motionReferenceAssetId: string
  sourceDimensions?: CharacterReplacementDimensions
  replacementDimensions?: CharacterReplacementDimensions
  aspectRatioPolicy: CharacterReplacementAspectRatioPolicy
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
  if (!input.motionReferenceAssetId) errors.push('motionReferenceAssetId is required')
  if (input.preserveMotion && input.motionReferenceAssetId !== input.sourceAssetId) errors.push('source motion lock must use the governed source video')
  if (input.environmentMode === 'reference-frame' && !input.environmentReferenceAssetId) errors.push('environmentReferenceAssetId is required for reference-frame mode')
  if (input.environmentMode !== 'reference-frame' && input.environmentReferenceAssetId) errors.push('environmentReferenceAssetId is only valid for reference-frame mode')
  for (const [label,dimensions] of [['source',input.sourceDimensions],['replacement',input.replacementDimensions]] as const) {
    if (dimensions && (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0)) {
      errors.push(`${label} dimensions are invalid`)
    }
  }
  if (Boolean(input.sourceDimensions) !== Boolean(input.replacementDimensions)) errors.push('source and replacement dimensions must be supplied together')
  if (
    input.aspectRatioPolicy === 'strict-match' &&
    input.sourceDimensions &&
    input.replacementDimensions &&
    !aspectRatioMatches(input.sourceDimensions,input.replacementDimensions)
  ) errors.push('replacement aspect ratio must match the source video')
  return errors
}

function parseTracks(value: unknown): VideoTrack[] {
  return Array.isArray(value) ? value as VideoTrack[] : []
}

function readDimensions(value: unknown): CharacterReplacementDimensions | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record=value as Record<string,unknown>
  return typeof record.width === 'number' && typeof record.height === 'number'
    ? { width: record.width, height: record.height }
    : undefined
}

function aspectRatioMatches(a: CharacterReplacementDimensions,b: CharacterReplacementDimensions,tolerance=.02): boolean {
  return Math.abs((a.width/a.height)-(b.width/b.height)) <= tolerance
}

function readInput(action: DirectorStudioAction): CharacterReplacementInput {
  const p=action.parameters ?? {}
  const sourceAssetId=action.inputAssetIds[0] ?? ''
  const environmentMode:CharacterReplacementEnvironmentMode=
    p.environmentMode === 'reference-frame' || p.environmentMode === 'regenerate'
      ? p.environmentMode
      : 'preserve-source'
  const input: CharacterReplacementInput={
    sourceAssetId,
    replacementAssetId: action.inputAssetIds[1] ?? '',
    trackingArtifactId: typeof p.trackingArtifactId === 'string' ? p.trackingArtifactId : '',
    tracks: parseTracks(p.tracks),
    preserveMotion: p.preserveMotion !== false,
    preserveFacialMotion: p.preserveFacialMotion !== false,
    preserveLighting: p.preserveLighting !== false,
    preserveOrientation: p.preserveOrientation !== false,
    environmentMode,
    environmentReferenceAssetId: typeof p.environmentReferenceAssetId === 'string' ? p.environmentReferenceAssetId : undefined,
    motionReferenceAssetId: typeof p.motionReferenceAssetId === 'string' ? p.motionReferenceAssetId : sourceAssetId,
    sourceDimensions: readDimensions(p.sourceDimensions),
    replacementDimensions: readDimensions(p.replacementDimensions),
    aspectRatioPolicy: p.aspectRatioPolicy === 'fit-crop' ? 'fit-crop' : 'strict-match',
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
          `preserve-facial-motion:${input.preserveFacialMotion}`,
          `preserve-lighting:${input.preserveLighting}`,
          `preserve-orientation:${input.preserveOrientation}`,
          `environment-mode:${input.environmentMode}`,
          `motion-reference:${input.motionReferenceAssetId}`,
          `aspect-ratio-policy:${input.aspectRatioPolicy}`,
          ...(input.environmentReferenceAssetId ? [`environment-reference:${input.environmentReferenceAssetId}`] : []),
          ...(artifact.continuityRef ? [`continuity:${artifact.continuityRef}`] : []),
        ],
      }
    },
  }
}
