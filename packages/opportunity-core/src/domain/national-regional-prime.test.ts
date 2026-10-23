import assert from 'node:assert/strict'
import {regionalPrimeEvidenceFromAwards,buildRegionalPrimeMatrix} from './national-regional-prime.js'
const prime=regionalPrimeEvidenceFromAwards({
 providerId:'local-prime:az-landscaping',providerName:'Example historic prime',
 states:['AZ'],buyers:['Chandler'],awardCount:3,naicsCodes:['561730'],pscCodes:[],
 capabilityKeywords:['landscape','mowing','maintenance'],evidenceRefs:['official:chandler:award1']})
assert.equal(prime.partnerConsent,'not_requested')
assert.equal(prime.capacity,'unknown')
assert.equal(prime.quote,'missing')
const opportunity={
 opportunityId:'public-solicitation:az',buyer:'Arizona city',state:'AZ',county:'Maricopa',
 naicsCodes:['561730'],capabilityKeywords:['landscape','mowing'],
 sourceEvidenceRefs:['official:solicitation:1'],
 officialSolicitationComplete:false,addendaVerified:false,requiredTradeLicenses:[],
 bondingRequired:'unknown' as const,allowedPrimeStructure:'unknown' as const,
 directBidEligible:'unknown' as const,subcontractingAllowed:'unknown' as const,
 deadlineAt:'2026-11-10T10:00:00-07:00',
}
const matrix=buildRegionalPrimeMatrix({opportunity,providers:[prime],now:'2026-10-22T15:00:00Z'})
assert.equal(matrix.noSend,true)
assert.equal(matrix.biddingAuthorized,false)
assert.equal(matrix.results.length,6)
assert.ok(matrix.results.every(r=>r.disposition==='review_required'&&!r.bidSubmissionAuthorized&&!r.outBoundContactAuthorized))
assert.ok(matrix.results.every(r=>r.blockers.some(b=>b.includes('partner/team consent'))))
assert.ok(matrix.results.every(r=>r.blockers.some(b=>b.includes('written all-in quote'))))
assert.ok(matrix.results.every(r=>r.pastAwardNotCurrentCapacity))
const blocked=buildRegionalPrimeMatrix({opportunity,providers:[{...prime,partnerConsent:'declined'}],roles:['regional_prime_teaming']})
assert.equal(blocked.results[0]?.disposition,'blocked')
const elsewhere=buildRegionalPrimeMatrix({opportunity,providers:[{...prime,stateAwards:['FL']}],roles:['direct_prime']})
assert.ok(elsewhere.results[0]?.score<=30)
assert.ok(elsewhere.results[0]?.blockers.some(x=>x.includes('geography')))
const noEvidence=buildRegionalPrimeMatrix({opportunity,providers:[{...prime,officialAwardRefs:[]}],roles:['direct_prime']})
assert.equal(noEvidence.results[0]?.disposition,'blocked')
const passed=buildRegionalPrimeMatrix({opportunity:{...opportunity,officialSolicitationComplete:true,
 addendaVerified:true,allowedPrimeStructure:'verified',directBidEligible:'verified',subcontractingAllowed:'verified',
 bondingRequired:'no'},providers:[{...prime,partnerConsent:'accepted_for_this_scope',capacity:'available',
 quote:'firm_current',licensing:'verified_for_scope',bonding:'not_required_verified',insurance:'verified_for_scope',
 businessRegistration:'verified'}],roles:['regional_prime_teaming']})
assert.equal(passed.results[0]?.disposition,'review_required')
assert.equal(passed.biddingAuthorized,false)
assert.ok(passed.results[0]?.blockers.some(x=>x.includes('teaming agreement')))
assert.throws(()=>buildRegionalPrimeMatrix({opportunity,providers:[prime],maxCandidates:200}),/out of bounds/)
console.log('PROCURE.NATIONAL.FULL regional prime geography, NAICS, consent, capacity, pricing and no-send gates PASS')
