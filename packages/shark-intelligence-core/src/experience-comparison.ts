import type { SharkExperience, SharkExperienceWeight } from './experience-ledger'

export type SharkExperienceComparison = {
  candidateExperience: SharkExperience
  matches: Array<SharkExperienceWeight & { similarity: number }>
  aggregateSimilarity: number
  reinforcingWeight: number
  contradictingWeight: number
  status: 'REINFORCED' | 'CONTRADICTED' | 'MIXED' | 'NO_COMPARABLE_EXPERIENCE'
}

export function compareSharkExperienceAgainstHistory(input: {
  candidate: SharkExperience
  history: SharkExperienceWeight[]
  minimumSimilarity?: number
}): SharkExperienceComparison {
  const threshold = input.minimumSimilarity ?? 0.5
  const matches = input.history
    .map(experience => ({
      ...experience,
      similarity: Math.max(0, 1 - (Math.abs(experience.outcomeScore - input.candidate.outcomeScore) + (experience.strategyId === input.candidate.strategyId ? 0 : 1) + (experience.scenarioId === input.candidate.scenarioId ? 0 : 0.5)) / 2.5),
    }))
    .filter(match => match.similarity >= threshold)

  if (matches.length === 0) return { candidateExperience: input.candidate, matches: [], aggregateSimilarity: 0, reinforcingWeight: 0, contradictingWeight: 0, status: 'NO_COMPARABLE_EXPERIENCE' }

  const reinforcingWeight = matches.filter(m => Math.sign(m.outcomeScore) === Math.sign(input.candidate.outcomeScore)).reduce((sum, m) => sum + m.weight * m.similarity, 0)
  const contradictingWeight = matches.filter(m => Math.sign(m.outcomeScore) !== Math.sign(input.candidate.outcomeScore)).reduce((sum, m) => sum + m.weight * m.similarity, 0)
  const total = reinforcingWeight + contradictingWeight
  const aggregateSimilarity = matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
  const status = reinforcingWeight > contradictingWeight * 1.25 ? 'REINFORCED' : contradictingWeight > reinforcingWeight * 1.25 ? 'CONTRADICTED' : 'MIXED'
  return { candidateExperience: input.candidate, matches, aggregateSimilarity, reinforcingWeight, contradictingWeight, status }
}
