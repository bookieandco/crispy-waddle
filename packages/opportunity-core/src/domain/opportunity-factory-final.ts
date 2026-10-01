import type { SamUsableCertification } from './sam-usable-final.js'
import { SIDE_HUSTLE_FAMILY_IDS } from './side-hustles.js'
import type { VentureFactoryFinalReport } from './venture-factory.js'

export type OpportunityFactorySoftwareEvidence = {
  canonicalRepositoryBound: boolean
  canonicalProviderRegistryBound: boolean
  growthCandidateBridgeBound: boolean
  growthEvidenceBridgeBound: boolean
  sideHustleExperimentLifecycleBound: boolean
  sideHustleMaturityLifecycleBound: boolean
  outcomeLearningBridgeBound: boolean
  moneyOutcomeTruthBridgeBound: boolean
  actionGovernanceBound: boolean
  ventureFactoryBound: boolean
  duplicateAuthorityPaths: number
}

export type OpportunityFactoryLiveEvidence = {
  samUsableCertification?: SamUsableCertification
  samClosedLoopCases: number
  commercialProviderReceipts: number
  realizedCommercialOutcomes: number
  unauthorizedExternalActions: number
  ventureFactoryCertification?: VentureFactoryFinalReport
}

export type OpportunityFactoryFinalReport = {
  status: 'pass' | 'blocked' | 'fail'
  softwareStatus: 'pass' | 'fail'
  liveStatus: 'pass' | 'blocked' | 'fail'
  softwareBlockers: string[]
  liveBlockers: string[]
  registeredSideHustleFamilies: number
  automaticExternalExecutionAuthorized: false
  bidSubmissionAuthorized: false
  providerOutreachAuthorized: false
  paymentAuthorized: false
}

/**
 * Final acceptance gate for the SAM / Opportunity / Side-Hustle stack.
 *
 * Software completeness and live evidence are deliberately separate. A green
 * software gate cannot manufacture SAM credentials, provider receipts, or
 * realized business outcomes. Likewise, live evidence cannot bypass Action
 * Core or create a second execution authority.
 */
export function certifyOpportunityFactoryFinal(input: {
  software: OpportunityFactorySoftwareEvidence
  live: OpportunityFactoryLiveEvidence
}): OpportunityFactoryFinalReport {
  const softwareBlockers: string[] = []
  const liveBlockers: string[] = []

  if (!input.software.canonicalRepositoryBound) {
    softwareBlockers.push('Canonical Opportunity repository is not bound.')
  }
  if (!input.software.canonicalProviderRegistryBound) {
    softwareBlockers.push('Canonical Opportunity provider registry is not bound.')
  }
  if (!input.software.growthCandidateBridgeBound) {
    softwareBlockers.push('Growth candidate -> Opportunity bridge is not bound.')
  }
  if (!input.software.growthEvidenceBridgeBound) {
    softwareBlockers.push('Growth evidence -> Side Hustle validation bridge is not bound.')
  }
  if (!input.software.sideHustleExperimentLifecycleBound) {
    softwareBlockers.push('Side Hustle experiment lifecycle is not bound.')
  }
  if (!input.software.sideHustleMaturityLifecycleBound) {
    softwareBlockers.push('Side Hustle maturity lifecycle is not bound.')
  }
  if (!input.software.outcomeLearningBridgeBound) {
    softwareBlockers.push('Opportunity outcome -> Growth learning bridge is not bound.')
  }
  if (!input.software.moneyOutcomeTruthBridgeBound) {
    softwareBlockers.push('Money Core realized-outcome truth bridge is not bound.')
  }
  if (!input.software.actionGovernanceBound) {
    softwareBlockers.push('Action governance boundary is not bound.')
  }
  if (!input.software.ventureFactoryBound) {
    softwareBlockers.push('Canonical Venture Factory is not bound into Opportunity Factory.')
  }
  if (!Number.isInteger(input.software.duplicateAuthorityPaths) || input.software.duplicateAuthorityPaths < 0) {
    softwareBlockers.push('duplicateAuthorityPaths must be a non-negative integer.')
  } else if (input.software.duplicateAuthorityPaths !== 0) {
    softwareBlockers.push(`Duplicate authority paths remain: ${input.software.duplicateAuthorityPaths}.`)
  }

  if (SIDE_HUSTLE_FAMILY_IDS.length < 1) {
    softwareBlockers.push('Side Hustle family registry is empty.')
  }

  let liveStatus: OpportunityFactoryFinalReport['liveStatus'] = 'pass'

  if (input.live.unauthorizedExternalActions !== 0) {
    liveBlockers.push(
      `Unauthorized external actions observed: ${input.live.unauthorizedExternalActions}.`,
    )
    liveStatus = 'fail'
  }

  if (!input.live.samUsableCertification) {
    liveBlockers.push('SAM-USABLE live certification evidence has not been supplied.')
    if (liveStatus !== 'fail') liveStatus = 'blocked'
  } else if (input.live.samUsableCertification.status !== 'pass') {
    liveBlockers.push(...input.live.samUsableCertification.failures.map(
      (failure) => `SAM-USABLE: ${failure}`,
    ))
    if (liveStatus !== 'fail') liveStatus = 'blocked'
  }

  if (!input.live.ventureFactoryCertification) {
    liveBlockers.push('VENTURE-FACTORY.FINAL live certification evidence has not been supplied.')
    if (liveStatus !== 'fail') liveStatus = 'blocked'
  } else if (input.live.ventureFactoryCertification.status !== 'pass') {
    liveBlockers.push(...input.live.ventureFactoryCertification.softwareBlockers.map((value) => `VENTURE-FACTORY software: ${value}`))
    liveBlockers.push(...input.live.ventureFactoryCertification.liveBlockers.map((value) => `VENTURE-FACTORY live: ${value}`))
    if (input.live.ventureFactoryCertification.status === 'fail') liveStatus = 'fail'
    else if (liveStatus !== 'fail') liveStatus = 'blocked'
  }

  if (!Number.isInteger(input.live.samClosedLoopCases) || input.live.samClosedLoopCases < 0) {
    liveBlockers.push('samClosedLoopCases must be a non-negative integer.')
    liveStatus = 'fail'
  } else if (input.live.samClosedLoopCases < 3) {
    liveBlockers.push(
      `SAM closed-loop production evidence is ${input.live.samClosedLoopCases}/3 cases.`,
    )
    if (liveStatus !== 'fail') liveStatus = 'blocked'
  }

  if (!Number.isInteger(input.live.commercialProviderReceipts) || input.live.commercialProviderReceipts < 0) {
    liveBlockers.push('commercialProviderReceipts must be a non-negative integer.')
    liveStatus = 'fail'
  } else if (input.live.commercialProviderReceipts < 1) {
    liveBlockers.push('No live commercial Side Hustle provider receipt has been recorded.')
    if (liveStatus !== 'fail') liveStatus = 'blocked'
  }

  if (!Number.isInteger(input.live.realizedCommercialOutcomes) || input.live.realizedCommercialOutcomes < 0) {
    liveBlockers.push('realizedCommercialOutcomes must be a non-negative integer.')
    liveStatus = 'fail'
  } else if (input.live.realizedCommercialOutcomes < 1) {
    liveBlockers.push('No realized commercial Side Hustle outcome has closed the learning loop.')
    if (liveStatus !== 'fail') liveStatus = 'blocked'
  }

  const softwareStatus: OpportunityFactoryFinalReport['softwareStatus'] =
    softwareBlockers.length === 0 ? 'pass' : 'fail'
  const status: OpportunityFactoryFinalReport['status'] =
    softwareStatus === 'fail' || liveStatus === 'fail'
      ? 'fail'
      : liveStatus === 'blocked'
        ? 'blocked'
        : 'pass'

  return {
    status,
    softwareStatus,
    liveStatus,
    softwareBlockers,
    liveBlockers,
    registeredSideHustleFamilies: SIDE_HUSTLE_FAMILY_IDS.length,
    automaticExternalExecutionAuthorized: false,
    bidSubmissionAuthorized: false,
    providerOutreachAuthorized: false,
    paymentAuthorized: false,
  }
}
