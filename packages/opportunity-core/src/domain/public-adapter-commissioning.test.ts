import assert from 'node:assert/strict'
import {
  certifyPublicAdapter,
  fingerprintPublicPortal,
  planPublicAdapterCommissioning,
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

const blocked=certifyPublicAdapter({
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  sourceVerified:true,
  trials:trials.map((trial,index)=>index===1?{...trial,accessReviewApproved:false}:trial),
})
assert.equal(blocked.status,'BLOCKED')

const emptyTrials:PublicAdapterTrial[]=Array.from({length:5},(_,index)=>({
  ...trials[0]!,
  id:`empty:${index}`,
  observedAt:`2026-10-${String(index+1).padStart(2,'0')}T12:00:00Z`,
  sourceDigest:`empty-digest:${index}`,
  observationCount:0,
  stableExternalIdCount:0,
}))
const emptyDebt=certifyPublicAdapter({
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  sourceVerified:true,
  trials:emptyTrials,
})
assert.equal(emptyDebt.status,'BLOCKED')
assert.match(emptyDebt.blockers.join(' '),/degraded debt/i)

const failingTrials:PublicAdapterTrial[]=Array.from({length:5},(_,index)=>({
  ...trials[0]!,
  id:`failure:${index}`,
  observedAt:`2026-11-${String(index+1).padStart(2,'0')}T12:00:00Z`,
  sourceDigest:`failure-digest:${index}`,
  httpStatus:500,
  parseSucceeded:false,
  observationCount:0,
  stableExternalIdCount:0,
}))
const failingDebt=certifyPublicAdapter({
  sourceId:'source:1',
  adapterKey:'generic-html-v1',
  adapterVersion:'1.0.0',
  sourceVerified:true,
  trials:failingTrials,
})
assert.equal(failingDebt.status,'BLOCKED')
assert.match(failingDebt.blockers.join(' '),/minimum successful parse count/i)

console.log('public adapter commissioning tests passed')
