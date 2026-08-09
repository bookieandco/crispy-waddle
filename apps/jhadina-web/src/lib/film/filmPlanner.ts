export type FilmShot = {
  id: string
  sceneId: string
  order: number
  durationSeconds: number
  purpose: string
  prompt: string
  continuityFromShotId?: string
  status: "PLANNED" | "GENERATING" | "REVIEW" | "APPROVED" | "REJECTED"
}

export type FilmScene = {
  id: string
  title: string
  durationSeconds: number
  shots: FilmShot[]
}

export type FilmPlan = {
  id: string
  title: string
  targetDurationSeconds: number
  scenes: FilmScene[]
}

export function buildFilmPlan(input: {
  id: string
  title: string
  targetDurationSeconds: number
  sceneTitles: string[]
}): FilmPlan {
  if (!input.sceneTitles.length) throw new Error("At least one scene is required")
  if (!Number.isFinite(input.targetDurationSeconds) || input.targetDurationSeconds <= 0) {
    throw new Error("targetDurationSeconds must be greater than zero")
  }

  const sceneCount = input.sceneTitles.length
  const baseSceneDuration = input.targetDurationSeconds / sceneCount
  const scenes = input.sceneTitles.map((title, index) => {
    const sceneId = `scene_${index + 1}`
    const shotCount = Math.max(2, Math.ceil(baseSceneDuration / 8))
    const shotDuration = baseSceneDuration / shotCount
    const shots: FilmShot[] = Array.from({ length: shotCount }, (_, shotIndex) => ({
      id: `${sceneId}_shot_${shotIndex + 1}`,
      sceneId,
      order: shotIndex + 1,
      durationSeconds: Number(shotDuration.toFixed(2)),
      purpose: shotIndex === 0 ? "Establish continuity" : "Advance the scene",
      prompt: `Generate shot ${shotIndex + 1} for ${title}; continue naturally from the previous shot.`,
      continuityFromShotId: shotIndex > 0 ? `${sceneId}_shot_${shotIndex}` : undefined,
      status: "PLANNED",
    }))
    return { id: sceneId, title, durationSeconds: Number(baseSceneDuration.toFixed(2)), shots }
  })

  return { id: input.id, title: input.title, targetDurationSeconds: input.targetDurationSeconds, scenes }
}

export function planFiveMinuteFilm(input: { id: string; title: string; sceneTitles: string[] }): FilmPlan {
  return buildFilmPlan({ ...input, targetDurationSeconds: 300 })
}

export function filmDurationSeconds(plan: FilmPlan): number {
  return plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)
}
