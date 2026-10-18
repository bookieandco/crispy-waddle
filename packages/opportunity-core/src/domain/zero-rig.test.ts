import assert from 'node:assert/strict'
import { ZERO_RIG_METHODS, getZeroRigMethod } from './zero-rig-methods.js'
import { normalizeSuperteamAgentListings, scoutSuperteamAgentListings, zeroRigBountyToOpportunity } from './zero-rig-superteam.js'
import { assessZeroRigEconomics } from './zero-rig-economics.js'
import { matchZeroRigBounty } from './zero-rig-bounty.js'
import { isOpportunityVerified } from './opportunity.js'
import { opportunityProvider } from './provider.js'

const now = '2026-10-17T20:00:00.000Z'
const future = '2026-11-17T20:00:00.000Z'
const listing = {
  id: 'b1', slug: 'valid-agent-bounty', title: 'Build a research tool', status: 'OPEN',
  agentAccess: 'AGENT_ONLY', type: 'bounty', deadline: future,
  rewardAmount: 200, token: 'USDC', skills: ['typescript', 'research'],
}
const payload = { result: [
  listing,
  { ...listing, id: 'b2', slug: 'human-only', agentAccess: 'HUMAN_ONLY' },
  { ...listing, id: 'b3', slug: 'expired', deadline: '2026-01-01T00:00:00Z' },
  { ...listing, id: 'b4', slug: 'closed', status: 'CLOSED' },
  { ...listing, id: 'b5', slug: 'announced', isWinnersAnnounced: true },
  { ...listing, id: 'b6', slug: 'bad-slug/evil' },
  { ...listing, id: 'b7', slug: 'bad-payout', rewardAmount: '999999' },
] }
const r = normalizeSuperteamAgentListings(payload, now)
assert.equal(r.listings.length, 2)
assert.equal(r.rejectedCount, 5)
assert.equal(r.listings[0].rewardVerified, false)
assert.equal(r.listings[1].rewardAmount, null)
assert.equal(r.submissionAuthorized, false)
assert.ok(ZERO_RIG_METHODS.every(x => !x.actionAuthorized))
assert.equal(getZeroRigMethod('superteam-agent-bounty')?.canonicalProviderId, 'provider:superteam-earn-agents')
assert.equal(opportunityProvider('provider:superteam-earn-agents')?.readiness, 'adapter_ready')
const canonical = zeroRigBountyToOpportunity(r.listings[0])
assert.equal(canonical.status, 'discovered')
assert.equal(canonical.verificationStatus, 'unverified')
assert.equal(isOpportunityVerified(canonical), false)

const mockReader = { readLiveListings: async (request: {take:number;deadline:string}) => {
  assert.equal(request.take, 50)
  assert.equal(request.deadline, now)
  return payload
}}
const scout = await scoutSuperteamAgentListings(mockReader, { now, take: 150 })
assert.equal(scout.listings.length, 2)
assert.equal(scout.claimAuthorized, false)

const base = {
  id: 'b1', rewardUsd: 200, rewardValuationObservedAt: now,
  rewardValuationEvidenceRef: 'provider:snapshot:1', expectedWinProbability: 0.2,
  estimatedHours: 2, computeCostUsd: 2, claimAndPlatformFeesUsd: 2,
  laborOpportunityCostUsdPerHour: 5, minimumExpectedUsdPerHour: 2, now,
}
const economics = assessZeroRigEconomics(base)
assert.equal(economics.decision, 'research_candidate')
assert.equal(economics.expectedNetUsd, 26)
assert.equal(economics.expectedNetUsdPerHour, 13)
assert.equal(assessZeroRigEconomics({...base, rewardUsd:null}).decision, 'insufficient_data')
assert.equal(assessZeroRigEconomics({...base, rewardValuationObservedAt:'2026-10-01T00:00:00Z'}).decision, 'insufficient_data')
assert.equal(assessZeroRigEconomics({...base, expectedWinProbability:1.2}).decision, 'insufficient_data')
assert.equal(assessZeroRigEconomics({...base, computeCostUsd:100}).decision, 'reject')
const matchBase = {
  listing:r.listings[0], capabilities: [
    {skill:'typescript',available:true,confidence:0.8,evidenceRefs:['test:ts']},
    {skill:'research',available:true,confidence:0.9,evidenceRefs:['test:research']},
  ],
  estimatedEffortHours:2, maxEffortHours:3, eligibility:'owner_confirmed' as const,
  rewardEconomics:economics, now,
}
assert.equal(matchZeroRigBounty(matchBase).verdict, 'candidate_for_owner_review')
assert.equal(matchZeroRigBounty({...matchBase,eligibility:'unknown'}).verdict,'research')
assert.equal(matchZeroRigBounty({...matchBase,capabilities:[]}).verdict,'research')
assert.equal(matchZeroRigBounty({...matchBase,now:'2026-12-20T00:00:00Z'}).verdict,'reject')
assert.equal(matchZeroRigBounty(matchBase).submissionAuthorized,false)
console.log('JH-ZERO-RIG.01-.04: 21 assertions passed (offline; no financial or external action)')
