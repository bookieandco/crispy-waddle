import type { SamPursuitSnapshot } from './sam-pursuit-persistence.js'
import {
  validateSideHustleEvidenceReceipt,
  type SideHustleEvidenceReceipt,
} from './side-hustle-evidence-receipt.js'

export type SamSideHustleEvidenceInput = {
  snapshot: SamPursuitSnapshot
  experimentId?: string
  spend: number
  hours: number
  observedAt?: string
  sourceRecordId?: string
  notes?: string
}

/**
 * Converts a canonical SAM pursuit snapshot into procurement validation
 * evidence without treating proposal readiness as execution authorization.
 */
export function buildSamSideHustleEvidenceReceipt(
  input: SamSideHustleEvidenceInput,
): SideHustleEvidenceReceipt {
  const { snapshot } = input
  const fulfillment = snapshot.fulfillment
  const engagement = snapshot.engagement

  const qualifiedOpportunity =
    snapshot.requirements.requirements.length > 0 &&
    snapshot.requirements.unresolved.length === 0
      ? 1
      : 0

  const fulfillableMatch =
    fulfillment &&
    fulfillment.assignments.length > 0 &&
    fulfillment.uncoveredRequirementIds.length === 0 &&
    fulfillment.blockers.length === 0 &&
    fulfillment.structure !== 'unresolved'
      ? 1
      : 0

  const complianceBlockers = engagement
    ? engagement.checks.filter((check) => check.required && check.status === 'failed').length +
      engagement.checks.filter(
        (check) =>
          check.required &&
          check.status === 'passed' &&
          check.evidenceRefs.length === 0,
      ).length
    : 0

  const evidenceRefs = unique([
    ...snapshot.requirements.requirements.flatMap((requirement) => requirement.sourceEvidenceIds),
    ...(fulfillment?.assignments.flatMap((assignment) => assignment.evidenceRefs) ?? []),
    ...(engagement?.checks.flatMap((check) => [...check.evidenceRefs, ...check.sourceRefs]) ?? []),
    ...snapshot.pursuit.stages.flatMap((stage) => stage.evidenceRefs),
  ])

  return validateSideHustleEvidenceReceipt({
    id: `sam-side-hustle-evidence:${input.sourceRecordId?.trim() || snapshot.revision}`,
    opportunityId: snapshot.opportunityId,
    experimentId: input.experimentId,
    sourceOwner: 'sam',
    sourceRecordType: 'pursuit_snapshot',
    sourceRecordId: input.sourceRecordId?.trim() || `${snapshot.opportunityId}:revision:${snapshot.revision}`,
    observedAt: input.observedAt ?? snapshot.savedAt,
    metrics: {
      qualified_opportunities: qualifiedOpportunity,
      fulfillable_matches: fulfillableMatch,
      compliance_blockers: complianceBlockers,
    },
    spend: input.spend,
    hours: input.hours,
    evidenceRefs,
    notes: input.notes ?? `SAM pursuit snapshot revision ${snapshot.revision}`,
  })
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
