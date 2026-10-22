import type { SupabaseClient } from '@supabase/supabase-js'
import {
  certifyOpportunityFactoryFinal,
  certifyVentureFactoryFinal,
  type OpportunityFactoryFinalReport,
  type OpportunityFactoryLiveEvidence,
  type OpportunityFactorySoftwareEvidence,
  type VentureFactoryFinalReport,
  type VentureFactoryLiveEvidence,
} from '@jhadina/opportunity-core'
import { certifySamUsableRuntime } from '@/lib/money-opportunities/sam-usable-runtime'
import { ventureRuntimeSoftwareEvidence } from './venture-runtime'

export type OpportunityFactoryLiveSnapshot = {
  samClosedLoopCases: number
  commercialProviderReceipts: number
  realizedCommercialOutcomes: number
  unauthorizedExternalActions: number
  venture: VentureFactoryLiveEvidence
}

export type OpportunityFactoryProductionCertification = {
  report: OpportunityFactoryFinalReport
  liveEvidence: OpportunityFactoryLiveSnapshot
  ventureFactoryCertification: VentureFactoryFinalReport
}

export function opportunityFactorySoftwareEvidence(): OpportunityFactorySoftwareEvidence {
  return {
    canonicalRepositoryBound: true,
    canonicalProviderRegistryBound: true,
    growthCandidateBridgeBound: true,
    growthEvidenceBridgeBound: true,
    sideHustleExperimentLifecycleBound: true,
    sideHustleMaturityLifecycleBound: true,
    outcomeLearningBridgeBound: true,
    moneyOutcomeTruthBridgeBound: true,
    actionGovernanceBound: true,
    ventureFactoryBound: true,
    duplicateAuthorityPaths: 0,
  }
}

export function normalizeOpportunityFactoryLiveSnapshot(value: unknown): OpportunityFactoryLiveSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('OPPORTUNITY_FACTORY_LIVE_EVIDENCE_INVALID')
  }
  const row = value as Record<string, unknown>
  const ventureValue = row.venture
  if (!ventureValue || typeof ventureValue !== 'object' || Array.isArray(ventureValue)) {
    throw new Error('OPPORTUNITY_FACTORY_VENTURE_EVIDENCE_INVALID')
  }
  const venture = ventureValue as Record<string, unknown>

  return {
    samClosedLoopCases: nonNegativeInteger(row.samClosedLoopCases, 'samClosedLoopCases'),
    commercialProviderReceipts: nonNegativeInteger(row.commercialProviderReceipts, 'commercialProviderReceipts'),
    realizedCommercialOutcomes: nonNegativeInteger(row.realizedCommercialOutcomes, 'realizedCommercialOutcomes'),
    unauthorizedExternalActions: nonNegativeInteger(row.unauthorizedExternalActions, 'unauthorizedExternalActions'),
    venture: {
      discoveredSignals: nonNegativeInteger(venture.discoveredSignals, 'venture.discoveredSignals'),
      boundedExperiments: nonNegativeInteger(venture.boundedExperiments, 'venture.boundedExperiments'),
      realizedCommercialOutcomes: nonNegativeInteger(venture.realizedCommercialOutcomes, 'venture.realizedCommercialOutcomes'),
      supervisorRepairReceipts: nonNegativeInteger(venture.supervisorRepairReceipts, 'venture.supervisorRepairReceipts'),
      spatialRuntimeReceipts: nonNegativeInteger(venture.spatialRuntimeReceipts, 'venture.spatialRuntimeReceipts'),
      unauthorizedExternalActions: nonNegativeInteger(venture.unauthorizedExternalActions, 'venture.unauthorizedExternalActions'),
      copiedCreativeAssets: nonNegativeInteger(venture.copiedCreativeAssets, 'venture.copiedCreativeAssets'),
    },
  }
}

/**
 * Production-only evidence collector. The database RPC accepts no arguments,
 * so request bodies cannot claim their own closed loops, receipts, outcomes,
 * or authority state.
 */
export async function collectOpportunityFactoryLiveSnapshot(
  client: SupabaseClient,
): Promise<OpportunityFactoryLiveSnapshot> {
  const { data, error } = await client.rpc('jhadina_opportunity_factory_live_evidence')
  if (error || !data) {
    throw new Error(`OPPORTUNITY_FACTORY_LIVE_EVIDENCE_READ_FAILED:${error?.message ?? 'no result returned'}`)
  }
  return normalizeOpportunityFactoryLiveSnapshot(data)
}

export async function certifyOpportunityFactoryProduction(
  client: SupabaseClient,
): Promise<OpportunityFactoryProductionCertification> {
  const [samUsableCertification, liveEvidence] = await Promise.all([
    certifySamUsableRuntime(client),
    collectOpportunityFactoryLiveSnapshot(client),
  ])

  const ventureFactoryCertification = certifyVentureFactoryFinal({
    software: ventureRuntimeSoftwareEvidence(),
    live: liveEvidence.venture,
  })

  const live: OpportunityFactoryLiveEvidence = {
    samUsableCertification,
    samClosedLoopCases: liveEvidence.samClosedLoopCases,
    commercialProviderReceipts: liveEvidence.commercialProviderReceipts,
    realizedCommercialOutcomes: liveEvidence.realizedCommercialOutcomes,
    unauthorizedExternalActions: liveEvidence.unauthorizedExternalActions,
    ventureFactoryCertification,
  }

  const report = certifyOpportunityFactoryFinal({
    software: opportunityFactorySoftwareEvidence(),
    live,
  })

  return {
    report,
    liveEvidence,
    ventureFactoryCertification,
  }
}

/**
 * A durable FINAL receipt is only admitted for a real pass. Blocked/failing
 * snapshots remain observable to the caller but cannot be persisted as a
 * certification artifact.
 */
export async function certifyAndPersistOpportunityFactoryProduction(
  client: SupabaseClient,
  sourceCommit: string,
): Promise<OpportunityFactoryProductionCertification> {
  const commit = sourceCommit.trim()
  if (!commit) throw new Error('OPPORTUNITY_FACTORY_SOURCE_COMMIT_REQUIRED')

  const certification = await certifyOpportunityFactoryProduction(client)
  if (certification.report.status !== 'pass') return certification

  const id = `opportunity-factory-final:${commit}`
  const { error } = await client
    .from('jhadina_opportunity_factory_certifications')
    .upsert({
      id,
      source_commit: commit,
      status: certification.report.status,
      software_status: certification.report.softwareStatus,
      live_status: certification.report.liveStatus,
      report: certification.report,
      evidence: {
        live: certification.liveEvidence,
        ventureFactoryCertification: certification.ventureFactoryCertification,
      },
    }, { onConflict: 'id' })

  if (error) throw new Error(`OPPORTUNITY_FACTORY_CERTIFICATION_SAVE_FAILED:${error.message}`)
  return certification
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`OPPORTUNITY_FACTORY_EVIDENCE_INVALID:${field}`)
  }
  return value
}
