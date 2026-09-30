import assert from 'node:assert/strict'
import {
  CALIFORNIA_COUNTIES,
  CALIFORNIA_REFERENCE_SOURCES,
  US_STATE_AND_DC_CODES,
  assessPublicGridAcceptance,
  buildNationalPublicCoverageManifest,
  normalizePublicOpportunitySignal,
  planAlwaysOnPublicDiscovery,
  planMissingPublicSources,
  routePublicOpportunity,
} from './public-opportunity-grid.js'

assert.equal(US_STATE_AND_DC_CODES.length, 51)
assert.equal(CALIFORNIA_COUNTIES.length, 58)

const manifest = buildNationalPublicCoverageManifest()
assert.equal(manifest.stateAndDcCount, 51)
assert.equal(manifest.countyCount, 58)
assert.equal(manifest.automaticDiscoveryAuthorized, true)
assert.equal(manifest.automaticExternalContactAuthorized, false)
assert.equal(manifest.unresolvedCountyCatalogStates.length, 49)

const laCounty = manifest.targets.find((target) => target.state === 'CA' && target.county === 'Los Angeles')
assert.ok(laCounty)
assert.ok((laCounty?.sourceCount ?? 0) >= 1)
assert.equal(laCounty?.sourceDiscoveryRequired, false)

const discoveryJobs = planMissingPublicSources(manifest)
assert.ok(discoveryJobs.some((job) => job.state === 'TX'))
assert.ok(discoveryJobs.some((job) => job.state === 'CA' && job.county === 'Orange'))
assert.ok(discoveryJobs.every((job) => job.externalContactAuthorized === false))

const scheduled = planAlwaysOnPublicDiscovery([...CALIFORNIA_REFERENCE_SOURCES])
assert.ok(scheduled.some((job) => job.sourceId === 'ca.los-angeles-county.doing-business'))
assert.ok(scheduled.some((job) => job.sourceId === 'ca.los-angeles-county.board-agendas' && job.cadence === 'nightly'))
assert.ok(scheduled.every((job) => job.automaticDiscoveryAuthorized))
assert.ok(scheduled.every((job) => !job.externalContactAuthorized && !job.bidSubmissionAuthorized))

const opportunity = normalizePublicOpportunitySignal({
  id: 'local:la:award:123',
  sourceId: 'ca.los-angeles-county.doing-business',
  sourceUrl: 'https://doingbusiness.lacounty.gov/',
  sourceName: 'Los Angeles County Doing Business',
  title: 'County facility renovation award',
  description: 'Facility renovation including electrical, HVAC, flooring, and painting.',
  stage: 'award',
  state: 'CA',
  county: 'Los Angeles',
  externalId: '123',
  amount: { max: 2300000, currency: 'USD' },
  buyer: 'Los Angeles County',
  awardedPrimeName: 'Example Prime',
  awardedPrimeRef: 'prime:example',
  capturedAt: '2026-09-30T15:00:00Z',
  evidenceRef: 'evidence:la:123',
})
assert.equal(opportunity.type, 'contract')
assert.equal(opportunity.jurisdiction?.region, 'CA')
assert.equal(opportunity.jurisdiction?.locality, 'Los Angeles')
assert.equal(opportunity.verificationStatus, 'partially_verified')
assert.equal(opportunity.metadata?.awardedPrimeRef, 'prime:example')

const capture = routePublicOpportunity({
  opportunityId: 'early:1',
  stage: 'capital_authorized',
  primeEligibility: 'unknown',
  providerCoverage: 'unknown',
  pricingCoverage: 'unknown',
  workingCapital: 'unknown',
})
assert.equal(capture.route, 'CAPTURE')

const subcontract = routePublicOpportunity({
  opportunityId: 'award:1',
  stage: 'award',
  hasAwardedPrime: true,
  subcontractPackageFit: true,
  primeEligibility: 'unknown',
  providerCoverage: 'ready',
  pricingCoverage: 'medium',
  workingCapital: 'ready',
})
assert.equal(subcontract.route, 'SUB')

const prime = routePublicOpportunity({
  opportunityId: 'sol:1',
  stage: 'open_solicitation',
  primeEligibility: 'ready',
  providerCoverage: 'ready',
  pricingCoverage: 'high',
  workingCapital: 'ready',
  commerciallyViable: true,
})
assert.equal(prime.route, 'PRIME')
assert.equal(prime.bidSubmissionAuthorized, false)
assert.equal(prime.providerOutreachAuthorized, false)

const team = routePublicOpportunity({
  opportunityId: 'sol:2',
  stage: 'open_solicitation',
  primeEligibility: 'fixable_gaps',
  providerCoverage: 'partial',
  pricingCoverage: 'medium',
  workingCapital: 'conditional',
})
assert.equal(team.route, 'TEAM')

const blocked = routePublicOpportunity({
  opportunityId: 'sol:3',
  stage: 'open_solicitation',
  primeEligibility: 'blocked',
  providerCoverage: 'none',
  pricingCoverage: 'low',
  workingCapital: 'blocked',
})
assert.equal(blocked.route, 'PASS')
assert.ok(blocked.blockers.length > 0)

const acceptance = assessPublicGridAcceptance()
assert.equal(acceptance.status, 'pass')
assert.equal(acceptance.stateAndDcCoverage, 51)
assert.equal(acceptance.californiaCountyCoverage, 58)
assert.equal(acceptance.automaticDiscoveryAuthorized, true)
assert.equal(acceptance.automaticExternalExecutionAuthorized, false)

console.log('public opportunity grid tests passed')
