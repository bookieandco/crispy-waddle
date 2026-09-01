import type { Opportunity } from './opportunity.js'
import { isCompleteVerification } from './verification.js'

export type OpportunityValidationIssue = {
  code: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

export type OpportunityValidationResult = {
  valid: boolean
  ready: boolean
  issues: OpportunityValidationIssue[]
}

export function validateOpportunity(opportunity: Opportunity): OpportunityValidationResult {
  const issues: OpportunityValidationIssue[] = []

  if (!opportunity.id) issues.push({ code: 'missing_id', field: 'id', message: 'Opportunity ID is required.', severity: 'error' })
  if (!opportunity.title) issues.push({ code: 'missing_title', field: 'title', message: 'Opportunity title is required.', severity: 'error' })
  if (!opportunity.sourceUrl) issues.push({ code: 'missing_source_url', field: 'sourceUrl', message: 'Source URL is required.', severity: 'error' })
  if (!opportunity.sourceName) issues.push({ code: 'missing_source_name', field: 'sourceName', message: 'Source name is required.', severity: 'error' })
  if (opportunity.claims.length === 0) issues.push({ code: 'missing_claims', field: 'claims', message: 'At least one provenance claim is required.', severity: 'error' })
  if (opportunity.evidence.length === 0) issues.push({ code: 'missing_evidence', field: 'evidence', message: 'At least one evidence record is required.', severity: 'error' })
  if (opportunity.sourceConfidence < 0 || opportunity.sourceConfidence > 1) issues.push({ code: 'invalid_source_confidence', field: 'sourceConfidence', message: 'Source confidence must be between 0 and 1.', severity: 'error' })

  for (const claim of opportunity.claims) {
    if (claim.confidence < 0 || claim.confidence > 1) issues.push({ code: 'invalid_claim_confidence', field: `claims.${claim.field}`, message: 'Claim confidence must be between 0 and 1.', severity: 'error' })
  }

  if (opportunity.verificationStatus === 'verified' && !isCompleteVerification(opportunity.verificationDecision)) {
    issues.push({
      code: 'verified_without_complete_decision',
      field: 'verificationDecision',
      message: 'A verified opportunity requires a complete evidence-backed verification decision.',
      severity: 'error',
    })
  }

  const valid = issues.every((issue) => issue.severity !== 'error')
  const ready = valid && isCompleteVerification(opportunity.verificationDecision) && opportunity.status === 'ready'

  return { valid, ready, issues }
}
