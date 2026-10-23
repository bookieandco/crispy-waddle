import assert from 'node:assert/strict'
import {assembleProcurementPilot} from './procurement-pilot-commission.js'
const active=assembleProcurementPilot('2026-10-22T15:00:00Z')
assert.equal(active.status,'research_only_no_send')
assert.deepEqual([active.outreachAuthorized,active.bidSubmissionAuthorized,active.signatureAuthorized,active.paymentAuthorized],[false,false,false,false])
assert.equal(active.opportunities.length,2)
const truck=active.opportunities.find(x=>x.id==='RUSD-2026-27-11')!
assert.equal(truck.candidates.length,3)
assert.equal(truck.deadlineAt,'2026-11-04T10:00:00-08:00')
assert.ok(truck.candidates.every(x=>x.qualification==='research_candidate'&&x.partnerConsent==='not_requested'&&x.quote==='not_requested'&&x.sourceUrl.startsWith('https://')))
assert.equal(truck.scopeComplete,false)
assert.equal(truck.bidSubmitted,false)
assert.equal(truck.requiredFormsVerified,false)
const county=active.opportunities.find(x=>x.id==='LAC-GCS-10639-S')!
assert.equal(county.deadlineStatus,'continuous_official')
assert.equal(county.awardedContract,false)
assert.equal(county.candidates.length,0)
assert.ok(assembleProcurementPilot('2026-11-05T20:00:00Z').opportunities[0]!.blockers.some(x=>x.includes('deadline has passed')))
console.log('PROCURE.COMMISSION pilot source provenance and blocked approval tests PASS')
