export type MoneyActionKind =
  | 'BID'
  | 'APPLY'
  | 'CONTACT'
  | 'PARTNER'
  | 'SUBCONTRACT'
  | 'GET_LICENSE'
  | 'REGISTER_AS_VENDOR'
  | 'MONITOR_RECOMPETE'

export type MoneyAction = {
  opportunityId: string
  kind: MoneyActionKind
  rationale: string
  requiredEvidenceIds: string[]
  confidence: number
}

export type MoneyActionInputs = {
  opportunityId: string
  evidenceIds: string[]
  verified: boolean
  brokerability: number
  deadlineKnown: boolean
  eligibilityKnown: boolean
  licenseRequired?: boolean
  subcontractSignal?: boolean
  lifecycleSignal?: boolean
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Compiles an opportunity into a bounded next action. It does not execute the
 * action or infer eligibility; those remain explicit inputs and human-review
 * gates at the application boundary.
 */
export function compileMoneyAction(input: MoneyActionInputs): MoneyAction | null {
  if (!input.verified || input.evidenceIds.length === 0) return null

  let kind: MoneyActionKind
  let rationale: string

  if (input.licenseRequired && !input.eligibilityKnown) {
    kind = 'GET_LICENSE'
    rationale = 'licensing is required and eligibility is not yet established'
  } else if (input.subcontractSignal && input.brokerability >= 60) {
    kind = 'SUBCONTRACT'
    rationale = 'subcontracting signal and brokerability support a partner-led path'
  } else if (input.brokerability >= 70) {
    kind = 'PARTNER'
    rationale = 'opportunity has strong delegated-fulfillment potential'
  } else if (!input.eligibilityKnown) {
    kind = 'CONTACT'
    rationale = 'eligibility needs confirmation before submission'
  } else if (input.deadlineKnown) {
    kind = 'BID'
    rationale = 'verified opportunity has a known submission window'
  } else if (input.lifecycleSignal) {
    kind = 'MONITOR_RECOMPETE'
    rationale = 'lifecycle evidence supports monitoring for the next procurement event'
  } else {
    kind = 'REGISTER_AS_VENDOR'
    rationale = 'verified demand exists but a direct submission path is not yet established'
  }

  const confidence = Math.round(
    (input.verified ? 40 : 0) +
      (input.evidenceIds.length > 0 ? 20 : 0) +
      (input.eligibilityKnown ? 20 : 0) +
      clamp(input.brokerability) * 0.20,
  )

  return {
    opportunityId: input.opportunityId,
    kind,
    rationale,
    requiredEvidenceIds: [...input.evidenceIds],
    confidence: clamp(confidence),
  }
}
