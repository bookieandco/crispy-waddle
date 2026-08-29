export type SharkPaperDecisionGateInput = {
  assessmentId: string
  opportunityId: string
  strategyId: string
  evidenceComplete: boolean
  riskWithinLimits: boolean
  assessmentFresh: boolean
  provenanceComplete: boolean
}

export type SharkPaperDecisionDisposition = 'approve' | 'reject' | 'request_more_evidence' | 'defer'

export type SharkPaperDecisionGateResult = {
  assessmentId: string
  opportunityId: string
  strategyId: string
  disposition: SharkPaperDecisionDisposition
  reasons: string[]
  simulated: true
}

export function evaluateSharkPaperDecisionGate(input: SharkPaperDecisionGateInput): SharkPaperDecisionGateResult {
  if (!input.assessmentId) throw new Error('assessment id is required')
  if (!input.opportunityId) throw new Error('opportunity id is required')
  if (!input.strategyId) throw new Error('strategy id is required')

  const reasons: string[] = []
  if (!input.provenanceComplete) reasons.push('incomplete provenance')
  if (!input.assessmentFresh) reasons.push('stale assessment')
  if (!input.riskWithinLimits) reasons.push('risk limits breached')
  if (!input.evidenceComplete) reasons.push('incomplete evidence')

  let disposition: SharkPaperDecisionDisposition
  if (!input.provenanceComplete || !input.assessmentFresh) disposition = 'defer'
  else if (!input.evidenceComplete) disposition = 'request_more_evidence'
  else if (!input.riskWithinLimits) disposition = 'reject'
  else disposition = 'approve'

  return {
    assessmentId: input.assessmentId,
    opportunityId: input.opportunityId,
    strategyId: input.strategyId,
    disposition,
    reasons,
    simulated: true,
  }
}
