import assert from 'node:assert/strict'
import {NATIONAL_PURSUIT_GATES,assessNationalProcurementPursuit,type ProcurementGateEvidence} from './national-procurement-route-review.js'
assert.equal(NATIONAL_PURSUIT_GATES.length,22)
const base=assessNationalProcurementPursuit({opportunityId:'RUSD-2026-27-11',angle:'teaming',gates:[]})
assert.equal(base.status,'review_required')
assert.equal(base.missing.length,NATIONAL_PURSUIT_GATES.length)
assert.equal(base.bidSubmissionAuthorized,false)
const all=NATIONAL_PURSUIT_GATES.map(gate=>({gate,status:'verified' as const,evidenceRefs:['official-document:'+gate]}))
const known=assessNationalProcurementPursuit({opportunityId:'RUSD-2026-27-11',angle:'direct_prime',gates:all})
assert.equal(known.status,'human_approval_required')
assert.equal(known.routeReadyForSubmission,false)
assert.equal(known.paymentAuthorized,false)
const modified=assessNationalProcurementPursuit({opportunityId:'RUSD-2026-27-11',angle:'supplier_reseller',gates:
 [...all.filter(x=>x.gate!=='written_quote'),{gate:'written_quote' as const,status:'failed' as const,evidenceRefs:['quote-expired']}]})
assert.equal(modified.status,'blocked')
assert.deepEqual(modified.failed,['written_quote'])
const omitted=assessNationalProcurementPursuit({opportunityId:'RUSD-2026-27-11',angle:'subcontract',
 gates:[{gate:'bonds',status:'not_applicable_officially',evidenceRefs:[]}]})
assert.ok(omitted.missing.includes('bonds'))
assert.throws(()=>assessNationalProcurementPursuit({opportunityId:'x',angle:'teaming',
 gates:[{gate:'amendments',status:'verified',evidenceRefs:['1']},{gate:'amendments',status:'verified',evidenceRefs:['1']}]} as {opportunityId:string;angle:'teaming';gates:ProcurementGateEvidence[]}),/Duplicate/)
console.log('PROCURE.NATIONAL.FULL 21-gate bid/prime/financial/regulatory acceptance PASS')
