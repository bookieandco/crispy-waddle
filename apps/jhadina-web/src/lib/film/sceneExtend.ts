export type SceneExtendLength = 2 | 4 | 8 | number

export type SceneContinuityPacket = {
  sourceClipId: string
  durationSeconds: number
  endFrameAsset?: string
  referenceFrames?: string[]
  motionDirection?: string
  cameraMotion?: string
  lightingProfile?: string
  colorProfile?: string
  sceneDescription?: string
  subjectDescription?: string
  depthMapAsset?: string
  poseMapAsset?: string
  edgeMapAsset?: string
  audioAmbienceAsset?: string
}

export type SceneExtendRequest = {
  clipId: string
  extendSeconds: SceneExtendLength
  continuity: SceneContinuityPacket
  prompt?: string
}

export type SceneExtendJob = SceneExtendRequest & {
  id: string
  status: "DRAFT" | "GENERATING" | "READY_FOR_REVIEW" | "APPROVED" | "REJECTED"
  createdAt: string
  generatedAsset?: string
  confidence?: number
  seamScore?: number
}

/**
 * Creates the provider-neutral request used by the Film Generator.
 * Video generation, ControlNet conditioning, and Premiere integration are
 * intentionally adapters so the UI/core does not depend on one provider.
 */
export function createSceneExtendJob(input: SceneExtendRequest): SceneExtendJob {
  const seconds = Number(input.extendSeconds)
  if (!input.clipId) throw new Error("clipId is required")
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) {
    throw new Error("extendSeconds must be between 0 and 30 seconds")
  }
  if (!input.continuity.endFrameAsset && !input.continuity.referenceFrames?.length) {
    throw new Error("A final frame or reference frame window is required for continuity")
  }

  return {
    ...input,
    id: `scene_extend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    extendSeconds: seconds,
    status: "DRAFT",
    createdAt: new Date().toISOString(),
  }
}

export function buildGenerationPrompt(input: SceneExtendRequest): string {
  const c = input.continuity
  return [
    `Continue the video naturally for ${input.extendSeconds} seconds.`,
    "Start exactly from the final visible moment; do not restart the scene.",
    c.sceneDescription && `Scene: ${c.sceneDescription}`,
    c.subjectDescription && `Subject continuity: ${c.subjectDescription}`,
    c.motionDirection && `Motion direction: ${c.motionDirection}`,
    c.cameraMotion && `Camera continuity: ${c.cameraMotion}`,
    c.lightingProfile && `Lighting continuity: ${c.lightingProfile}`,
    c.colorProfile && `Color continuity: ${c.colorProfile}`,
    input.prompt && `Creative direction: ${input.prompt}`,
    "Preserve identity, geometry, wardrobe, environment, camera language, lighting and temporal continuity.",
    "Avoid sudden cuts, duplicated motion, frozen subjects, new identities, or unexplained changes.",
  ].filter(Boolean).join("\n")
}

export type SceneExtendProvider = {
  generate(request: SceneExtendRequest & { prompt: string }): Promise<{ asset: string }>
}

export type PremiereSequenceAdapter = {
  appendClip(input: { sourceClipId: string; generatedAsset: string }): Promise<{ sequenceId: string; clipId: string }>
}
