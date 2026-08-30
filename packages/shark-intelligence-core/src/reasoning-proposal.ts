import type { SharkReasoningHandoff } from './knowledge-use-handoff'

export type SharkReasoningProposal = Readonly<{
  proposalId: string
  queryNodeId: string
  conclusion: string
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
  evidenceStrength: number
  status: 'PROPOSED'
  historicalEvidencePreserved: true
}>

export function createSharkReasoningProposal(input: {
  proposalId: string
  conclusion: string
  handoff: SharkReasoningHandoff
}): SharkReasoningProposal {
  if (!input.proposalId.trim() || !input.conclusion.trim()) throw new Error('proposal identity and conclusion are required')
  const supportingExperienceIds = Object.freeze([...input.handoff.experienceIds].filter(id => !input.handoff.eligibility.reason.includes('contradiction') && id))
  return Object.freeze({
    proposalId: input.proposalId,
    queryNodeId: input.handoff.queryNodeId,
    conclusion: input.conclusion,
    supportingExperienceIds,
    conflictingExperienceIds: Object.freeze([...input.handoff.experienceIds]),
    evidenceStrength: input.handoff.evidenceStrength,
    status: 'PROPOSED' as const,
    historicalEvidencePreserved: true as const,
  })
}
