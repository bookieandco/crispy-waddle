import type {Opportunity} from './opportunity.js'
import type {
  SideHustleAffiliatePortfolioTruth,
} from './side-hustle-affiliate-portfolio.js'
import {isSideHustleProfile} from './side-hustles.js'

export type AffiliateComplianceChannel=
  |'website'
  |'youtube'
  |'instagram'
  |'tiktok'
  |'email'
  |'organic_search'
  |'paid_search'
  |'community'
  |'other'

export type AffiliateComplianceCheckStatus=
  |'passed'
  |'blocked'
  |'not_applicable'

export type AffiliateTermsSnapshot={
  id:string
  scope:'network'|'program'
  providerRef:string
  programRef?:string
  sourceUrl:string
  termsVersion?:string
  verifiedAt:string
  evidenceRefs:string[]
  authority:'AFFILIATE_TERMS_OBSERVATION_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export type AffiliateDisclosureObservation={
  id:string
  channel:AffiliateComplianceChannel
  assetRef:string
  clearCommercialRelationship:boolean
  prominent:boolean
  beforeOrAdjacentToAffiliateLink:boolean
  evidenceRefs:string[]
  observedAt:string
  authority:'AFFILIATE_DISCLOSURE_OBSERVATION_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
}

export type AffiliateContentComplianceChecks={
  channelAllowed:AffiliateComplianceCheckStatus
  claimsSubstantiated:AffiliateComplianceCheckStatus
  firstHandClaimsTruthful:AffiliateComplianceCheckStatus
  syntheticMediaDisclosure:AffiliateComplianceCheckStatus
  brandBidding:AffiliateComplianceCheckStatus
  geoRestrictions:AffiliateComplianceCheckStatus
  emailRules:AffiliateComplianceCheckStatus
}

export type AffiliateContentComplianceReview={
  id:string
  channel:AffiliateComplianceChannel
  assetRef:string
  reviewerType:'human'|'policy_engine'
  reviewerRef:string
  checks:AffiliateContentComplianceChecks
  evidenceRefs:string[]
  reviewedAt:string
  authority:'AFFILIATE_CONTENT_COMPLIANCE_REVIEW_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
}

export type AffiliateComplianceSnapshot={
  id:string
  opportunityId:string
  family:'commerce_affiliate'
  status:'passed'|'blocked'
  activeProviderRefs:string[]
  activeProgramRefs:string[]
  usedChannels:AffiliateComplianceChannel[]
  termsSnapshots:AffiliateTermsSnapshot[]
  disclosureObservations:AffiliateDisclosureObservation[]
  contentReviews:AffiliateContentComplianceReview[]
  blockers:string[]
  evidenceRefs:string[]
  evaluatedAt:string
  expiresAt:string
  authority:'AFFILIATE_COMPLIANCE_SNAPSHOT_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export function buildAffiliateComplianceSnapshot(input:{
  id:string
  opportunity:Opportunity
  portfolio:SideHustleAffiliatePortfolioTruth
  usedChannels:AffiliateComplianceChannel[]
  termsSnapshots:AffiliateTermsSnapshot[]
  disclosureObservations:AffiliateDisclosureObservation[]
  contentReviews:AffiliateContentComplianceReview[]
  evaluatedAt:string
  freshnessDays?:number
}):AffiliateComplianceSnapshot{
  const id=requireText(input.id,'affiliateCompliance.id')
  const profile=input.opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='commerce_affiliate'){
    throw new Error('Affiliate compliance requires commerce_affiliate Opportunity')
  }
  if(input.portfolio.opportunityId&&input.portfolio.opportunityId!==input.opportunity.id){
    throw new Error('Affiliate compliance portfolio does not belong to opportunity')
  }

  const evaluatedAt=requireDate(input.evaluatedAt,'affiliateCompliance.evaluatedAt')
  const freshnessDays=input.freshnessDays??30
  if(!Number.isInteger(freshnessDays)||freshnessDays<1||freshnessDays>90){
    throw new Error('affiliateCompliance.freshnessDays must be an integer between 1 and 90')
  }
  const minFreshAt=new Date(
    Date.parse(evaluatedAt)-freshnessDays*86_400_000,
  ).toISOString()
  const expiresAt=new Date(
    Date.parse(evaluatedAt)+freshnessDays*86_400_000,
  ).toISOString()

  const usedChannels=uniqueChannels(input.usedChannels)
  if(usedChannels.length===0){
    throw new Error('Affiliate compliance requires at least one used channel')
  }

  const activePrograms=input.portfolio.programs.filter(program=>
    program.approvedConversionCount+
      program.paidStateConversionCount+
      (program.hasRealizedPayoutEvidence?1:0)>0
  )
  const activeProviderRefs=unique(
    activePrograms.map(program=>program.providerRef),
  )
  const activeProgramRefs=unique(
    activePrograms.map(program=>program.programRef),
  )

  const termsSnapshots=input.termsSnapshots.map(snapshot=>
    normalizeTermsSnapshot(snapshot)
  )
  const disclosureObservations=input.disclosureObservations.map(observation=>
    normalizeDisclosureObservation(observation)
  )
  const contentReviews=input.contentReviews.map(review=>
    normalizeContentReview(review)
  )
  const blockers:string[]=[]

  if(activePrograms.length===0){
    blockers.push('no commercially active affiliate program has conversion or payout evidence')
  }

  for(const providerRef of activeProviderRefs){
    const matches=termsSnapshots.filter(snapshot=>
      snapshot.scope==='network'&&snapshot.providerRef===providerRef
    )
    if(matches.length===0){
      blockers.push(`missing network terms evidence for ${providerRef}`)
      continue
    }
    if(!matches.some(snapshot=>
      isFresh(snapshot.verifiedAt,minFreshAt,evaluatedAt)
    )){
      blockers.push(`network terms evidence is stale for ${providerRef}`)
    }
  }

  for(const program of activePrograms){
    const matches=termsSnapshots.filter(snapshot=>
      snapshot.scope==='program'&&
      snapshot.providerRef===program.providerRef&&
      snapshot.programRef===program.programRef
    )
    if(matches.length===0){
      blockers.push(`missing program terms evidence for ${program.programRef}`)
      continue
    }
    if(!matches.some(snapshot=>
      isFresh(snapshot.verifiedAt,minFreshAt,evaluatedAt)
    )){
      blockers.push(`program terms evidence is stale for ${program.programRef}`)
    }
  }

  for(const snapshot of termsSnapshots){
    if(!isFresh(snapshot.verifiedAt,minFreshAt,evaluatedAt)){
      continue
    }
    if(!isHttpsUrl(snapshot.sourceUrl)){
      blockers.push(`terms source is not HTTPS for ${snapshot.id}`)
    }
  }

  for(const channel of usedChannels){
    const disclosures=disclosureObservations.filter(observation=>
      observation.channel===channel&&
      isFresh(observation.observedAt,minFreshAt,evaluatedAt)
    )
    if(disclosures.length===0){
      blockers.push(`missing fresh disclosure evidence for channel ${channel}`)
    }else if(!disclosures.some(observation=>
      observation.clearCommercialRelationship&&
      observation.prominent&&
      observation.beforeOrAdjacentToAffiliateLink
    )){
      blockers.push(`disclosure placement is not compliant for channel ${channel}`)
    }

    const reviews=contentReviews.filter(review=>
      review.channel===channel&&
      isFresh(review.reviewedAt,minFreshAt,evaluatedAt)
    )
    if(reviews.length===0){
      blockers.push(`missing fresh content compliance review for channel ${channel}`)
      continue
    }
    const passing=reviews.find(review=>reviewPasses(review,channel))
    if(!passing){
      blockers.push(`content compliance checks are not all satisfied for channel ${channel}`)
    }
  }

  const evidenceRefs=unique([
    ...termsSnapshots.flatMap(snapshot=>snapshot.evidenceRefs),
    ...disclosureObservations.flatMap(observation=>observation.evidenceRefs),
    ...contentReviews.flatMap(review=>review.evidenceRefs),
    ...activePrograms.flatMap(program=>program.evidenceRefs),
  ])
  if(evidenceRefs.length===0){
    blockers.push('affiliate compliance has no supporting evidence references')
  }

  return{
    id,
    opportunityId:input.opportunity.id,
    family:'commerce_affiliate',
    status:blockers.length===0?'passed':'blocked',
    activeProviderRefs,
    activeProgramRefs,
    usedChannels,
    termsSnapshots,
    disclosureObservations,
    contentReviews,
    blockers:unique(blockers),
    evidenceRefs,
    evaluatedAt,
    expiresAt,
    authority:'AFFILIATE_COMPLIANCE_SNAPSHOT_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function normalizeTermsSnapshot(
  snapshot:AffiliateTermsSnapshot,
):AffiliateTermsSnapshot{
  requireText(snapshot.id,'affiliateTerms.id')
  requireText(snapshot.providerRef,'affiliateTerms.providerRef')
  if(snapshot.scope==='program'){
    requireText(snapshot.programRef??'','affiliateTerms.programRef')
  }
  const sourceUrl=requireText(snapshot.sourceUrl,'affiliateTerms.sourceUrl')
  const verifiedAt=requireDate(snapshot.verifiedAt,'affiliateTerms.verifiedAt')
  const evidenceRefs=requireEvidence(snapshot.evidenceRefs,'affiliateTerms.evidenceRefs')
  return{
    ...snapshot,
    id:snapshot.id.trim(),
    providerRef:snapshot.providerRef.trim(),
    programRef:snapshot.programRef?.trim()||undefined,
    sourceUrl,
    termsVersion:snapshot.termsVersion?.trim()||undefined,
    verifiedAt,
    evidenceRefs,
    authority:'AFFILIATE_TERMS_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function normalizeDisclosureObservation(
  observation:AffiliateDisclosureObservation,
):AffiliateDisclosureObservation{
  requireText(observation.id,'affiliateDisclosure.id')
  requireText(observation.assetRef,'affiliateDisclosure.assetRef')
  const evidenceRefs=requireEvidence(
    observation.evidenceRefs,
    'affiliateDisclosure.evidenceRefs',
  )
  return{
    ...observation,
    id:observation.id.trim(),
    assetRef:observation.assetRef.trim(),
    evidenceRefs,
    observedAt:requireDate(
      observation.observedAt,
      'affiliateDisclosure.observedAt',
    ),
    authority:'AFFILIATE_DISCLOSURE_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

function normalizeContentReview(
  review:AffiliateContentComplianceReview,
):AffiliateContentComplianceReview{
  requireText(review.id,'affiliateComplianceReview.id')
  requireText(review.assetRef,'affiliateComplianceReview.assetRef')
  requireText(review.reviewerRef,'affiliateComplianceReview.reviewerRef')
  const evidenceRefs=requireEvidence(
    review.evidenceRefs,
    'affiliateComplianceReview.evidenceRefs',
  )
  for(const [name,status] of Object.entries(review.checks)){
    if(!['passed','blocked','not_applicable'].includes(status)){
      throw new Error(`affiliateComplianceReview.checks.${name} is invalid`)
    }
  }
  return{
    ...review,
    id:review.id.trim(),
    assetRef:review.assetRef.trim(),
    reviewerRef:review.reviewerRef.trim(),
    evidenceRefs,
    reviewedAt:requireDate(
      review.reviewedAt,
      'affiliateComplianceReview.reviewedAt',
    ),
    authority:'AFFILIATE_CONTENT_COMPLIANCE_REVIEW_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

function reviewPasses(
  review:AffiliateContentComplianceReview,
  channel:AffiliateComplianceChannel,
):boolean{
  if(review.checks.channelAllowed!=='passed')return false
  if(review.checks.claimsSubstantiated!=='passed')return false

  const optionalChecks:Array<keyof AffiliateContentComplianceChecks>=[
    'firstHandClaimsTruthful',
    'syntheticMediaDisclosure',
    'geoRestrictions',
  ]
  for(const key of optionalChecks){
    if(review.checks[key]==='blocked')return false
  }

  if(channel==='paid_search'){
    if(review.checks.brandBidding!=='passed')return false
  }else if(review.checks.brandBidding==='blocked'){
    return false
  }

  if(channel==='email'){
    if(review.checks.emailRules!=='passed')return false
  }else if(review.checks.emailRules==='blocked'){
    return false
  }
  return true
}

function uniqueChannels(
  values:readonly AffiliateComplianceChannel[],
):AffiliateComplianceChannel[]{
  const allowed=new Set<AffiliateComplianceChannel>([
    'website','youtube','instagram','tiktok','email',
    'organic_search','paid_search','community','other',
  ])
  const normalized=values.filter(value=>allowed.has(value))
  if(normalized.length!==values.length){
    throw new Error('Affiliate compliance usedChannels contains an invalid channel')
  }
  return [...new Set(normalized)]
}

function isFresh(
  value:string,
  minFreshAt:string,
  evaluatedAt:string,
):boolean{
  const time=Date.parse(value)
  return Number.isFinite(time)&&
    time>=Date.parse(minFreshAt)&&
    time<=Date.parse(evaluatedAt)
}

function isHttpsUrl(value:string):boolean{
  try{
    return new URL(value).protocol==='https:'
  }catch{
    return false
  }
}

function requireText(value:string,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}

function requireDate(value:string,field:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed))throw new Error(`${field} must be a valid date`)
  return new Date(parsed).toISOString()
}

function requireEvidence(values:readonly string[],field:string):string[]{
  const normalized=unique(values)
  if(normalized.length===0)throw new Error(`${field} requires non-empty evidence references`)
  return normalized
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}
