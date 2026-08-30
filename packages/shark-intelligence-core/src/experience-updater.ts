import type { SharkExperienceWeight } from './experience-ledger'

export type SharkExperienceUpdate = {
  updatedExperiences: SharkExperienceWeight[]
  reinforcedIds: string[]
  contradictedIds: string[]
  unchangedIds: string[]
  newExperience: SharkExperienceWeight
  version: number
}

export function updateSharkExperienceWeights(input: {
  history: SharkExperienceWeight[]
  newExperience: SharkExperienceWeight
  reinforcementFactor?: number
  contradictionFactor?: number
}): SharkExperienceUpdate {
  const reinforcementFactor = input.reinforcementFactor ?? 0.08
  const contradictionFactor = input.contradictionFactor ?? 0.12
  const sameSituation = (e: SharkExperienceWeight) => e.strategyId === input.newExperience.strategyId && e.scenarioId === input.newExperience.scenarioId
  const agrees = (e: SharkExperienceWeight) => Math.sign(e.outcomeScore) === Math.sign(input.newExperience.outcomeScore)
  const updatedExperiences = input.history.map(e => {
    if (!sameSituation(e)) return e
    const factor = agrees(e) ? reinforcementFactor : -contradictionFactor
    return { ...e, weight: Math.max(0, Math.min(1, e.weight * (1 + factor))) }
  })
  const reinforcedIds = input.history.filter(e => sameSituation(e) && agrees(e)).map(e => e.experienceId)
  const contradictedIds = input.history.filter(e => sameSituation(e) && !agrees(e)).map(e => e.experienceId)
  const unchangedIds = input.history.filter(e => !sameSituation(e)).map(e => e.experienceId)
  return { updatedExperiences, reinforcedIds, contradictedIds, unchangedIds, newExperience: input.newExperience, version: input.history.length + 1 }
}
