import assert from 'node:assert/strict'
import {assessSourceCanary,assessPrimeQualification,PRIME_QUALIFICATION_GATES,
 COST_CATEGORIES,assessBidEconomics} from './national-procurement-activation.js'
const source={sourceId:'oxnard',sourceUrl:'https://www.oxnard.gov/finance/purchasing/public-project-bidding',
 adapterKey:'generic-html-table-v1',adapterStatus:'adapter_required',accessReviewStatus:'approved_public_official',
 officiallyVerified:true,certifiedAt:null}
const failed=assessSourceCanary({source,expectedAdapterKey:'oxnard-public-project-bids-v1',
 trials:[{id:'a',adapterKey:'generic-html-table-v1',observedAt:'2026-10-22T19:56:00Z',httpStatus:403,
 parseSucceeded:false,observationCount:0,stableExternalIdCount:0,duplicateExternalIdCount:0,
 provenanceComplete:false,accessReviewApproved:true,errorCode:'source_http_403'}],
 accessEvidenceRefs:[],fullBidDocumentsVerified:false})
assert.equal(failed.siteAccessApprovedInRegistry,true)
assert.equal(failed.sourceCertifiedNow,false)
assert.ok(failed.blockers.includes('source_http_403_requires_access_remediation'))
assert.ok(failed.blockers.includes('exact_parser_version_not_commissioned'))
assert.ok(failed.blockers.includes('three_distinct_successful_exact_parser_trials_required'))
assert.ok(failed.blockers.includes('robots_and_terms_approval_evidence_missing'))
const positive=Array.from({length:3},(_,i)=>({id:'t'+i,adapterKey:'oxnard-public-project-bids-v1',
 observedAt:'2026-10-22T19:0'+i+':00Z',httpStatus:200,parseSucceeded:true,
 observationCount:2,stableExternalIdCount:2,duplicateExternalIdCount:0,
 provenanceComplete:true,accessReviewApproved:true,errorCode:null}))
const complete=assessSourceCanary({source:{...source,adapterKey:'oxnard-public-project-bids-v1',
 adapterStatus:'active',certifiedAt:'2026-10-22T22:00:00Z'},expectedAdapterKey:'oxnard-public-project-bids-v1',
 trials:positive,accessEvidenceRefs:['official-robots-access-assessment'],fullBidDocumentsVerified:true})
assert.equal(complete.blockers.length,0)
assert.equal(complete.sourceCertifiedNow,true)
assert.equal(complete.liveFeedActivationAuthorized,false)
assert.equal(complete.sourceCertificationEvidenceComplete,true)
assert.equal(complete.certificationReconciled,true)
assert.equal(complete.bidPackageVerified,true)
const feedOnly=assessSourceCanary({
 source:{...source,adapterKey:'oxnard-public-project-bids-v1'},expectedAdapterKey:'oxnard-public-project-bids-v1',
 trials:positive,accessEvidenceRefs:['official-terms-receipt'],fullBidDocumentsVerified:false})
assert.equal(feedOnly.sourceCertificationEvidenceComplete,true)
assert.equal(feedOnly.sourceCertifiedNow,false)
assert.deepEqual(feedOnly.bidPackageBlockers,['full_buyer_planholder_bid_package_missing'])
assert.ok(feedOnly.blockers.includes('source_not_commissioned'))
const duplicateSuccessful=assessSourceCanary({
 source:{...source,adapterKey:'oxnard-public-project-bids-v1'},
 expectedAdapterKey:'oxnard-public-project-bids-v1',
 trials:[positive[0]!,positive[0]!,positive[0]!,{
  ...positive[1]!,httpStatus:403,parseSucceeded:false
 },{
  ...positive[2]!,httpStatus:404,parseSucceeded:false
 }],
 accessEvidenceRefs:['access-reviewed'],fullBidDocumentsVerified:false})
assert.equal(duplicateSuccessful.sourceCertificationEvidenceComplete,false)
assert.equal(duplicateSuccessful.successfulExactParserTrials,3)
assert.ok(duplicateSuccessful.blockers.includes('three_distinct_successful_exact_parser_trials_required'))

assert.equal(PRIME_QUALIFICATION_GATES.length,12)
const bidder=assessPrimeQualification({opportunityId:'OXNARD-PW-25-96',
 providerName:'Historical bid tab participant',priorRole:'historical_bidder',evidence:[],asOf:'2026-10-22T20:00:00Z'})
assert.equal(bidder.verifiedRequirements,0)
assert.equal(bidder.historicalBidIsNotAward,true)
assert.equal(bidder.qualifiedToBid,false)
assert.equal(bidder.teamContactAuthorized,false)
const all=PRIME_QUALIFICATION_GATES.map(gate=>({gate,status:'verified' as const,evidenceRefs:['official-registration:'+gate]}))
const e=assessPrimeQualification({opportunityId:'OXNARD-PW-25-96',providerName:'Synthetic fully evidenced provider',
 priorRole:'historical_awardee',evidence:all,asOf:'2026-10-22T20:00:00Z'})
assert.equal(e.readyForHumanReview,true)
assert.equal(e.qualifiedToBid,false)
assert.equal(e.partnerEngagementAuthorized,false)
const overdue=assessPrimeQualification({opportunityId:'O',providerName:'Synthetic',
 priorRole:'potential_supplier',asOf:'2026-10-22T20:00:00Z',evidence:[{gate:'cslb_current_trade_class',
 status:'verified',evidenceRefs:['cslb:record'],expiresAt:'2026-10-01T00:00:00Z'}]})
assert.ok(overdue.blockers.includes('cslb_current_trade_class:expired'))
assert.equal(COST_CATEGORIES.length,13)
const terms={bidSecurityFraction:0.1,performanceBondCoverageFraction:1,paymentBondCoverageFraction:1,retainageFraction:0.05}
const missing=assessBidEconomics({opportunityId:'OXNARD-PW-25-96',asOf:'2026-10-22T20:00:00Z',
 proposedBidPriceUsd:null,bidPriceEvidenceRefs:[],costLines:[],requirements:terms,
 fullScopeAndAmendmentsVerified:false,writtenPrimeAndSupplierQuotesVerified:false,
 ownerCashBridgeUsd:null,cashBridgeEvidenceRefs:[]})
assert.equal(missing.complete,false)
assert.equal(missing.projectedGrossContributionUsd,null)
assert.equal(missing.bidSecurityFaceAmountUsd,null)
assert.ok(missing.blockers.includes('unpriced_or_unverified:direct_labor'))
const estimated=assessBidEconomics({opportunityId:'demo',asOf:'2026-10-22T20:00:00Z',
 proposedBidPriceUsd:200000,bidPriceEvidenceRefs:['written-bid-price'],
 costLines:COST_CATEGORIES.map(category=>({category,amountUsd:10000,provenance:'written_quote' as const,evidenceRefs:['quote:'+category]})),
 requirements:terms,fullScopeAndAmendmentsVerified:true,writtenPrimeAndSupplierQuotesVerified:true,
 ownerCashBridgeUsd:100000,cashBridgeEvidenceRefs:['bank:verified']})
assert.equal(estimated.complete,true)
assert.equal(estimated.costTotalUsd,130000)
assert.equal(estimated.projectedGrossContributionUsd,70000)
assert.equal(estimated.bidSecurityFaceAmountUsd,20000)
assert.equal(estimated.performanceBondFaceAmountUsd,200000)
assert.equal(estimated.paymentBondFaceAmountUsd,200000)
assert.equal(estimated.retainageWithheldAtFullValueUsd,10000)
assert.equal(estimated.spendingAuthorized,false)
assert.equal(estimated.proposalsSendable,false)
assert.throws(()=>assessBidEconomics({opportunityId:'demo',asOf:'2026-10-22',
 proposedBidPriceUsd:200000,bidPriceEvidenceRefs:['bid'],
 costLines:[{category:'direct_labor',amountUsd:-3,provenance:'written_quote',evidenceRefs:['quote']}],
 requirements:terms,fullScopeAndAmendmentsVerified:true,writtenPrimeAndSupplierQuotesVerified:true,
 ownerCashBridgeUsd:5,cashBridgeEvidenceRefs:['bank']}),/Negative\/invalid/)
console.log('PROCURE.ACTIVATE.20-24 source, prime, quote, bond face and cash-risk gates PASS')
