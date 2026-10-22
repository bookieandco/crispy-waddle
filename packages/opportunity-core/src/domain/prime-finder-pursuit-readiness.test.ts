import assert from 'node:assert/strict'
import {assessPrimeFinderPursuit} from './prime-finder-pursuit-readiness.js'
import type {FulfillmentPlan} from './fulfillment-plan.js'
import type {PublicSubcontractWorkPackage} from './public-award-prime.js'
import type {PrimeSubcontractorMatch} from './prime-subcontractor-matching.js'

const plan={
  opportunityId:'opp:1',structure:'prime_with_subcontractor',
  assignments:[{providerId:'sub:1'}],uncoveredRequirementIds:[],blockers:[],
} as unknown as FulfillmentPlan
const pkg={
  id:'pkg:1',opportunityId:'opp:1',status:'candidate',blockers:[],
  requiredLicenses:['C-39'],requiredCertifications:[],
} as unknown as PublicSubcontractWorkPackage
const match={
  disposition:'matched_candidate',blockers:[],
} as unknown as PrimeSubcontractorMatch
const input={
  package:pkg,match,fulfillmentPlan:plan,
  commercialAssumptions:{contractValue:10000,providerCosts:{'sub:1':5000}},
  subcontractability:{agencyKind:'civilian' as const,contractKind:'service' as const,isFood:false,clauses:['52.219-14']},
  primeSubcontractRequestVerified:true,licenseAndCertificationEvidenceVerified:true,
}
const ready=assessPrimeFinderPursuit(input)
assert.equal(ready.status,'ready_for_human_review')
assert.equal(ready.outreachAuthorized,false)
assert.equal(assessPrimeFinderPursuit({...input,commercialAssumptions:{contractValue:10000}}).status,'blocked')
assert.equal(assessPrimeFinderPursuit({...input,primeSubcontractRequestVerified:false}).status,'blocked')
assert.equal(assessPrimeFinderPursuit({...input,licenseAndCertificationEvidenceVerified:false}).status,'blocked')
console.log('prime-finder pursuit readiness tests passed')
