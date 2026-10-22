import assert from 'node:assert/strict'
import {assembleProcurementPilot} from './procurement-pilot-commission.js'
import {buildRegionalPrimeMatrix,regionalPrimeEvidenceFromAwards} from './national-regional-prime.js'
import {assessNationalProcurementPursuit,NATIONAL_PURSUIT_GATES} from './national-procurement-route-review.js'
import {classifyProcurementPortal} from './national-procurement-expansion.js'
const pilot=assembleProcurementPilot('2026-10-22T18:00:00Z')
const rfq=pilot.opportunities.find(x=>x.id==='RUSD-2026-27-11')!
assert.ok(rfq)
assert.equal(rfq.scopeComplete,false)
assert.equal(rfq.bidSubmitted,false)
assert.equal(rfq.candidates.length,3)
const matrix=buildRegionalPrimeMatrix({
 opportunity:{
  opportunityId:rfq.id,buyer:rfq.buyer,state:'CA',county:'Riverside',
  capabilityKeywords:['vented','box','truck'],naicsCodes:[],sourceEvidenceRefs:[rfq.officialSourceUrl],
  officialSolicitationComplete:false,addendaVerified:false,requiredTradeLicenses:[],
  bondingRequired:'unknown',allowedPrimeStructure:'unknown',directBidEligible:'unknown',
  subcontractingAllowed:'unknown',deadlineAt:rfq.deadlineAt},
 providers:[regionalPrimeEvidenceFromAwards({
  providerId:'historical:regional',providerName:'Demonstration Regional Prime',awardCount:3,
  states:['CA'],buyers:['Public County'],naicsCodes:[],pscCodes:[],
  capabilityKeywords:['box','truck'],evidenceRefs:['official:award-history']})],
 now:'2026-10-22T18:00:00Z'})
assert.equal(matrix.results.length,6)
assert.ok(matrix.results.every(x=>x.disposition==='review_required'))
assert.ok(matrix.results.every(x=>x.evidenceRefs.length>0&&x.blockers.length>2))
const diligence=assessNationalProcurementPursuit({opportunityId:rfq.id,angle:'teaming',gates:[]})
assert.equal(diligence.missing.length,NATIONAL_PURSUIT_GATES.length)
assert.equal(diligence.noSend,true)
assert.equal(diligence.routeReadyForSubmission,false)
const portal=classifyProcurementPortal({
 sourceUrl:'https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx',
 officialBuyerLink:'https://www.riversideunified.org/departments/business-services/purchasing',
 officialBuyerVerified:true,loginRequired:true,robotsAccessApproved:false,
 reliableBidIds:true,closedBidDetection:true})
assert.equal(portal.certification,'not_certified')
assert.equal(portal.externalFetchAuthorized,false)
assert.ok(portal.blockers.some(x=>x.includes('login')))
assert.deepEqual([pilot.outreachAuthorized,pilot.bidSubmissionAuthorized,pilot.signatureAuthorized,
 pilot.paymentAuthorized,matrix.biddingAuthorized,diligence.bidSubmissionAuthorized],
 [false,false,false,false,false,false])
console.log('PROCURE.NATIONAL.FULL.12 first research pilot -> regional prime -> portal -> 21-gate no-send acceptance PASS')
