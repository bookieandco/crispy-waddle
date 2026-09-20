import type { CommercialDealGate } from './commercial-deal-gate.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'

export type ComplianceCheckKind =
  | 'solicitation_terms'
  | 'subcontracting_limitations'
  | 'set_aside_eligibility'
  | 'size_status'
  | 'teaming_rules'
  | 'organizational_conflict'
  | 'representations_certifications'
  | 'security'
  | 'license'
  | 'insurance'
  | 'bonding'
  | 'labor'
  | 'other'

export type ComplianceCheckStatus = 'pending' | 'passed' | 'failed' | 'not_applicable'

export type ComplianceCheck = {
  id: string
  kind: ComplianceCheckKind
  status: ComplianceCheckStatus
  required: boolean
  evidenceRefs: string[]
  sourceRefs: string[]
  notes: string[]
}

export type EngagementReadinessStatus =
  | 'blocked'
  | 'compliance_review'
  | 'ready_for_human_approval'
  | 'human_approved'

export type EngagementReadinessGate = {
  opportunityId: string
  status: EngagementReadinessStatus
  requiredCheckKinds: ComplianceCheckKind[]
  checks: ComplianceCheck[]
  blockers: string[]
  warnings: string[]
  approvalRef?: string
  outreachDraftAllowed: boolean
  negotiationPrepAllowed: boolean
  outboundSendAuthorized: false
  contractExecutionAuthorized: false
}

const uniq = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]

function requiredKinds(plan: FulfillmentPlan): ComplianceCheckKind[] {
  const kinds: ComplianceCheckKind[] = [
    'solicitation_terms',
    'representations_certifications',
    'organizational_conflict',
  ]

  if (plan.structure === 'prime_with_subcontractor') {
    kinds.push('subcontracting_limitations', 'teaming_rules')
  }
  if (plan.structure === 'teaming') {
    kinds.push('teaming_rules', 'size_status')
  }

  return uniq(kinds) as ComplianceCheckKind[]
}

export function evaluateEngagementReadiness(
  plan: FulfillmentPlan,
  commercial: CommercialDealGate,
  checks: ComplianceCheck[],
  options: { approvalRef?: string } = {},
): EngagementReadinessGate {
  if (commercial.opportunityId !== plan.opportunityId) {
    throw new Error('Commercial gate opportunity does not match fulfillment plan')
  }

  const requiredCheckKinds = requiredKinds(plan)
  const blockers = [...plan.blockers, ...commercial.blockers]
  const warnings = [...commercial.warnings]
  const byKind = new Map<ComplianceCheckKind, ComplianceCheck[]>()

  for (const check of checks) {
    const group = byKind.get(check.kind) ?? []
    group.push(check)
    byKind.set(check.kind, group)
    if (check.status === 'failed') blockers.push(`Compliance check failed: ${check.kind}`)
    if (check.status === 'passed' && check.required && check.evidenceRefs.length === 0) {
      blockers.push(`Passed required compliance check lacks evidence: ${check.kind}`)
    }
  }

  for (const kind of requiredCheckKinds) {
    const candidates = byKind.get(kind) ?? []
    const passed = candidates.some((check) => check.status === 'passed' && check.evidenceRefs.length > 0)
    const failed = candidates.some((check) => check.status === 'failed')
    if (!failed && !passed) warnings.push(`Required compliance check is unresolved: ${kind}`)
  }

  if (commercial.status !== 'commercially_viable') {
    blockers.push('Commercial gate is not commercially viable.')
  }
  if (plan.uncoveredRequirementIds.length > 0) {
    blockers.push('Fulfillment plan still has uncovered required requirements.')
  }

  const unresolvedRequired = requiredCheckKinds.filter((kind) => {
    const candidates = byKind.get(kind) ?? []
    return !candidates.some((check) => check.status === 'passed' && check.evidenceRefs.length > 0)
  })

  const approvalRef = options.approvalRef?.trim() || undefined
  let status: EngagementReadinessStatus = 'compliance_review'

  if (blockers.length > 0) status = 'blocked'
  else if (unresolvedRequired.length > 0) status = 'compliance_review'
  else if (approvalRef) status = 'human_approved'
  else status = 'ready_for_human_approval'

  return {
    opportunityId: plan.opportunityId,
    status,
    requiredCheckKinds,
    checks,
    blockers: uniq(blockers),
    warnings: uniq(warnings),
    approvalRef,
    outreachDraftAllowed: status === 'human_approved',
    negotiationPrepAllowed: status === 'human_approved',
    outboundSendAuthorized: false,
    contractExecutionAuthorized: false,
  }
}

export function canPrepareProviderOutreach(gate: EngagementReadinessGate): boolean {
  return gate.status === 'human_approved' &&
    Boolean(gate.approvalRef) &&
    gate.blockers.length === 0 &&
    gate.outreachDraftAllowed &&
    gate.outboundSendAuthorized === false
}
