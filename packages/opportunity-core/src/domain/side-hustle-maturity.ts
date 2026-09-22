import type { Opportunity } from './opportunity.js'
import type { OpportunityOutcome } from './outcome.js'
import type { SideHustleExperiment, SideHustleExperimentEvaluation } from './side-hustle-experiment.js'
import {
  isSideHustleProfile,
  type SideHustleAutomationMaturity,
  type SideHustleProfile,
} from './side-hustles.js'

export type SideHustleMaturityPromotionDecision = 'eligible' | 'blocked'

export type SideHustleMaturityValidationRecord = {
  experiment: SideHustleExperiment
  evaluation: SideHustleExperimentEvaluation
}

export type SideHustleMaturityEvidence = {
  validationRecords: SideHustleMaturityValidationRecord[]
  outcomes: OpportunityOutcome[]
  workflowEvidenceRefs?: string[]
  aiAssistEvidenceRefs?: string[]
  automationRunEvidenceRefs?: string[]
  exceptionHandlingEvidenceRefs?: string[]
  monitoringEvidenceRefs?: string[]
  recoveryEvidenceRefs?: string[]
  humanOverrideEvidenceRefs?: string[]
  auditEvidenceRefs?: string[]
}

export type SideHustleMaturityPromotionAssessment = {
  opportunityId: string
  from: SideHustleAutomationMaturity
  to: SideHustleAutomationMaturity
  decision: SideHustleMaturityPromotionDecision
  successfulDeliveries: number
  validationPromotions: number
  evidenceRefs: string[]
  blockers: string[]
  reasons: string[]
  requiresHumanApproval: true
  authorizationEffect: 'NONE'
  assessedAt: string
}

export type SideHustleMaturityPromotionReceipt = {
  opportunityId: string
  from: SideHustleAutomationMaturity
  to: SideHustleAutomationMaturity
  approvalRef: string
  evidenceRefs: string[]
  assessedAt: string
  appliedAt: string
  authorizationEffect: 'NONE'
}

const MATURITY_ORDER: readonly SideHustleAutomationMaturity[] = [
  'unvalidated',
  'human_delivered',
  'ai_assisted',
  'workflow_automated',
  'exception_managed',
  'autonomous_cell',
]

type EvidenceKey =
  | 'workflowEvidenceRefs'
  | 'aiAssistEvidenceRefs'
  | 'automationRunEvidenceRefs'
  | 'exceptionHandlingEvidenceRefs'
  | 'monitoringEvidenceRefs'
  | 'recoveryEvidenceRefs'
  | 'humanOverrideEvidenceRefs'
  | 'auditEvidenceRefs'

type TargetRule = {
  minimumSuccessfulDeliveries: number
  requiredEvidence: Array<{ key: EvidenceKey; minimum: number; label: string }>
}

const TARGET_RULES: Record<Exclude<SideHustleAutomationMaturity, 'unvalidated'>, TargetRule> = {
  human_delivered: {
    minimumSuccessfulDeliveries: 1,
    requiredEvidence: [],
  },
  ai_assisted: {
    minimumSuccessfulDeliveries: 2,
    requiredEvidence: [
      { key: 'workflowEvidenceRefs', minimum: 1, label: 'documented reusable workflow' },
      { key: 'aiAssistEvidenceRefs', minimum: 1, label: 'AI-assisted delivery evidence' },
    ],
  },
  workflow_automated: {
    minimumSuccessfulDeliveries: 3,
    requiredEvidence: [
      { key: 'workflowEvidenceRefs', minimum: 1, label: 'documented reusable workflow' },
      { key: 'automationRunEvidenceRefs', minimum: 2, label: 'successful governed automation runs' },
      { key: 'humanOverrideEvidenceRefs', minimum: 1, label: 'tested human override path' },
      { key: 'auditEvidenceRefs', minimum: 1, label: 'automation audit evidence' },
    ],
  },
  exception_managed: {
    minimumSuccessfulDeliveries: 3,
    requiredEvidence: [
      { key: 'automationRunEvidenceRefs', minimum: 3, label: 'repeat governed automation runs' },
      { key: 'exceptionHandlingEvidenceRefs', minimum: 1, label: 'exception-handling evidence' },
      { key: 'monitoringEvidenceRefs', minimum: 1, label: 'runtime monitoring evidence' },
      { key: 'humanOverrideEvidenceRefs', minimum: 1, label: 'tested human override path' },
      { key: 'auditEvidenceRefs', minimum: 1, label: 'automation audit evidence' },
    ],
  },
  autonomous_cell: {
    minimumSuccessfulDeliveries: 5,
    requiredEvidence: [
      { key: 'automationRunEvidenceRefs', minimum: 5, label: 'repeat governed automation runs' },
      { key: 'exceptionHandlingEvidenceRefs', minimum: 2, label: 'exception-handling evidence' },
      { key: 'monitoringEvidenceRefs', minimum: 1, label: 'runtime monitoring evidence' },
      { key: 'recoveryEvidenceRefs', minimum: 1, label: 'tested recovery evidence' },
      { key: 'humanOverrideEvidenceRefs', minimum: 1, label: 'tested human override path' },
      { key: 'auditEvidenceRefs', minimum: 2, label: 'repeat audit evidence' },
    ],
  },
}

/**
 * Assesses whether a Side Hustle has enough observed process evidence to
 * advance exactly one automation-maturity stage.
 *
 * Maturity describes how repeatably the owning subsystem can deliver the
 * work. It never grants permission to contact, spend, publish, procure,
 * trade, submit, or otherwise execute an external action.
 */
export function assessSideHustleMaturityPromotion(input: {
  opportunity: Opportunity
  target: SideHustleAutomationMaturity
  evidence: SideHustleMaturityEvidence
  assessedAt: string
}): SideHustleMaturityPromotionAssessment {
  const profile = readProfile(input.opportunity)
  requireDate(input.assessedAt, 'assessedAt')

  const fromIndex = MATURITY_ORDER.indexOf(profile.automationMaturity)
  const targetIndex = MATURITY_ORDER.indexOf(input.target)
  if (targetIndex < 0) throw new Error('Unknown Side Hustle maturity target')
  if (profile.role === 'capability') {
    throw new Error('Capability-only profiles use owning-domain maturity, not Business Factory business maturity')
  }

  const blockers: string[] = []
  const reasons: string[] = []

  if (targetIndex !== fromIndex + 1) {
    blockers.push(
      targetIndex <= fromIndex
        ? 'Maturity promotion must move forward exactly one stage.'
        : 'Maturity stages cannot be skipped.',
    )
  }

  const validationRecords = input.evidence.validationRecords.map((record) => {
    const { experiment, evaluation } = record
    requireDate(evaluation.evaluatedAt, 'validation evaluation evaluatedAt')
    if (experiment.status !== 'completed' || !experiment.completedAt) {
      throw new Error('Maturity evidence requires completed validation experiments')
    }
    requireDate(experiment.completedAt, 'validation experiment completedAt')
    if (experiment.opportunityId !== input.opportunity.id || evaluation.opportunityId !== input.opportunity.id) {
      throw new Error('Validation evidence does not belong to opportunity')
    }
    if (evaluation.experimentId !== experiment.id) {
      throw new Error('Validation evaluation does not match experiment')
    }
    if (
      Date.parse(evaluation.evaluatedAt) > Date.parse(input.assessedAt) ||
      Date.parse(experiment.completedAt) > Date.parse(input.assessedAt)
    ) {
      throw new Error('Maturity assessment cannot include future validation evidence')
    }
    return record
  })

  const outcomes = input.evidence.outcomes.map((outcome) => {
    requireDate(outcome.observedAt, 'outcome observedAt')
    if (outcome.opportunityId !== input.opportunity.id) {
      throw new Error('Outcome does not belong to opportunity')
    }
    if (Date.parse(outcome.observedAt) > Date.parse(input.assessedAt)) {
      throw new Error('Maturity assessment cannot include future outcome evidence')
    }
    return outcome
  })

  const validationPromotions = uniqueBy(
    validationRecords.filter(({ evaluation }) => evaluation.decision === 'promote'),
    ({ experiment }) => experiment.id,
  )
  const successfulDeliveries = uniqueBy(
    outcomes.filter((outcome) => outcome.result === 'won'),
    (outcome) => outcome.id,
  )

  if (validationPromotions.length === 0) {
    blockers.push('At least one promoted bounded validation experiment is required.')
  }

  const rule = targetIndex > 0
    ? TARGET_RULES[input.target as Exclude<SideHustleAutomationMaturity, 'unvalidated'>]
    : undefined

  if (rule && successfulDeliveries.length < rule.minimumSuccessfulDeliveries) {
    blockers.push(
      `Target ${input.target} requires at least ${rule.minimumSuccessfulDeliveries} evidence-backed successful deliver${rule.minimumSuccessfulDeliveries === 1 ? 'y' : 'ies'}; found ${successfulDeliveries.length}.`,
    )
  }

  if (rule) {
    for (const requirement of rule.requiredEvidence) {
      const refs = normalizedRefs(input.evidence[requirement.key])
      if (refs.length < requirement.minimum) {
        blockers.push(
          `Target ${input.target} requires ${requirement.label}: ${refs.length}/${requirement.minimum} evidence refs.`,
        )
      }
    }
  }

  const evidenceRefs = unique([
    ...validationPromotions.flatMap(({ experiment, evaluation }) => [
      ...experiment.evidenceRefs,
      ...evaluation.evidenceRefs,
    ]),
    ...successfulDeliveries.flatMap((outcome) => [
      ...outcome.evidenceRefs,
      ...(outcome.transactionRefs ?? []),
      ...(outcome.actionRef ? [outcome.actionRef] : []),
      ...(outcome.executionRef ? [outcome.executionRef] : []),
    ]),
    ...allControlRefs(input.evidence),
  ])

  if (evidenceRefs.length === 0) blockers.push('Maturity promotion requires evidence references.')

  if (blockers.length === 0) {
    reasons.push(
      `Forward-only maturity promotion ${profile.automationMaturity} -> ${input.target} has the required validation, delivery, and control evidence.`,
    )
  } else {
    reasons.push(...blockers)
  }
  reasons.push('Automation maturity is descriptive evidence only and grants no execution authority.')

  return {
    opportunityId: input.opportunity.id,
    from: profile.automationMaturity,
    to: input.target,
    decision: blockers.length === 0 ? 'eligible' : 'blocked',
    successfulDeliveries: successfulDeliveries.length,
    validationPromotions: validationPromotions.length,
    evidenceRefs,
    blockers,
    reasons,
    requiresHumanApproval: true,
    authorizationEffect: 'NONE',
    assessedAt: input.assessedAt,
  }
}

/**
 * Applies an already-eligible maturity assessment after explicit approval.
 * Only the Side Hustle profile maturity and audit metadata change.
 */
export function applySideHustleMaturityPromotion(input: {
  opportunity: Opportunity
  assessment: SideHustleMaturityPromotionAssessment
  approvalRef: string
  appliedAt: string
}): { opportunity: Opportunity; receipt: SideHustleMaturityPromotionReceipt } {
  const profile = readProfile(input.opportunity)
  requireText(input.approvalRef, 'approvalRef')
  requireDate(input.appliedAt, 'appliedAt')

  if (input.assessment.decision !== 'eligible') {
    throw new Error('Blocked maturity assessment cannot be applied')
  }
  if (input.assessment.opportunityId !== input.opportunity.id) {
    throw new Error('Maturity assessment does not belong to opportunity')
  }
  if (input.assessment.from !== profile.automationMaturity) {
    throw new Error('Opportunity maturity changed after assessment')
  }
  if (Date.parse(input.appliedAt) < Date.parse(input.assessment.assessedAt)) {
    throw new Error('Maturity promotion cannot predate its assessment')
  }

  const nextProfile: SideHustleProfile = {
    ...profile,
    executionOwners: [...profile.executionOwners],
    monetizationModels: [...profile.monetizationModels],
    automationMaturity: input.assessment.to,
  }

  const receipt: SideHustleMaturityPromotionReceipt = {
    opportunityId: input.opportunity.id,
    from: input.assessment.from,
    to: input.assessment.to,
    approvalRef: input.approvalRef.trim(),
    evidenceRefs: [...input.assessment.evidenceRefs],
    assessedAt: input.assessment.assessedAt,
    appliedAt: input.appliedAt,
    authorizationEffect: 'NONE',
  }

  return {
    opportunity: {
      ...input.opportunity,
      metadata: {
        ...input.opportunity.metadata,
        sideHustleProfile: nextProfile,
        sideHustleMaturityLastPromotion: receipt,
      },
      updatedAt: input.appliedAt,
    },
    receipt,
  }
}

export function nextSideHustleAutomationMaturity(
  maturity: SideHustleAutomationMaturity,
): SideHustleAutomationMaturity | undefined {
  const index = MATURITY_ORDER.indexOf(maturity)
  return index >= 0 && index < MATURITY_ORDER.length - 1
    ? MATURITY_ORDER[index + 1]
    : undefined
}

function readProfile(opportunity: Opportunity): SideHustleProfile {
  const profile = opportunity.metadata?.sideHustleProfile
  if (!isSideHustleProfile(profile)) {
    throw new Error('Side Hustle maturity promotion requires a canonical sideHustleProfile')
  }
  return profile
}

function allControlRefs(evidence: SideHustleMaturityEvidence): string[] {
  return unique([
    ...normalizedRefs(evidence.workflowEvidenceRefs),
    ...normalizedRefs(evidence.aiAssistEvidenceRefs),
    ...normalizedRefs(evidence.automationRunEvidenceRefs),
    ...normalizedRefs(evidence.exceptionHandlingEvidenceRefs),
    ...normalizedRefs(evidence.monitoringEvidenceRefs),
    ...normalizedRefs(evidence.recoveryEvidenceRefs),
    ...normalizedRefs(evidence.humanOverrideEvidenceRefs),
    ...normalizedRefs(evidence.auditEvidenceRefs),
  ])
}

function normalizedRefs(values: string[] | undefined): string[] {
  return unique(values ?? [])
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const value of values) {
    const id = key(value)
    if (!seen.has(id)) {
      seen.add(id)
      result.push(value)
    }
  }
  return result
}

function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
}

function requireDate(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be a valid date`)
  }
}
