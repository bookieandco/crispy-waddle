export type SharkBeliefVersion = Readonly<{
  beliefId: string
  version: number
  confidence: number
  updateId: string
  proposalId: string
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
}>

export type SharkBeliefHistory = Readonly<{
  beliefId: string
  versions: readonly SharkBeliefVersion[]
}>

export function appendSharkBeliefVersion(input: {
  history: SharkBeliefHistory
  confidence: number
  updateId: string
  proposalId: string
  supportingExperienceIds: string[]
  conflictingExperienceIds: string[]
}): SharkBeliefHistory {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error('confidence must be between 0 and 1')
  if (!input.updateId.trim() || !input.proposalId.trim()) throw new Error('update and proposal IDs are required')
  const versions = input.history.versions
  const last = versions.at(-1)
  if (last && (input.updateId === last.updateId || input.proposalId === last.proposalId)) throw new Error('duplicate belief update')
  const version = (last?.version ?? 0) + 1
  const next: SharkBeliefVersion = Object.freeze({
    beliefId: input.history.beliefId,
    version,
    confidence: input.confidence,
    updateId: input.updateId,
    proposalId: input.proposalId,
    supportingExperienceIds: Object.freeze([...new Set(input.supportingExperienceIds)]),
    conflictingExperienceIds: Object.freeze([...new Set(input.conflictingExperienceIds)]),
  })
  return Object.freeze({ beliefId: input.history.beliefId, versions: Object.freeze([...versions, next]) })
}

export function getCurrentSharkBeliefVersion(history: SharkBeliefHistory): SharkBeliefVersion | undefined {
  return history.versions.at(-1)
}
