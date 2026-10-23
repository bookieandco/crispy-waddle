import assert from 'node:assert/strict'
import {assessPublicContractCashBridge,assessRegionalPrimeChannel} from './national-procurement-working-capital.js'
const missing=assessPublicContractCashBridge({
 opportunityId:'OXNARD-PW-25-96',periods:[],verifiedUnrestrictedFundsUsd:null,
 fundingEvidenceRefs:[],drawScheduleComplete:false,paymentTermsVerified:false,
 retentionReleaseDateVerified:false})
assert.equal(missing.knownSchedule,false)
assert.equal(missing.peakUnfundedCashNeedUsd,null)
assert.equal(missing.fundsCoverModeledPeak,false)
const plan=[
 {period:'2026-11',customerReceiptsUsd:0,outgoingPaymentsUsd:100000,unpaidRetainageUsd:0,evidenceRefs:['phase-1-invoice']},
 {period:'2026-12',customerReceiptsUsd:50000,outgoingPaymentsUsd:70000,unpaidRetainageUsd:5000,evidenceRefs:['phase-2-buyer-terms']},
 {period:'2027-01',customerReceiptsUsd:150000,outgoingPaymentsUsd:40000,unpaidRetainageUsd:5000,evidenceRefs:['phase-3-buyer-terms']},
]
const insufficient=assessPublicContractCashBridge({
 opportunityId:'synthetic',periods:plan,verifiedUnrestrictedFundsUsd:90000,
 fundingEvidenceRefs:['bank-confirmed-available'],drawScheduleComplete:true,
 paymentTermsVerified:true,retentionReleaseDateVerified:true})
assert.equal(insufficient.knownSchedule,true)
assert.equal(insufficient.peakUnfundedCashNeedUsd,120000)
assert.equal(insufficient.additionalCashRequiredUsd,30000)
assert.equal(insufficient.unpaidRetainageUsd,10000)
assert.equal(insufficient.fundsCoverModeledPeak,false)
assert.equal(insufficient.noLoanAuthorized,true)
const sufficientlyFunded=assessPublicContractCashBridge({
 opportunityId:'synthetic',periods:plan,verifiedUnrestrictedFundsUsd:125000,
 fundingEvidenceRefs:['confirmed'],drawScheduleComplete:true,
 paymentTermsVerified:true,retentionReleaseDateVerified:true})
assert.equal(sufficientlyFunded.additionalCashRequiredUsd,0)
assert.equal(sufficientlyFunded.fundsCoverModeledPeak,true)
assert.equal(sufficientlyFunded.noBidAuthorized,true)
const undocumented=assessPublicContractCashBridge({
 opportunityId:'synthetic',periods:plan.map((x,i)=>i===1?{...x,evidenceRefs:[]}:x),
 verifiedUnrestrictedFundsUsd:125000,fundingEvidenceRefs:['confirmed'],
 drawScheduleComplete:true,paymentTermsVerified:true,retentionReleaseDateVerified:true})
assert.equal(undocumented.peakUnfundedCashNeedUsd,null)
assert.ok(undocumented.blockers.some(x=>x.includes('cash_period_source_missing')))
assert.throws(()=>assessPublicContractCashBridge({
 opportunityId:'synthetic',periods:[{period:'2026-11',customerReceiptsUsd:0,outgoingPaymentsUsd:-1,unpaidRetainageUsd:0,evidenceRefs:['a']}],
 verifiedUnrestrictedFundsUsd:100,fundingEvidenceRefs:['confirmed'],
 drawScheduleComplete:true,paymentTermsVerified:true,retentionReleaseDateVerified:true}),/nonnegative/)
const base={opportunityId:'RUSD-2026-27-11',kind:'goods_with_possible_installation' as const,
 kindDeterminationOfficial:false,bidderRegistrationVerified:false,fullBuyerTermsRead:false,
 bidderRoleApprovedInTerms:false,subcontractingOrResaleRulesVerified:false,
 currentLicensesVerified:false,currentDirRegistrationVerified:false,
 installationAndPrevailingWageClassificationVerified:false,
 partnerOrManufacturerAuthorizationVerified:false,writtenQuotesComplete:false,
 evidenceRefs:['https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx']}
const truck=assessRegionalPrimeChannel({opportunity:base,role:'authorized_dealer_or_distributor'})
assert.ok(truck.blockers.includes('installation_may_trigger_public_works_obligations'))
assert.ok(truck.blockers.includes('manufacturer_or_prime_consent_missing'))
assert.ok(truck.blockers.includes('official_purchase_classification_unverified'))
assert.equal(truck.treatedAsPublicWorks,false)
assert.equal(truck.constructionLawExemptionClaimed,false)
const works=assessRegionalPrimeChannel({opportunity:{
 ...base,opportunityId:'OXNARD-PW-25-96',kind:'public_works_construction',kindDeterminationOfficial:true},
 role:'licensed_general_prime'})
assert.ok(works.blockers.includes('current_dir_public_works_registration_missing'))
assert.ok(works.blockers.includes('scope_specific_active_trade_license_missing'))
const goods=assessRegionalPrimeChannel({opportunity:{...base,kind:'goods_and_equipment',
 kindDeterminationOfficial:true,fullBuyerTermsRead:true,bidderRegistrationVerified:true,
 bidderRoleApprovedInTerms:true,subcontractingOrResaleRulesVerified:true,
 writtenQuotesComplete:true,partnerOrManufacturerAuthorizationVerified:true},
 role:'authorized_dealer_or_distributor'})
assert.equal(goods.reviewedForHumanDecision,true)
assert.equal(goods.noBidAuthorized,true)
assert.equal(goods.constructionLawExemptionClaimed,false)
console.log('PROCURE.NATIONAL.CASH.25 source-linked cash bridge and scope-specific trade/dealer gates PASS')
