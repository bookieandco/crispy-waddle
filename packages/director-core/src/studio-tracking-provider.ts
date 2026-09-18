import type { ActionRequest } from '@jhadina/action-core'
import type { FrameAnnotation, TrackClass, VideoTrack } from './studio-contracts'
import type { DirectorStudioAction, DirectorStudioCapabilityProvider } from './studio-governed-action'

export interface TrackingSegmentationRequest {
  sourceAssetId: string
  frameStart: number
  frameEnd: number
  classes: TrackClass[]
  seedAnnotations?: FrameAnnotation[]
}

export interface TrackingSegmentationArtifact {
  artifactId: string
  sourceAssetId: string
  tracks: VideoTrack[]
  segmentationRefs: string[]
  keypointRefs: string[]
  provider: string
}

export interface TrackingSegmentationAdapter {
  readonly name: string
  track(request: TrackingSegmentationRequest): Promise<TrackingSegmentationArtifact>
}

export function validateTrackingRequest(request: TrackingSegmentationRequest): string[] {
  const errors: string[] = []
  if (!request.sourceAssetId) errors.push('sourceAssetId is required')
  if (request.frameStart < 0) errors.push('frameStart must be non-negative')
  if (request.frameEnd < request.frameStart) errors.push('frameEnd must be >= frameStart')
  if (!request.classes.length) errors.push('at least one tracking class is required')
  return errors
}

function readTrackingRequest(action: DirectorStudioAction): TrackingSegmentationRequest {
  const parameters=action.parameters ?? {}
  const sourceAssetId=action.inputAssetIds[0]
  const frameStart=parameters.frameStart
  const frameEnd=parameters.frameEnd
  const classes=parameters.classes
  const request: TrackingSegmentationRequest={
    sourceAssetId,
    frameStart: typeof frameStart === 'number' ? frameStart : 0,
    frameEnd: typeof frameEnd === 'number' ? frameEnd : -1,
    classes: Array.isArray(classes) ? classes as TrackClass[] : [],
  }
  const errors=validateTrackingRequest(request)
  if (errors.length) throw new Error(`Invalid tracking request: ${errors.join('; ')}`)
  return request
}

/**
 * Adapts a tracking/segmentation implementation to the already-governed Studio
 * provider boundary. This adapter has no policy authority of its own.
 */
export function createTrackingSegmentationProvider(
  adapter: TrackingSegmentationAdapter,
): DirectorStudioCapabilityProvider {
  return {
    supports: capability => capability === 'tracking',
    async execute(action: DirectorStudioAction, _request: ActionRequest<DirectorStudioAction>) {
      if (action.capability !== 'tracking') throw new Error('Tracking provider received non-tracking action')
      const artifact=await adapter.track(readTrackingRequest(action))
      const unapproved=artifact.tracks.filter(track => !track.approved)
      const lowConfidence=artifact.tracks.filter(track => track.confidence < 0.5)
      return {
        capability: 'tracking',
        projectId: action.projectId,
        outputAssetIds: [artifact.artifactId],
        evidenceIds: [
          ...artifact.segmentationRefs,
          ...artifact.keypointRefs,
          `tracking-provider:${artifact.provider}`,
          `tracking-unapproved:${unapproved.length}`,
          `tracking-low-confidence:${lowConfidence.length}`,
        ],
      }
    },
  }
}
