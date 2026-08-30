export type SharkExperience = {
  experienceId: string
  occurredAt: string
  scenarioId: string
  strategyId: string
  outcomeScore: number
  confidence: number
  provenanceComplete: boolean
}

export type SharkExperienceWeight = SharkExperience & {
  weight: number
  relevance: number
  recency: number
  outcomeQuality: number
}

export function weightSharkExperience(experience: SharkExperience, now: Date, relevance: number): SharkExperienceWeight {
  if (!experience.experienceId.trim()) throw new Error('experience id is required')
  if (!Number.isFinite(relevance) || relevance < 0 || relevance > 1) throw new Error('relevance must be between 0 and 1')
  const occurred = new Date(experience.occurredAt)
  if (Number.isNaN(occurred.getTime())) throw new Error('experience occurredAt must be a valid date')
  const ageDays = Math.max(0, (now.getTime() - occurred.getTime()) / 86_400_000)
  const recency = 1 / (1 + ageDays / 30)
  const outcomeQuality = Math.max(0, Math.min(1, (experience.outcomeScore + 1) / 2))
  const weight = relevance * (0.45 * recency + 0.35 * outcomeQuality + 0.20 * Math.max(0, Math.min(1, experience.confidence)))
  return { ...experience, weight, relevance, recency, outcomeQuality }
}

export function weighAllSharkExperiences(experiences: SharkExperience[], now: Date, relevanceById: Record<string, number>): SharkExperienceWeight[] {
  return experiences.map(experience => weightSharkExperience(experience, now, relevanceById[experience.experienceId] ?? 0))
}
