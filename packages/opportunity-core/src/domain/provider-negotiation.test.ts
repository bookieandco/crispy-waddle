import assert from 'node:assert/strict'
import type { EngagementLedger } from './engagement-ledger.js'
import type { ProviderOutreachPacket } from './provider-outreach.js'
import { acceptProvisionalTerms, createProviderNegotiationState, ingestProviderResponse, reviewProviderClaim } from './provider-negotiation.js'

const packet: ProviderOutreachPacket = {
  id: 'sam:neg:outreach:p1', opportunityId: 'sam:neg', providerId: 'p1', role: 'subcontractor',
  requirementIds: ['r1'], evidenceRefs: ['e1'], subject: 'scope', draftBody: 'draft',
  diligenceQuestions: ['Confirm capacity'], negotiationPoints: [],
  commercialSummary: { structure: 'subcontract_margin', modeledGrossRevenue: 100000, modeledProviderCost: 40000, modeledMarginPercent: 30 },
  approvalRef: 'approval:draft', draftOnly: true, sendAuthorized: false, contractAuthorized: false,
}
const ledger: EngagementLedger = {
  opportunityId: 'sam:neg', providerId: 'p1',
  events: [{
    id: 'response:1', type: 'provider_response_recorded', opportunityId: 'sam:neg', providerId: 'p1',
    packetId: packet.id, externalMessageRef: 'message:reply', actorRef: 'connector:email',
    occurredAt: '2026-09-20T17:00:00Z', notes: [],
  }],
}

let state = createProviderNegotiationState(packet, '2026-09-20T16:00:00Z')
state = ingestProviderResponse(state, packet, ledger, {
  messageRef: 'message:reply',
  claims: [{ id: 'claim:capacity', kind: 'capacity', value: 'Available for October start' }],
  counteroffer: { id: 'offer:1', proposedProviderCost: 48000, proposedRequirementIds: ['r1'], commercialTerms: ['Net 30'] },
}, '2026-09-20T17:01:00Z')

assert.equal(state.status, 'negotiating')
assert.equal(state.baseline.modeledProviderCost, 40000)
assert.equal(state.counteroffers[0].proposedProviderCost, 48000)
assert.equal(state.claims[0].status, 'provider_asserted')
assert.equal(state.contractExecutionAuthorized, false)

assert.throws(() => acceptProvisionalTerms(state, 'offer:1', { approvalRef: 'approval:terms', approvedByRef: 'human:1' }), /assertions must be reviewed/)
assert.throws(() => reviewProviderClaim(state, 'claim:capacity', { decision: 'verified', reviewRef: 'review:1', reviewedByRef: 'human:1' }), /Evidence is required/)

state = reviewProviderClaim(state, 'claim:capacity', { decision: 'verified', reviewRef: 'review:1', reviewedByRef: 'human:1', evidenceRefs: ['evidence:capacity-current'] })
assert.equal(state.claims[0].status, 'verified')

state = acceptProvisionalTerms(state, 'offer:1', { approvalRef: 'approval:terms', approvedByRef: 'human:1' })
assert.equal(state.status, 'provisional_terms')
assert.equal(state.provisionalTerms?.providerCost, 48000)
assert.equal(state.provisionalTerms?.contractAuthority, false)
assert.equal(state.provisionalTerms?.signatureAuthority, false)
assert.equal(state.baseline.modeledProviderCost, 40000)

assert.throws(() => ingestProviderResponse(state, packet, { opportunityId: 'sam:neg', providerId: 'p1', events: [] }, { messageRef: 'missing' }), /recorded in the engagement ledger first/)

console.log('provider-negotiation tests passed')
