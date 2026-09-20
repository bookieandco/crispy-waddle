import type { CommercialDealGate } from './commercial-deal-gate.js'
import type { EngagementReadinessGate } from './engagement-readiness.js'
import type { FulfillmentPlan, FulfillmentPlanAssignment } from './fulfillment-plan.js'

export type ProviderOutreachPacket = {
  id: string
  opportunityId: string
  providerId: string
  role: FulfillmentPlanAssignment['role']
  requirementIds: string[]
  evidenceRefs: string[]
  subject: string
  draftBody: string
  diligenceQuestions: string[]
  negotiationPoints: string[]
  commercialSummary: {
    structure: CommercialDealGate['structure']
    modeledGrossRevenue: number
    modeledProviderCost?: number
    modeledMarginPercent: number
  }
  approvalRef: string
  draftOnly: true
  sendAuthorized: false
  contractAuthorized: false
}

export type NegotiationPacket = {
  opportunityId: string
  structure: CommercialDealGate['structure']
  providerPackets: ProviderOutreachPacket[]
  openQuestions: string[]
  protectedAssertions: string[]
  approvalRef: string
  negotiationPrepOnly: true
  sendAuthorized: false
  signatureAuthorized: false
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function roleLabel(role: FulfillmentPlanAssignment['role']): string {
  return role === 'lead' ? 'lead fulfillment' :
    role === 'subcontractor' ? 'subcontractor' :
    role === 'teaming_partner' ? 'teaming partner' :
    'specialist vendor'
}

export function buildProviderOutreachPacket(
  plan: FulfillmentPlan,
  commercial: CommercialDealGate,
  readiness: EngagementReadinessGate,
  assignment: FulfillmentPlanAssignment,
  options: {
    providerName?: string
    opportunityTitle?: string
    providerCost?: number
    additionalQuestions?: string[]
    additionalNegotiationPoints?: string[]
  } = {},
): ProviderOutreachPacket {
  if (commercial.opportunityId !== plan.opportunityId || readiness.opportunityId !== plan.opportunityId) {
    throw new Error('Outreach packet inputs must reference the same opportunity')
  }
  if (!plan.assignments.some((item) => item.providerId === assignment.providerId)) {
    throw new Error('Provider assignment is not part of the fulfillment plan')
  }
  if (readiness.status !== 'human_approved' || !readiness.approvalRef) {
    throw new Error('Human-approved engagement readiness is required before outreach drafting')
  }
  if (!readiness.outreachDraftAllowed || readiness.blockers.length > 0) {
    throw new Error('Engagement readiness does not permit outreach drafting')
  }

  const providerName = options.providerName?.trim() || assignment.providerId
  const opportunityTitle = options.opportunityTitle?.trim() || plan.opportunityId
  const role = roleLabel(assignment.role)
  const diligenceQuestions = uniq([
    'Can you confirm current availability and delivery capacity for the proposed scope?',
    'Can you confirm the capabilities, credentials, registrations, insurance, bonding, and clearances applicable to this scope?',
    'Can you provide current evidence for any solicitation-specific eligibility representations we would rely on?',
    'Are there conflicts, exclusivity commitments, teaming restrictions, or other limitations that could affect participation?',
    'What commercial terms, schedule assumptions, and dependencies would you require before committing?',
    ...(options.additionalQuestions ?? []),
  ])
  const negotiationPoints = uniq([
    `Proposed role: ${role}`,
    `Proposed requirement scope: ${assignment.requirementIds.join(', ')}`,
    'Confirm division of work and responsibility before any capability is represented in a bid.',
    'Confirm pricing, payment milestones, change control, confidentiality, IP/data rights, and termination terms.',
    'Confirm solicitation-specific subcontracting/team compliance before agreement.',
    ...(options.additionalNegotiationPoints ?? []),
  ])

  const draftBody = [
    `Hello ${providerName},`,
    '',
    `We are evaluating a potential ${role} relationship for ${opportunityTitle}.`,
    `The proposed scope currently maps to: ${assignment.requirementIds.join(', ')}.`,
    '',
    'This is an exploratory discussion only. No award, subcontract, exclusivity, or commitment is being represented by this draft.',
    'Before moving forward, we would need to confirm capability evidence, availability, solicitation-specific eligibility, scope, and commercial terms.',
    '',
    'If there is mutual interest, the next step would be a diligence and negotiation discussion subject to the applicable procurement requirements and written approvals.',
  ].join('\n')

  return {
    id: `${plan.opportunityId}:outreach:${assignment.providerId}`,
    opportunityId: plan.opportunityId,
    providerId: assignment.providerId,
    role: assignment.role,
    requirementIds: [...assignment.requirementIds],
    evidenceRefs: [...assignment.evidenceRefs],
    subject: `Potential ${role} discussion — ${opportunityTitle}`,
    draftBody,
    diligenceQuestions,
    negotiationPoints,
    commercialSummary: {
      structure: commercial.structure,
      modeledGrossRevenue: commercial.economics.grossRevenue,
      modeledProviderCost: options.providerCost,
      modeledMarginPercent: commercial.economics.estimatedMarginPercent,
    },
    approvalRef: readiness.approvalRef,
    draftOnly: true,
    sendAuthorized: false,
    contractAuthorized: false,
  }
}

export function buildNegotiationPacket(
  plan: FulfillmentPlan,
  commercial: CommercialDealGate,
  readiness: EngagementReadinessGate,
  options: {
    providerNames?: Record<string, string>
    providerCosts?: Record<string, number>
    opportunityTitle?: string
  } = {},
): NegotiationPacket {
  if (readiness.status !== 'human_approved' || !readiness.approvalRef || !readiness.negotiationPrepAllowed) {
    throw new Error('Human-approved negotiation readiness is required')
  }

  const providerPackets = plan.assignments.map((assignment) => buildProviderOutreachPacket(
    plan,
    commercial,
    readiness,
    assignment,
    {
      providerName: options.providerNames?.[assignment.providerId],
      providerCost: options.providerCosts?.[assignment.providerId],
      opportunityTitle: options.opportunityTitle,
    },
  ))

  return {
    opportunityId: plan.opportunityId,
    structure: commercial.structure,
    providerPackets,
    openQuestions: uniq([
      ...commercial.warnings,
      ...commercial.assumptions,
      'Confirm final provider pricing and scope allocation.',
      'Confirm solicitation-specific performance-of-work and subcontracting limitations.',
      'Confirm all relied-upon eligibility and credential evidence is current at submission.',
    ]),
    protectedAssertions: [
      'Do not represent a provider capability as ours without an executed agreement and permitted proposal treatment.',
      'Do not state that an award, subcontract, exclusivity, or government approval exists unless independently evidenced.',
      'Do not send outreach or execute a contract from this packet; separate authorization is required.',
    ],
    approvalRef: readiness.approvalRef,
    negotiationPrepOnly: true,
    sendAuthorized: false,
    signatureAuthorized: false,
  }
}
