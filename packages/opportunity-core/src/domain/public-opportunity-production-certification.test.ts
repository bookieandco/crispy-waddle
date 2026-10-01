import assert from 'node:assert/strict'
import {
  assessPublicOpportunityProductionFinal,
  type PublicOpportunityProductionMetrics,
} from './public-opportunity-production-certification.js'

const base:PublicOpportunityProductionMetrics={
  stateAndDcCount:51,
  countyEquivalentCount:3100,
  jurisdictionCount:3151,
  sourceDiscoveryJobCount:3151,
  jurisdictionsWithVerifiedSource:1,
  verifiedProcurementSourceCount:1,
  activeReadOnlySourceCount:0,
  healthySourceCount:0,
  degradedSourceCount:0,
  failedSourceCount:0,
  inboxObservationCount:0,
  awardCount:0,
  primeProfileCount:0,
  workPackageCount:0,
  providerCandidateCount:0,
  compliancePackCount:51,
  verifiedCompliancePackCount:1,
  pendingComplianceSourceJobCount:50,
  complianceAssessmentCount:0,
  blockedComplianceAssessmentCount:0,
  authority:{
    externalContactAuthorized:false,
    providerOutreachAuthorized:false,
    bidSubmissionAuthorized:false,
    contractExecutionAuthorized:false,
    paymentAuthorized:false,
  },
}

const runtime=assessPublicOpportunityProductionFinal(base)
assert.equal(runtime.runtimeIntegrity,'PASS')
assert.equal(runtime.liveReferenceIngestion,'BLOCKED')
assert.equal(runtime.certification,'RUNTIME_CERTIFIED')
assert.ok(runtime.liveBlockers.some(value=>/ACTIVE_READ_ONLY/i.test(value)))

const live=assessPublicOpportunityProductionFinal({
  ...base,
  activeReadOnlySourceCount:1,
  healthySourceCount:1,
  inboxObservationCount:12,
})
assert.equal(live.liveReferenceIngestion,'PASS')
assert.equal(live.nationalCoverage,'PARTIAL')
assert.equal(live.certification,'LIVE_REFERENCE_CERTIFIED')

const national=assessPublicOpportunityProductionFinal({
  ...base,
  jurisdictionsWithVerifiedSource:3151,
  activeReadOnlySourceCount:3151,
  healthySourceCount:3151,
  inboxObservationCount:10000,
  verifiedCompliancePackCount:51,
  pendingComplianceSourceJobCount:0,
})
assert.equal(national.certification,'NATIONAL_COVERAGE_CERTIFIED')
assert.equal(national.coverageDebt.length,0)

const broken=assessPublicOpportunityProductionFinal({
  ...base,
  stateAndDcCount:50,
  authority:{...base.authority,bidSubmissionAuthorized:true},
})
assert.equal(broken.runtimeIntegrity,'BLOCKED')
assert.equal(broken.certification,'BLOCKED')
assert.ok(broken.blockers.some(value=>/50\/51/i.test(value)))
assert.ok(broken.blockers.some(value=>/authority invariant/i.test(value)))

console.log('public opportunity production certification tests passed')
