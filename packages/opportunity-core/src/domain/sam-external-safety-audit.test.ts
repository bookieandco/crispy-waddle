import assert from 'node:assert/strict'
import {
  SAM_EXTERNAL_SURFACES, SAM_EXTERNAL_SOURCE_INVENTORY,
  inspectSamAuditChains, reconcileSamExternalSafety,
  type SamExternalSafetyInput,
} from './sam-external-safety-audit.js'
const from='2026-10-17T00:00:00.000Z',through='2026-10-17T23:59:59.999Z'
const at='2026-10-17T10:00:00.000Z'
const clean=():SamExternalSafetyInput=>({
  window:{from,through},
  approvals:[],
  receipts:[],
  actionEvents:[],
  chains:[],
})
const approved=():SamExternalSafetyInput=>({
  window:{from,through},
  approvals:[{
    id:'approval-1',operationId:'send-1',surface:'provider_outreach',
    status:'approved',grantedAt:'2026-10-17T09:00:00.000Z',
    expiresAt:'2026-10-17T11:00:00.000Z',destinationRef:'provider@example.test',
    scope:'single_execution',
  }],
  actionEvents:[{id:'action:1',operationId:'send-1',surface:'provider_outreach',status:'completed',occurredAt:at}],
  receipts:[
    {id:'transport:1',operationId:'send-1',surface:'provider_outreach',source:'provider_transport',
      status:'completed',observedAt:at,authorizationId:'approval-1',externalRef:'message-1',destinationRef:'provider@example.test'},
    {id:'provider:1',operationId:'send-1',surface:'provider_outreach',source:'external_provider',
      status:'completed',observedAt:at,authorizationId:'approval-1',externalRef:'message-1',destinationRef:'provider@example.test'},
  ],
  chains:[],
})
assert.equal(SAM_EXTERNAL_SOURCE_INVENTORY.length,SAM_EXTERNAL_SURFACES.length)
assert.deepEqual(new Set(SAM_EXTERNAL_SOURCE_INVENTORY.map(x=>x.surface)),new Set(SAM_EXTERNAL_SURFACES))
const none=reconcileSamExternalSafety(clean())
assert.equal(none.status,'blocked')
assert.equal(none.observedUnauthorizedOperations,null)
assert.equal(none.safetyEvidenceComplete,false)
assert.equal(none.authorizationGranted,false)
assert.ok(none.evidenceGaps.some(x=>x.includes('fallback_observer')))
assert.ok(none.evidenceGaps.some(x=>x.includes('off-host checkpoint')))

const matched=reconcileSamExternalSafety(approved())
assert.equal(matched.status,'blocked')
assert.equal(matched.observedViolations.length,0)
assert.equal(matched.safetyEvidenceComplete,false)
assert.equal(matched.authorizationGranted,false)
assert.equal(matched.observedUnauthorizedOperations,null)

const noApproval=approved()
noApproval.approvals=[]
const unauth=reconcileSamExternalSafety(noApproval)
assert.ok(unauth.observedViolations.some(x=>x.includes('without valid single-operation approval')))
assert.equal(unauth.observedUnauthorizedOperations,1)
for(const mutation of [
  (i:SamExternalSafetyInput)=>{i.approvals[0].status='revoked'},
  (i:SamExternalSafetyInput)=>{i.approvals[0].revokedAt='2026-10-17T09:59:00.000Z'},
  (i:SamExternalSafetyInput)=>{i.approvals[0].expiresAt='2026-10-17T09:30:00.000Z'},
  (i:SamExternalSafetyInput)=>{i.approvals[0].destinationRef='different@example.test'},
  (i:SamExternalSafetyInput)=>{i.approvals[0].operationId='other-operation'},
  (i:SamExternalSafetyInput)=>{i.approvals[0].surface='money_disbursement'},
  (i:SamExternalSafetyInput)=>{i.approvals[0].grantedAt='2026-10-17T12:00:00.000Z'},
]){
  const sample=approved();mutation(sample)
  assert.ok(reconcileSamExternalSafety(sample).observedViolations.length>0)
}

const disconnected=approved()
disconnected.receipts=disconnected.receipts.filter(r=>r.source!=='external_provider')
assert.ok(reconcileSamExternalSafety(disconnected).evidenceGaps.some(x=>x.includes('external_provider witness')))

const missingAction=approved()
missingAction.actionEvents=[]
assert.ok(reconcileSamExternalSafety(missingAction).evidenceGaps.some(x=>x.includes('without matching Action Core')))

const missingTransport=approved()
missingTransport.receipts=[]
assert.ok(reconcileSamExternalSafety(missingTransport).evidenceGaps.some(x=>x.includes('without external execution receipt')))

const orphan=clean()
orphan.actionEvents.push({id:'start',operationId:'pending',surface:'provider_outreach',status:'started',occurredAt:at})
assert.ok(reconcileSamExternalSafety(orphan).evidenceGaps.some(x=>x.includes('unreconciled Action Core started')))
const possibleSideEffect=clean()
possibleSideEffect.receipts.push({id:'attempt:1',operationId:'send-2',surface:'provider_outreach',source:'provider_transport',status:'failed',observedAt:at})
assert.ok(reconcileSamExternalSafety(possibleSideEffect).evidenceGaps.some(x=>x.includes('unreconciled transport failed')))

const duplicate=approved()
duplicate.receipts.push({...duplicate.receipts[0],id:duplicate.receipts[0].id})
assert.ok(reconcileSamExternalSafety(duplicate).evidenceGaps.some(x=>x.includes('duplicate external receipt')))
const useTwice=approved()
useTwice.receipts.push({...useTwice.receipts[0],id:'transport:2',operationId:'send-2'})
useTwice.approvals.push({...useTwice.approvals[0],operationId:'send-2'})
// Same approval ID cannot be safely used for two completed external operations.
assert.ok(reconcileSamExternalSafety(useTwice).observedViolations.some(x=>x.includes('single-execution approval reused')))

const chain={
  source:'action_core' as const,fromSequence:11,throughSequence:12,predecessorHash:'anchor10',
  records:[
    {sequence:11,previousHash:'anchor10',hash:'hash11',eventId:'e11'},
    {sequence:12,previousHash:'hash11',hash:'hash12',eventId:'e12'},
  ],
}
assert.deepEqual(inspectSamAuditChains([chain]),[])
assert.ok(inspectSamAuditChains([{...chain,records:[chain.records[1]]}]).some(x=>x.includes('incomplete chain')))
assert.ok(inspectSamAuditChains([{...chain,records:[chain.records[0],{...chain.records[1],sequence:13}]}]).some(x=>x.includes('sequence gap')))
assert.ok(inspectSamAuditChains([{...chain,records:[chain.records[0],{...chain.records[1],previousHash:'forged'}]}]).some(x=>x.includes('broken hash linkage')))
assert.ok(inspectSamAuditChains([chain,chain]).some(x=>x.includes('duplicate chain segment')))
const chainReported=clean()
chainReported.chains=[{...chain,records:[chain.records[1]]}]
assert.ok(reconcileSamExternalSafety(chainReported).chainGaps.length>0)
assert.equal(reconcileSamExternalSafety({...approved(),window:{from:through,through:from}}).status,'blocked')
console.log('SAM-SAFETY-LEDGER.08–.11 external receipt, approval and gap tests passed')
