import assert from 'node:assert/strict'
import {
  SIDE_HUSTLE_DEFINITIONS,
  buildSideHustleProfile,
  getSideHustleDefinition,
  isSideHustleProfile,
  scoreSideHustle,
  type SideHustleScoreFactors,
} from './side-hustles.js'

assert.equal(SIDE_HUSTLE_DEFINITIONS.length, 26)
assert.equal(new Set(SIDE_HUSTLE_DEFINITIONS.map((item) => item.family)).size, SIDE_HUSTLE_DEFINITIONS.length)

const pod = getSideHustleDefinition('pod_personalized_commerce')
assert.equal(pod.hubCategory, 'products')
assert.ok(pod.executionOwners.includes('pupsonstuff'))
assert.ok(pod.monetizationModels.includes('print_on_demand_margin'))

const automation = buildSideHustleProfile({ family: 'business_automation' })
assert.equal(automation.role, 'standalone')
assert.equal(automation.automationMaturity, 'unvalidated')
assert.ok(automation.executionOwners.includes('builder'))
assert.equal(isSideHustleProfile(automation), true)
assert.equal(isSideHustleProfile({ family: 'business_automation' }), false)

const baseline: SideHustleScoreFactors = {
  demand: 80,
  pain: 80,
  abilityToPay: 80,
  distributionAccess: 70,
  domainAdvantage: 70,
  margin: 75,
  recurrence: 75,
  automationPotential: 80,
  reusableIp: 80,
  productizationPotential: 75,
  evidence: 70,
  processMaturity: 70,
  knowledgeAvailability: 70,
  adoptionFeasibility: 70,
  roiObservability: 80,
  timeToEvidence: 30,
  customerAcquisitionCost: 30,
  humanAttention: 40,
  capitalRisk: 20,
  competition: 50,
  regulation: 20,
  platformDependency: 30,
  failureCost: 15,
  fulfillmentComplexity: 40,
}

const strong = scoreSideHustle(baseline)
const weak = scoreSideHustle({
  ...baseline,
  demand: 30,
  pain: 30,
  distributionAccess: 20,
  evidence: 20,
  capitalRisk: 80,
  failureCost: 80,
})

assert.ok(strong.overall > weak.overall)
assert.ok(strong.overall >= 0 && strong.overall <= 100)
assert.throws(
  () => scoreSideHustle({ ...baseline, demand: 101 }),
  /must be between 0 and 100/,
)

console.log('side hustle portfolio tests passed')
