import { reasonOverSpatialContext, type SpatialContextPackage } from './integration.js'
import { assertSpatialWorkspace, type SpatialOperationContext, type SpatialWorkspace } from './spatial-pipeline.js'

export type JanetSpatialPreferences = {
  activeLayers?: string[]
  filters?: Record<string, unknown>
  display?: Record<string, unknown>
}

/** JANET may personalize presentation state only; evidence/reality lineage is copied unchanged. */
export function applyJanetSpatialPreferences(workspace: SpatialWorkspace, preferences: JanetSpatialPreferences): SpatialWorkspace {
  assertSpatialWorkspace(workspace)
  return {
    ...workspace,
    activeLayers: preferences.activeLayers ? [...new Set(preferences.activeLayers)].sort() : [...workspace.activeLayers],
    filters: preferences.filters ? { ...workspace.filters, ...preferences.filters } : { ...workspace.filters },
    janetPreferences: { ...workspace.janetPreferences, ...(preferences.display ?? {}), ...(preferences.activeLayers ? { preferredLayers: [...preferences.activeLayers] } : {}) },
    selectedRefs: [...workspace.selectedRefs],
    routes: [...workspace.routes],
    annotations: [...workspace.annotations],
    measurements: [...workspace.measurements],
    investigationRefs: [...workspace.investigationRefs],
    activeClaimRefs: [...workspace.activeClaimRefs],
    evidenceRefs: [...workspace.evidenceRefs],
    realityRefs: [...workspace.realityRefs],
    deliaContext: { ...workspace.deliaContext },
    marisaContext: { ...workspace.marisaContext },
  }
}

export type DeliaSpatialAssessment = ReturnType<typeof reasonOverSpatialContext> & {
  authority: 'INTELLIGENCE_ONLY'
}

/** DELIA consumes context and produces analysis only. */
export function composeDeliaSpatialAssessment(context: SpatialContextPackage): DeliaSpatialAssessment {
  return { ...reasonOverSpatialContext(context), authority: 'INTELLIGENCE_ONLY' }
}

export type MarisaSpatialOperationProposal = {
  proposalId: string
  capability: string
  operation: string
  status: 'REQUIRES_POLICY_APPROVAL'
  context: SpatialOperationContext
}

/** MARISA may prepare work but never receives an executor or approval authority. */
export function prepareMarisaSpatialOperation(input: {
  workspaceRef: string
  capability: string
  operation: string
  purpose: string
  evidenceRefs: string[]
  realityRefs: string[]
  limitations?: string[]
}): MarisaSpatialOperationProposal {
  if (!input.workspaceRef || !input.capability || !input.operation || !input.purpose) throw new Error('MARISA_SPATIAL_PROPOSAL_INVALID')
  return {
    proposalId: `marisa-spatial:${crypto.randomUUID()}`,
    capability: input.capability,
    operation: input.operation,
    status: 'REQUIRES_POLICY_APPROVAL',
    context: {
      workspaceRef: input.workspaceRef,
      approved: false,
      purpose: input.purpose,
      evidenceRefs: [...new Set(input.evidenceRefs)].sort(),
      realityRefs: [...new Set(input.realityRefs)].sort(),
      limitations: [...new Set(input.limitations ?? [])].sort(),
    },
  }
}
