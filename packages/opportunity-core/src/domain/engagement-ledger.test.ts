import assert from 'node:assert/strict'
import type { ProviderOutreachPacket } from './provider-outreach.js'
import { authorizeProviderSend, createEngagementLedger, isSendAuthorizationActive, recordProviderResponse, recordProviderSend, recordSendAuthorization, revokeSendAuthorization } from './engagement-ledger.js'

const packet: ProviderOutreachPacket = {
  id: 'sam:1:outreach:p1', opportunityId: 'sam:1', providerId: 'p1', role: 'subcontractor',
  requirementIds: ['r1'], evidenceRefs: ['e1'], subject: 'Potential subcontractor discussion', draftBody: 'draft',
  diligenceQuestions: [], negotiationPoints: [],
  commercialSummary: { structure: 'subcontract_margin', modeledGrossRevenue: 100000, modeledProviderCost: 50000, modeledMarginPercent: 30 },
  approvalRef: 'approval:draft', draftOnly: true, sendAuthorized: false, contractAuthorized: false,
}

assert.throws(() => authorizeProviderSend(packet, { id: 'send:bad', channel: 'email', destinationRef: 'contact:1', approvedByRef: 'human:1', approvalRef: 'approval:draft' }), /separate approval/)

const auth = authorizeProviderSend(packet, { id: 'send:1', channel: 'email', destinationRef: 'contact:1', approvedByRef: 'human:1', approvalRef: 'approval:send' }, '2026-09-20T16:00:00Z')
assert.equal(auth.contractAuthority, false)
assert.equal(isSendAuthorizationActive(auth, packet, '2026-09-20T16:01:00Z'), true)

let ledger = createEngagementLedger(packet)
ledger = recordSendAuthorization(ledger, packet, auth, 'human:1', '2026-09-20T16:00:00Z')
ledger = recordProviderSend(ledger, packet, auth, { actorRef: 'connector:email', externalMessageRef: 'message:123' }, '2026-09-20T16:02:00Z')
assert.equal(ledger.events.length, 2)
assert.equal(ledger.events[1].type, 'send_recorded')
assert.throws(() => recordProviderSend(ledger, packet, auth, { actorRef: 'connector:email', externalMessageRef: 'message:124' }), /already been consumed/)

ledger = recordProviderResponse(ledger, packet, { actorRef: 'connector:email', externalMessageRef: 'message:reply-1' })
assert.equal(ledger.events[2].type, 'provider_response_recorded')

const revoked = revokeSendAuthorization(auth, '2026-09-20T16:03:00Z')
assert.equal(isSendAuthorizationActive(revoked, packet, '2026-09-20T16:04:00Z'), false)

console.log('engagement-ledger tests passed')
