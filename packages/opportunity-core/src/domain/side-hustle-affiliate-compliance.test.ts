import assert from 'node:assert/strict'
import {
  buildAffiliateComplianceSnapshot,
  type AffiliateContentComplianceReview,
  type AffiliateDisclosureObservation,
  type AffiliateTermsSnapshot,
} from './side-hustle-affiliate-compliance.js'
import {
  buildSideHustleProfile,
} from './side-hustles.js'
import type {Opportunity} from './opportunity.js'
import type {SideHustleAffiliatePortfolioTruth} from './side-hustle-affiliate-portfolio.js'

const opportunity:Opportunity={
  id:'opportunity:affiliate:compliance',
  title:'Affiliate compliance fixture',
  family:'business',
  type:'commercial',
  sourceName:'fixture',
  sourceUrl:'https://example.test/affiliate',
  claims:[],
  evidence:[],
  verificationStatus:'unverified',
  sourceConfidence:.9,
  riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'commerce_affiliate'})},
  status:'ready',
  createdAt:'2026-10-01T00:00:00Z',
  updatedAt:'2026-10-01T00:00:00Z',
}

const portfolio:SideHustleAffiliatePortfolioTruth={
  opportunityId:opportunity.id,
  rawEventCount:3,
  canonicalEventCount:3,
  programs:[{
    providerRef:'provider:partnerize',
    programRef:'partnerize:campaign:campaign-7',
    clickCount:1,
    conversionCount:1,
    pendingConversionCount:0,
    approvedConversionCount:1,
    paidStateConversionCount:0,
    rejectedConversionCount:0,
    unknownConversionCount:0,
    reversalCount:0,
    payoutCount:1,
    currencies:[{
      currency:'USD',
      pendingCommissionAmount:0,
      approvedCommissionAmount:60,
      paidStateCommissionAmount:0,
      rejectedCommissionAmount:0,
      reversalAmount:0,
      payoutAmount:60,
      netApprovedAfterReversals:60,
      approvedEpc:60,
      realizedPayoutEpc:60,
      reversalRateByApprovedAmount:0,
      realizedRevenueAmount:60,
      realizedRevenueSource:'PAYOUT_EVENT_ONLY',
    }],
    evidenceRefs:['affiliate:conversion:1','affiliate:payout:1'],
    firstObservedAt:'2026-10-02T00:00:00Z',
    lastObservedAt:'2026-10-04T00:00:00Z',
    hasRealizedPayoutEvidence:true,
    authority:'AFFILIATE_PORTFOLIO_ANALYTICS_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }],
  realizedRevenueSource:'PAYOUT_EVENT_ONLY',
  warning:'APPROVED_COMMISSION_IS_NOT_REALIZED_REVENUE',
  authority:'AFFILIATE_PORTFOLIO_ANALYTICS_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
  moneyMovementAuthorized:false,
}

const networkTerms:AffiliateTermsSnapshot={
  id:'terms:partnerize',
  scope:'network',
  providerRef:'provider:partnerize',
  sourceUrl:'https://provider.example/terms',
  termsVersion:'2026-09',
  verifiedAt:'2026-10-03T12:00:00Z',
  evidenceRefs:['evidence:network-terms'],
  authority:'AFFILIATE_TERMS_OBSERVATION_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
  moneyMovementAuthorized:false,
}
const programTerms:AffiliateTermsSnapshot={
  id:'terms:campaign-7',
  scope:'program',
  providerRef:'provider:partnerize',
  programRef:'partnerize:campaign:campaign-7',
  sourceUrl:'https://merchant.example/affiliate-terms',
  verifiedAt:'2026-10-03T12:05:00Z',
  evidenceRefs:['evidence:program-terms'],
  authority:'AFFILIATE_TERMS_OBSERVATION_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
  moneyMovementAuthorized:false,
}
const disclosure:AffiliateDisclosureObservation={
  id:'disclosure:youtube:1',
  channel:'youtube',
  assetRef:'content:youtube:1',
  clearCommercialRelationship:true,
  prominent:true,
  beforeOrAdjacentToAffiliateLink:true,
  evidenceRefs:['evidence:youtube-disclosure'],
  observedAt:'2026-10-03T12:10:00Z',
  authority:'AFFILIATE_DISCLOSURE_OBSERVATION_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
}
const review:AffiliateContentComplianceReview={
  id:'review:youtube:1',
  channel:'youtube',
  assetRef:'content:youtube:1',
  reviewerType:'human',
  reviewerRef:'reviewer:owner',
  checks:{
    channelAllowed:'passed',
    claimsSubstantiated:'passed',
    firstHandClaimsTruthful:'not_applicable',
    syntheticMediaDisclosure:'not_applicable',
    brandBidding:'not_applicable',
    geoRestrictions:'passed',
    emailRules:'not_applicable',
  },
  evidenceRefs:['evidence:youtube-review'],
  reviewedAt:'2026-10-03T12:15:00Z',
  authority:'AFFILIATE_CONTENT_COMPLIANCE_REVIEW_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
}

const passed=buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:passed',
  opportunity,
  portfolio,
  usedChannels:['youtube'],
  termsSnapshots:[networkTerms,programTerms],
  disclosureObservations:[disclosure],
  contentReviews:[review],
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(passed.status,'passed')
assert.deepEqual(passed.activeProgramRefs,['partnerize:campaign:campaign-7'])
assert.deepEqual(passed.usedChannels,['youtube'])
assert.equal(passed.expiresAt,'2026-11-03T00:00:00.000Z')
assert.ok(passed.evidenceRefs.includes('evidence:program-terms'))
assert.equal(passed.externalActionAuthorized,false)

const missingProgramTerms=buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:missing-program',
  opportunity,
  portfolio,
  usedChannels:['youtube'],
  termsSnapshots:[networkTerms],
  disclosureObservations:[disclosure],
  contentReviews:[review],
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(missingProgramTerms.status,'blocked')
assert.ok(missingProgramTerms.blockers.some(value=>value.includes('missing program terms')))

const staleTerms=buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:stale',
  opportunity,
  portfolio,
  usedChannels:['youtube'],
  termsSnapshots:[
    {...networkTerms,verifiedAt:'2026-08-01T00:00:00Z'},
    {...programTerms,verifiedAt:'2026-08-01T00:00:00Z'},
  ],
  disclosureObservations:[disclosure],
  contentReviews:[review],
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(staleTerms.status,'blocked')
assert.ok(staleTerms.blockers.some(value=>value.includes('stale')))

const weakDisclosure=buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:weak-disclosure',
  opportunity,
  portfolio,
  usedChannels:['youtube'],
  termsSnapshots:[networkTerms,programTerms],
  disclosureObservations:[{...disclosure,prominent:false}],
  contentReviews:[review],
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(weakDisclosure.status,'blocked')
assert.ok(weakDisclosure.blockers.some(value=>value.includes('disclosure placement')))

const blockedReview=buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:blocked-review',
  opportunity,
  portfolio,
  usedChannels:['youtube'],
  termsSnapshots:[networkTerms,programTerms],
  disclosureObservations:[disclosure],
  contentReviews:[{
    ...review,
    checks:{...review.checks,claimsSubstantiated:'blocked'},
  }],
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(blockedReview.status,'blocked')
assert.ok(blockedReview.blockers.some(value=>value.includes('content compliance checks')))

const paidSearchReview:AffiliateContentComplianceReview={
  ...review,
  id:'review:paid-search',
  channel:'paid_search',
  assetRef:'content:paid-search:1',
  checks:{
    ...review.checks,
    brandBidding:'not_applicable',
  },
}
const paidSearchDisclosure:AffiliateDisclosureObservation={
  ...disclosure,
  id:'disclosure:paid-search',
  channel:'paid_search',
  assetRef:'content:paid-search:1',
}
const paidSearchBlocked=buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:paid-search',
  opportunity,
  portfolio,
  usedChannels:['paid_search'],
  termsSnapshots:[networkTerms,programTerms],
  disclosureObservations:[paidSearchDisclosure],
  contentReviews:[paidSearchReview],
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(paidSearchBlocked.status,'blocked')
assert.ok(paidSearchBlocked.blockers.some(value=>value.includes('content compliance checks')))

assert.throws(()=>buildAffiliateComplianceSnapshot({
  id:'affiliate-compliance:no-channel',
  opportunity,
  portfolio,
  usedChannels:[],
  termsSnapshots:[networkTerms,programTerms],
  disclosureObservations:[disclosure],
  contentReviews:[review],
  evaluatedAt:'2026-10-04T00:00:00Z',
}),/at least one used channel/)

console.log('side hustle affiliate compliance tests passed')
