export type SharkReadinessStatus = 'NOT_READY' | 'INSUFFICIENT_EVIDENCE' | 'READY_FOR_LIVE_REVIEW'

export type SharkReadinessEvidence = {
  knowledgeValidated: boolean
  confidenceCalibrated: boolean
  outOfSampleValidated: boolean
  riskReconciled: boolean
  accountingReconciled: boolean
  attributionReconciled: boolean
  regressionProtectionPassed: boolean
  provenanceComplete: boolean
  humanReviewComplete: boolean
  paperOnly: true
}

export type SharkReadinessCertification = SharkReadinessEvidence & {
  status: SharkReadinessStatus
  reasons: string[]
  simulated: true
}

export function certifySharkPaperReadiness(evidence: SharkReadinessEvidence): SharkReadinessCertification {
  const reasons: string[] = []
  const checks: Array<[keyof SharkReadinessEvidence, string]> = [
    ['knowledgeValidated', 'knowledge is not validated'],
    ['confidenceCalibrated', 'confidence is not calibrated'],
    ['outOfSampleValidated', 'out-of-sample validation is incomplete'],
    ['riskReconciled', 'risk reconciliation is incomplete'],
    ['accountingReconciled', 'accounting reconciliation is incomplete'],
    ['attributionReconciled', 'attribution reconciliation is incomplete'],
    ['regressionProtectionPassed', 'learning regression protection has not passed'],
    ['provenanceComplete', 'provenance is incomplete'],
    ['humanReviewComplete', 'human review is incomplete'],
  ]
  for (const [key, reason] of checks) if (!evidence[key]) reasons.push(reason)

  let status: SharkReadinessStatus
  if (reasons.length === 0) status = 'READY_FOR_LIVE_REVIEW'
  else if (!evidence.knowledgeValidated || !evidence.confidenceCalibrated || !evidence.outOfSampleValidated) status = 'INSUFFICIENT_EVIDENCE'
  else status = 'NOT_READY'

  return { ...evidence, status, reasons, simulated: true }
}
