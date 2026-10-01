import { strict as assert } from 'node:assert'
import { certifyOpportunityFactoryFinal } from './opportunity-factory-final.js'

const software = {
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


const venturePass = {
  status: 'pass' as const,
  softwareStatus: 'pass' as const,
  liveStatus: 'pass' as const,
  softwareBlockers: [],
  liveBlockers: [],
  externalExecutionAuthorized: false as const,
  directCreativeReplicationAuthorized: false as const,
  moneyMovementAuthorized: false as const,
}

const samPass = {
  status: 'pass' as const,
  failures: [],
  evidence: {
    runtimeBound: true,
    scanReceipts: 3,
    marketCoverageComplete: true,
    marketCoverageDays: 365,
    realNotices: 5,
    noticesWithDocuments: 5,
    noticesWithSubcontractability: 5,
    noticesWithProviderCandidates: 5,
    realProviderCandidates: 8,
    noticesWithPursuitOptions: 5,
    noticesWithTeamCoverage: 5,
    noticesWithCommercialReadiness: 5,
    provenanceComplete: true,
    unauthorizedExternalActions: 0,
    silentFallbacks: 0,
  },
}

{
  const report = certifyOpportunityFactoryFinal({
    software,
    live: {
      samClosedLoopCases: 0,
      commercialProviderReceipts: 0,
      realizedCommercialOutcomes: 0,
      unauthorizedExternalActions: 0,
    },
  })

  assert.equal(report.softwareStatus, 'pass')
  assert.equal(report.liveStatus, 'blocked')
  assert.equal(report.status, 'blocked')
  assert.ok(report.registeredSideHustleFamilies >= 20)
  assert.equal(report.automaticExternalExecutionAuthorized, false)
}

{
  const report = certifyOpportunityFactoryFinal({
    software,
    live: {
      samUsableCertification: samPass,
      samClosedLoopCases: 3,
      commercialProviderReceipts: 2,
      realizedCommercialOutcomes: 1,
      unauthorizedExternalActions: 0,
      ventureFactoryCertification: venturePass,
    },
  })

  assert.equal(report.softwareStatus, 'pass')
  assert.equal(report.liveStatus, 'pass')
  assert.equal(report.status, 'pass')
  assert.deepEqual(report.softwareBlockers, [])
  assert.deepEqual(report.liveBlockers, [])
  assert.equal(report.bidSubmissionAuthorized, false)
  assert.equal(report.providerOutreachAuthorized, false)
  assert.equal(report.paymentAuthorized, false)
}

{
  const report = certifyOpportunityFactoryFinal({
    software: {
      ...software,
      duplicateAuthorityPaths: 1,
    },
    live: {
      samUsableCertification: samPass,
      samClosedLoopCases: 3,
      commercialProviderReceipts: 2,
      realizedCommercialOutcomes: 1,
      unauthorizedExternalActions: 1,
      ventureFactoryCertification: venturePass,
    },
  })

  assert.equal(report.softwareStatus, 'fail')
  assert.equal(report.liveStatus, 'fail')
  assert.equal(report.status, 'fail')
  assert.ok(report.softwareBlockers.some((value) => value.includes('Duplicate authority paths')))
  assert.ok(report.liveBlockers.some((value) => value.includes('Unauthorized external actions')))
}
