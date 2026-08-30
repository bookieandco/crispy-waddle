export type SharkBeliefUpdate = Readonly<{
  updateId: string
  beliefId: string
  previousConfidence: number
  newConfidence: number
  proposalId: string
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
  validated: true
}>

export function applyValidatedSharkBeliefUpdate(input: {
  updateId: string
  beliefId: string
  previousConfidence: number
  newConfidence: number
  proposalId: string
  supportingExperienceIds: string[]
  conflictingExperienceIds: string[]
  validated: boolean
}): SharkBeliefUpdate {
  if (!input.validated) throw new Error('belief updates require validated evidence')
  for (const value of [input.previousConfidence, input.newConfidence]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('confidence must be between 0 and 1')
  }
  if (!input.updateId.trim() || !input.beliefId.trim() || !input.proposalId.trim()) throw new Error('update, belief, and proposal IDs are required')
  return Object.freeze({
    updateId: input.updateId,
    beliefId: input.beliefId,
    previousConfidence: input.previousConfidence,
    newConfidence: input.newConfidence,
    proposalId: input.proposalId,
    supportingExperienceIds: Object.freeze([...new Set(input.supportingExperienceIds)]),
    conflictingExperienceIds: Object.freeze([...new Set(input.conflictingExperienceIds)]),
    validated: true as const,
  })
}
