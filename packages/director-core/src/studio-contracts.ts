export type CharacterArchetype = "human" | "cartoon" | "puppet" | "creature"

export interface CharacterBehaviorDNA {
  characterId: string
  archetype: CharacterArchetype
  traits: string[]
  breathing: { enabled: boolean; ratePerMinute: number; variability: number }
  movement: { gait: string; pace: number; idleVariation: number }
  speech: { cadence: number; pauseVariation: number; overlapTolerance: number }
  social: { eyeContact: number; personalSpace: number; gestureFrequency: number; reactionDelayMs: number }
  continuity: { preserveAcrossScenes: boolean; lastUpdatedAt: string }
}

export function mergeCharacterDNA(base: CharacterBehaviorDNA, updates: Partial<CharacterBehaviorDNA>, updatedAt: string): CharacterBehaviorDNA {
  return {
    ...base, ...updates,
    breathing: { ...base.breathing, ...updates.breathing },
    movement: { ...base.movement, ...updates.movement },
    speech: { ...base.speech, ...updates.speech },
    social: { ...base.social, ...updates.social },
    continuity: { ...base.continuity, ...updates.continuity, lastUpdatedAt: updatedAt },
  }
}

export type ReplacementStage = "detect" | "segment" | "track" | "replace" | "composite" | "qa" | "export"
export const REPLACEMENT_PIPELINE: readonly ReplacementStage[] = ["detect","segment","track","replace","composite","qa","export"]

export interface VideoReplacementJob {
  id: string
  sourceAssetId: string
  replacementAssetId: string
  targetLabel: string
  stage: ReplacementStage
  requiresReview: true
  status: "draft" | "processing" | "review" | "approved" | "failed"
}

export function createVideoReplacementJob(input: Omit<VideoReplacementJob,"stage"|"requiresReview"|"status">): VideoReplacementJob {
  return { ...input, stage: "detect", requiresReview: true, status: "draft" }
}

export function advanceReplacementStage(job: VideoReplacementJob): VideoReplacementJob {
  const index = REPLACEMENT_PIPELINE.indexOf(job.stage)
  if (index < 0 || index === REPLACEMENT_PIPELINE.length - 1) return { ...job, status: "review" }
  return { ...job, stage: REPLACEMENT_PIPELINE[index + 1], status: "processing" }
}

export type TrackClass = "character" | "clothing" | "hair" | "hand" | "prop" | "environment"
export interface FrameAnnotation {
  frame: number
  class: TrackClass
  instanceId: string
  confidence: number
  maskRef?: string
  keypoints?: Array<{ name: string; x: number; y: number; confidence: number }>
}
export interface VideoTrack {
  trackId: string
  class: TrackClass
  instanceId: string
  frameStart: number
  frameEnd: number
  annotations: FrameAnnotation[]
  source: "model" | "human" | "hybrid"
  confidence: number
  approved: boolean
}
export function validateTrack(track: VideoTrack): string[] {
  const warnings: string[] = []
  if (track.frameEnd < track.frameStart) warnings.push("Track frame range is invalid.")
  if (!track.annotations.length) warnings.push("Track contains no frame annotations.")
  if (track.confidence < 0.5) warnings.push("Track confidence is below the recommended threshold.")
  return warnings
}

export type VoiceSyncMode = "lip-sync" | "phoneme-driven" | "viseme-driven"
export interface VoiceSyncTrack { startMs: number; endMs: number; phoneme?: string; viseme?: string; confidence: number }
export function isVoiceSyncTrackUsable(track: VoiceSyncTrack): boolean {
  return track.endMs > track.startMs && track.confidence >= 0.7
}
