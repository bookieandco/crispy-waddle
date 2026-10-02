import assert from 'node:assert/strict'
import {
  certifyPublicAdapter,
  fingerprintPublicPortal,
  planPublicAdapterCommissioning,
  resolvePublicAdapterQueueDisposition,
  type PublicAdapterTrial,
} from './public-adapter-commissioning.js'

assert.equal(fingerprintPublicPortal('https://procurement.opengov.com/portal/example'),'opengov')
assert.equal(fingerprintPublicPortal('https://vendors.planetbids.com/portal/example'),'planetbids')
assert.equal(fingerprintPublicPortal('https://purchasing.lacounty.gov/bids'),'native_government')

const native=planPublicAdapterCommissioning({
  sourceUrl:'https://purchasing.lacounty.gov/bids',
  adapterKind:'html',
  status:'official_owner_verified',
  evidenceRefs:['e1'],
  blockers:[],
})
assert.equal(native.status,'SHADOW_READY')
assert.equal(native.templateKind,'generic_html_table')
assert.equal(native.automaticActivationAuthorized,false)

const portal=planPublicAdapterCommissioning({
  sourceUrl:'https://vendors.planetbids.com/portal/example',
  adapterKind:'portal',
  status:'official_portal_verified',
  evidenceRefs:['e2'],
  blockers:[],
})
assert.equal(portal.status,'PORTAL_TEMPLATE_REQUIRED')
assert.equal(portal.templateKind,'portal_specific')

const unverified=planPublicAdapterCommissioning({
  sourceUrl:'https://vendors.planetbids.com/portal/example',
  adapterKind:'portal',
  status:'candidate',
  evidenceRefs:['e3'],
  blockers:[],
})
assert.equal(unverified.status,'BLOCKED')

const trials:PublicAdapterTrial[]=Array.from({length:3},(_,index)=>({
  id:`trial:${index}`,
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  observedAt:`2026-10-0${index+1}T00:00:00Z`,
  sourceDigest:`digest:${index}`,
  httpStatus:200,
  parseSucceeded:true,
  observationCount:10,
  stableExternalIdCount:10,
  duplicateExternalIdCount:0,
  provenanceComplete:true,
  accessReviewApproved:true,
  evidenceRefs:[`e:${index}`],
}))

const certified=certifyPublicAdapter({
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  sourceVerified:true,
  trials,
})
assert.equal(certified.status,'ACTIVE_READ_ONLY')
assert.equal(certified.successfulTrials,3)
assert.equal(certified.stableExternalIdCoverage,1)
assert.equal(certified.externalActionAuthorized,false)

const emptyStructuredTrials:PublicAdapterTrial[]=Array.from({length:3},(_,index)=>({
  ...trials[index]!,
  id:`empty-trial:${index}`,
  observationCount:0,
  stableExternalIdCount:0,
}))
const emptyCertified=certifyPublicAdapter({
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  sourceVerified:true,
  trials:emptyStructuredTrials,
})
assert.equal(emptyCertified.status,'ACTIVE_READ_ONLY')
assert.equal(emptyCertified.stableExternalIdCoverage,1)

const blocked=certifyPublicAdapter({
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  sourceVerified:true,
  trials:trials.map((trial,index)=>index===1?{...trial,accessReviewApproved:false}:trial),
})
assert.equal(blocked.status,'BLOCKED')


const portalDisposition=resolvePublicAdapterQueueDisposition({
  planStatus:portal.status,
  convergence:true,
})
assert.equal(portalDisposition.adapterStatus,'degraded')
assert.equal(portalDisposition.terminalForConvergence,true)

const shadowDisposition=resolvePublicAdapterQueueDisposition({
  planStatus:'SHADOW_READY',
  accessApproved:true,
  convergence:true,
  certification:{
    status:'SHADOW',
    trialCount:3,
    blockers:['Successful trials produced no opportunity observations.'],
  },
})
assert.equal(shadowDisposition.adapterStatus,'degraded')
assert.equal(shadowDisposition.reason,'adapter_shadow_window_exhausted')

const pendingDisposition=resolvePublicAdapterQueueDisposition({
  planStatus:'SHADOW_READY',
  accessApproved:true,
  convergence:true,
  certification:{
    status:'SHADOW',
    trialCount:2,
    blockers:['Successful read-only shadow trials 2/3.'],
  },
})
assert.equal(pendingDisposition.adapterStatus,'adapter_required')
assert.equal(pendingDisposition.terminalForConvergence,false)

console.log('public adapter commissioning tests passed')
