import assert from 'node:assert/strict'
import { buildSamPursuitOption } from './sam-pursuit-option.js'

const option=buildSamPursuitOption({
  noticeId:'N1',
  requirements:[
    {id:'r-food',label:'bulk food'},
    {id:'r-cold',label:'cold-chain delivery'},
  ],
  subcontractabilityStatus:'pass',
  candidates:[
    {requirementId:'r-food',providerKey:'foodco',providerName:'Food Co',status:'candidate',score:90,sources:['sam_entity','usaspending'],evidenceRefs:['sam:e1','usa:a1']},
    {requirementId:'r-cold',providerKey:'logco',providerName:'Logistics Co',status:'candidate',score:84,sources:['sam_entity','usaspending'],evidenceRefs:['sam:e2','usa:a2']},
  ],
  contractValue:500000,
  generatedAt:'2026-09-21T00:00:00.000Z',
})
assert.equal(option.status,'ready_for_quote')
assert.equal(option.assignments.length,2)
assert.equal(option.uncoveredRequirementIds.length,0)
assert.equal(option.commercial.status,'quote_required')
assert.equal(option.commercial.providerCost,null)
assert.equal(option.commercial.estimatedMarginPercent,null)
assert.equal(option.outreachAuthorized,false)
assert.equal(option.bidSubmissionAuthorized,false)
assert.equal(option.paymentAuthorized,false)

const singleSource=buildSamPursuitOption({
  noticeId:'N2',
  requirements:[{id:'r1',label:'food'}],
  subcontractabilityStatus:'pass',
  candidates:[{requirementId:'r1',providerKey:'x',providerName:'X',status:'candidate',score:99,sources:['usaspending'],evidenceRefs:['usa:x']}],
})
assert.equal(singleSource.status,'blocked')
assert.deepEqual(singleSource.uncoveredRequirementIds,['r1'])

const legalBlock=buildSamPursuitOption({
  noticeId:'N3',
  requirements:[{id:'r1',label:'food'}],
  subcontractabilityStatus:'blocked',
  subcontractabilityBlockers:['Non-U.S. food origin conflicts with detected domestic-source requirement.'],
  candidates:[{requirementId:'r1',providerKey:'mx',providerName:'Mexico Food',status:'candidate',score:99,sources:['sam_entity','usaspending'],evidenceRefs:['sam:mx','usa:mx']}],
})
assert.equal(legalBlock.status,'blocked')
assert.equal(legalBlock.assignments.length,0)

console.log('sam pursuit option tests passed')
