import type { SharkExperienceWeight } from './experience-ledger'

export type SharkExperienceAggregate = {
  experienceCount: number
  totalWeight: number
  weightedOutcome: number
  weightedConfidence: number
  evidenceCoverage: number
  experienceIds: string[]
}

export function aggregateSharkExperiences(experiences: SharkExperienceWeight[]): SharkExperienceAggregate {
  const usable = experiences.filter(e => e.provenanceComplete && e.weight > 0)
  const totalWeight = usable.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight === 0) return { experienceCount: 0, totalWeight: 0, weightedOutcome: 0, weightedConfidence: 0, evidenceCoverage: 0, experienceIds: [] }
  return {
    experienceCount: usable.length,
    totalWeight,
    weightedOutcome: usable.reduce((sum, e) => sum + e.outcomeScore * e.weight, 0) / totalWeight,
    weightedConfidence: usable.reduce((sum, e) => sum + e.confidence * e.weight, 0) / totalWeight,
    evidenceCoverage: Math.min(1, usable.length / 10),
    experienceIds: usable.map(e => e.experienceId),
  }
}
