import type {Opportunity} from './opportunity.js'
import {isSideHustleProfile} from './side-hustles.js'

export type DigitalProductTier=
  |'business_roi'
  |'productivity'
  |'decorative'
  |'knowledge'

export type DigitalProductFamily=
  |'pitch_deck'
  |'business_form'
  |'workbook'
  |'brand_system'
  |'social_template'
  |'marketplace_merchandising'
  |'planner'
  |'journal'
  |'tracker'
  |'wall_art'
  |'sticker_sheet'
  |'ai_knowledge'

export type DigitalProductFamilyDefinition={
  family:DigitalProductFamily
  tier:DigitalProductTier
  buyerType:'business'|'consumer'|'mixed'
  bundleFriendly:boolean
  customizationFriendly:boolean
  legalReviewSensitive:boolean
  notes:string
}

export const DIGITAL_PRODUCT_FAMILY_DEFINITIONS:
readonly DigitalProductFamilyDefinition[]=[
  {
    family:'pitch_deck',
    tier:'business_roi',
    buyerType:'business',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'Narrative architecture and decision clarity matter more than decorative slide volume.',
  },
  {
    family:'business_form',
    tier:'business_roi',
    buyerType:'business',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:true,
    notes:'Operational forms are distinct from documents that purport to create legal rights or obligations.',
  },
  {
    family:'workbook',
    tier:'business_roi',
    buyerType:'mixed',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'Useful workbooks require coherent instruction, exercises, answer space, and action flow.',
  },
  {
    family:'brand_system',
    tier:'business_roi',
    buyerType:'business',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'A reusable brand system can graduate into custom branding services.',
  },
  {
    family:'social_template',
    tier:'business_roi',
    buyerType:'business',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'Channel-specific systems should preserve meaningful differentiation across variants.',
  },
  {
    family:'marketplace_merchandising',
    tier:'business_roi',
    buyerType:'business',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'Seller kits can include listing media, mockup systems, and merchandising workflows.',
  },
  {
    family:'planner',
    tier:'productivity',
    buyerType:'consumer',
    bundleFriendly:true,
    customizationFriendly:false,
    legalReviewSensitive:false,
    notes:'Planning products should solve a concrete workflow rather than add decorative pages.',
  },
  {
    family:'journal',
    tier:'productivity',
    buyerType:'consumer',
    bundleFriendly:true,
    customizationFriendly:false,
    legalReviewSensitive:false,
    notes:'Journals need a clear use case and original structure.',
  },
  {
    family:'tracker',
    tier:'productivity',
    buyerType:'mixed',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'Trackers should make a measurable recurring task easier.',
  },
  {
    family:'wall_art',
    tier:'decorative',
    buyerType:'consumer',
    bundleFriendly:true,
    customizationFriendly:false,
    legalReviewSensitive:false,
    notes:'Decorative products need differentiation and strong provenance because competition is high.',
  },
  {
    family:'sticker_sheet',
    tier:'decorative',
    buyerType:'consumer',
    bundleFriendly:true,
    customizationFriendly:false,
    legalReviewSensitive:false,
    notes:'Original visual systems are preferred over minimally transformed asset packs.',
  },
  {
    family:'ai_knowledge',
    tier:'knowledge',
    buyerType:'mixed',
    bundleFriendly:true,
    customizationFriendly:true,
    legalReviewSensitive:false,
    notes:'Marketplace eligibility varies materially; policy snapshots must decide where these products may be listed.',
  },
] as const

export type DigitalProductOpportunitySignals={
  demand:number
  buyerIntent:number
  pricePotential:number
  marginPotential:number
  differentiation:number
  searchability:number
  repeatability:number
  bundlePotential:number
  competition:number
  productionCost:number
  supportBurden:number
}

export type DigitalProductOpportunityScore={
  score:number
  positiveStrength:number
  friction:number
  decision:'reject'|'research'|'validate'|'priority'
  reasons:string[]
  authority:'DIGITAL_PRODUCT_OPPORTUNITY_ANALYTICS_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
}

export type DigitalProductIndustryMatrixCell={
  id:string
  opportunityId:string
  industry:string
  businessStage:string
  businessFunction:string
  buyerRole:string
  lifecycleStep:string
  buyerType:'business'|'consumer'
  family:DigitalProductFamily
  productType:string
  problem:string
  desiredOutcome:string
  evidenceRefs:string[]
}

export type DigitalProductB2bRoiSignals={
  timeSaved:number
  revenueEnablement:number
  riskReduction:number
  workflowCriticality:number
  repeatUsage:number
  customizationUpsell:number
}

export type DigitalProductB2bRoiScore={
  score:number
  tier:'low'|'medium'|'high'
  reasons:string[]
  authority:'DIGITAL_PRODUCT_B2B_ROI_ANALYTICS_ONLY'
  externalActionAuthorized:false
}

export type MarketplaceProductEligibility=
  |'allowed'
  |'allowed_with_requirements'
  |'prohibited'
  |'review_required'

export type MarketplacePolicyRule={
  id:string
  productFamily?:DigitalProductFamily
  productType?:string
  eligibility:MarketplaceProductEligibility
  requirements:string[]
  evidenceRefs:string[]
}

export type MarketplacePolicySnapshot={
  id:string
  marketplace:string
  sourceUrl:string
  verifiedAt:string
  recheckAfter:string
  rules:MarketplacePolicyRule[]
  evidenceRefs:string[]
  authority:'MARKETPLACE_POLICY_OBSERVATION_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
}

export type DigitalProductDraft={
  id:string
  opportunityId:string
  family:DigitalProductFamily
  productType:string
  title:string
  buyerType:'business'|'consumer'
  marketplaceDisclosures:string[]
  evidenceRefs:string[]
}

export type MarketplaceEligibilityEvaluation={
  productId:string
  marketplace:string
  status:'eligible'|'conditional'|'blocked'|'review_required'|'stale'
  matchedRuleId?:string
  requirements:string[]
  reasons:string[]
  policySnapshotId:string
  evaluatedAt:string
  authority:'MARKETPLACE_ELIGIBILITY_ANALYTICS_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
}

export type DigitalProductCreationMethod=
  |'original_manual'
  |'original_ai_assisted'
  |'template_transformed'
  |'commissioned'
  |'mixed'

export type DigitalProductSourceAsset={
  assetRef:string
  sourceType:'original'|'licensed'|'public_domain'|'generated'|'template'
  licenseRef?:string
  commercialUseAllowed:boolean
  redistributionAllowed:boolean
  evidenceRefs:string[]
}

export type DigitalProductProvenanceRecord={
  id:string
  productId:string
  creationMethod:DigitalProductCreationMethod
  sourceAssets:DigitalProductSourceAsset[]
  aiModels:string[]
  humanEdits:string[]
  templateProvider?:string
  templateLicenseRef?:string
  fonts:string[]
  commercialRightsVerified:boolean
  marketplaceDisclosures:string[]
  originalityHash:string
  exportFiles:string[]
  evidenceRefs:string[]
  observedAt:string
  authority:'DIGITAL_PRODUCT_PROVENANCE_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
}

export type DigitalProductProvenanceAssessment={
  productId:string
  status:'passed'|'blocked'
  blockers:string[]
  evidenceRefs:string[]
  authority:'DIGITAL_PRODUCT_PROVENANCE_ASSESSMENT_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
}

export function scoreDigitalProductOpportunity(
  signals:DigitalProductOpportunitySignals,
):DigitalProductOpportunityScore{
  const positiveKeys:Array<keyof DigitalProductOpportunitySignals>=[
    'demand','buyerIntent','pricePotential','marginPotential',
    'differentiation','searchability','repeatability','bundlePotential',
  ]
  const frictionKeys:Array<keyof DigitalProductOpportunitySignals>=[
    'competition','productionCost','supportBurden',
  ]
  for(const [name,value] of Object.entries(signals)){
    requireUnit(value,`digitalProductOpportunity.${name}`)
  }
  const positiveStrength=geometricMean(
    positiveKeys.map(key=>floorUnit(signals[key])),
  )
  const friction=geometricMean(
    frictionKeys.map(key=>floorUnit(signals[key])),
  )
  const normalized=clamp(
    positiveStrength/(positiveStrength+friction),
    0,
    1,
  )
  const score=round(normalized*100,2)
  const decision=
    score>=75?'priority':
    score>=60?'validate':
    score>=40?'research':
    'reject'
  const reasons=[
    `positive strength ${round(positiveStrength*100,2)}/100`,
    `friction ${round(friction*100,2)}/100`,
    `decision ${decision}`,
  ]
  return{
    score,
    positiveStrength:round(positiveStrength,6),
    friction:round(friction,6),
    decision,
    reasons,
    authority:'DIGITAL_PRODUCT_OPPORTUNITY_ANALYTICS_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
  }
}

export function createDigitalProductIndustryMatrixCell(input:{
  opportunity:Opportunity
  id:string
  industry:string
  businessStage:string
  businessFunction:string
  buyerRole:string
  lifecycleStep:string
  buyerType:'business'|'consumer'
  family:DigitalProductFamily
  productType:string
  problem:string
  desiredOutcome:string
  evidenceRefs:string[]
}):DigitalProductIndustryMatrixCell{
  requireDigitalProductOpportunity(input.opportunity)
  requireFamily(input.family)
  const definition=getDigitalProductFamilyDefinition(input.family)
  if(definition.buyerType!=='mixed'&&definition.buyerType!==input.buyerType){
    throw new Error(
      `Digital product family ${input.family} does not support buyer type ${input.buyerType}`
    )
  }
  return{
    id:requireText(input.id,'digitalProductMatrix.id'),
    opportunityId:input.opportunity.id,
    industry:requireText(input.industry,'digitalProductMatrix.industry'),
    businessStage:requireText(input.businessStage,'digitalProductMatrix.businessStage'),
    businessFunction:requireText(input.businessFunction,'digitalProductMatrix.businessFunction'),
    buyerRole:requireText(input.buyerRole,'digitalProductMatrix.buyerRole'),
    lifecycleStep:requireText(input.lifecycleStep,'digitalProductMatrix.lifecycleStep'),
    buyerType:input.buyerType,
    family:input.family,
    productType:requireText(input.productType,'digitalProductMatrix.productType'),
    problem:requireText(input.problem,'digitalProductMatrix.problem'),
    desiredOutcome:requireText(input.desiredOutcome,'digitalProductMatrix.desiredOutcome'),
    evidenceRefs:requireEvidence(input.evidenceRefs,'digitalProductMatrix.evidenceRefs'),
  }
}

export function scoreDigitalProductB2bRoi(
  cell:DigitalProductIndustryMatrixCell,
  signals:DigitalProductB2bRoiSignals,
):DigitalProductB2bRoiScore{
  if(cell.buyerType!=='business'){
    throw new Error('B2B ROI scoring requires a business buyer')
  }
  for(const [name,value] of Object.entries(signals)){
    requireUnit(value,`digitalProductB2bRoi.${name}`)
  }
  const score=round(
    (
      signals.timeSaved*.18+
      signals.revenueEnablement*.22+
      signals.riskReduction*.15+
      signals.workflowCriticality*.2+
      signals.repeatUsage*.15+
      signals.customizationUpsell*.1
    )*100,
    2,
  )
  const tier=score>=75?'high':score>=50?'medium':'low'
  return{
    score,
    tier,
    reasons:[
      `workflow criticality ${round(signals.workflowCriticality*100,0)}/100`,
      `revenue enablement ${round(signals.revenueEnablement*100,0)}/100`,
      `repeat usage ${round(signals.repeatUsage*100,0)}/100`,
      `customization upsell ${round(signals.customizationUpsell*100,0)}/100`,
    ],
    authority:'DIGITAL_PRODUCT_B2B_ROI_ANALYTICS_ONLY',
    externalActionAuthorized:false,
  }
}

export function getDigitalProductFamilyDefinition(
  family:DigitalProductFamily,
):DigitalProductFamilyDefinition{
  const definition=DIGITAL_PRODUCT_FAMILY_DEFINITIONS.find(
    item=>item.family===family,
  )
  if(!definition)throw new Error(`Unknown digital product family: ${family}`)
  return definition
}

export function validateDigitalProductDraft(
  product:DigitalProductDraft,
  opportunity?:Opportunity,
):DigitalProductDraft{
  requireText(product.id,'digitalProductDraft.id')
  requireText(product.opportunityId,'digitalProductDraft.opportunityId')
  requireFamily(product.family)
  requireText(product.productType,'digitalProductDraft.productType')
  requireText(product.title,'digitalProductDraft.title')
  requireEvidence(product.evidenceRefs,'digitalProductDraft.evidenceRefs')
  if(opportunity){
    requireDigitalProductOpportunity(opportunity)
    if(product.opportunityId!==opportunity.id){
      throw new Error('Digital product draft does not belong to opportunity')
    }
  }
  const definition=getDigitalProductFamilyDefinition(product.family)
  if(definition.buyerType!=='mixed'&&definition.buyerType!==product.buyerType){
    throw new Error(
      `Digital product family ${product.family} does not support buyer type ${product.buyerType}`
    )
  }
  return{
    ...product,
    id:product.id.trim(),
    opportunityId:product.opportunityId.trim(),
    productType:product.productType.trim(),
    title:product.title.trim(),
    marketplaceDisclosures:[
      ...new Set(product.marketplaceDisclosures.map(value=>value.trim()).filter(Boolean)),
    ],
    evidenceRefs:[...new Set(product.evidenceRefs.map(value=>value.trim()).filter(Boolean))],
  }
}

export function evaluateDigitalProductMarketplaceEligibility(input:{
  product:DigitalProductDraft
  policy:MarketplacePolicySnapshot
  evaluatedAt:string
}):MarketplaceEligibilityEvaluation{
  const evaluatedAt=requireDate(input.evaluatedAt,'marketplaceEligibility.evaluatedAt')
  const product=validateDigitalProductDraft(input.product)
  const policy=validateMarketplacePolicySnapshot(input.policy)
  if(Date.parse(evaluatedAt)>Date.parse(policy.recheckAfter)){
    return{
      productId:product.id,
      marketplace:policy.marketplace,
      status:'stale',
      requirements:[],
      reasons:['marketplace policy snapshot requires re-verification'],
      policySnapshotId:policy.id,
      evaluatedAt,
      authority:'MARKETPLACE_ELIGIBILITY_ANALYTICS_ONLY',
      externalActionAuthorized:false,
      publishingAuthorized:false,
    }
  }

  const matching=policy.rules
    .filter(rule=>
      (!rule.productFamily||rule.productFamily===product.family)&&
      (!rule.productType||rule.productType===product.productType)
    )
    .sort((a,b)=>specificity(b)-specificity(a))
  const rule=matching[0]
  if(!rule){
    return{
      productId:product.id,
      marketplace:policy.marketplace,
      status:'review_required',
      requirements:[],
      reasons:['no marketplace policy rule covers this product'],
      policySnapshotId:policy.id,
      evaluatedAt,
      authority:'MARKETPLACE_ELIGIBILITY_ANALYTICS_ONLY',
      externalActionAuthorized:false,
      publishingAuthorized:false,
    }
  }

  const status=
    rule.eligibility==='allowed'?'eligible':
    rule.eligibility==='allowed_with_requirements'?'conditional':
    rule.eligibility==='prohibited'?'blocked':
    'review_required'

  const missingDisclosures=
    rule.eligibility==='allowed_with_requirements'
      ?rule.requirements.filter(requirement=>
        requirement.startsWith('disclosure:')&&
        !product.marketplaceDisclosures.includes(
          requirement.slice('disclosure:'.length),
        )
      )
      :[]

  return{
    productId:product.id,
    marketplace:policy.marketplace,
    status:missingDisclosures.length>0?'conditional':status,
    matchedRuleId:rule.id,
    requirements:[...rule.requirements],
    reasons:[
      `matched policy rule ${rule.id}`,
      ...(missingDisclosures.length
        ?[`missing marketplace disclosure(s): ${missingDisclosures.join(', ')}`]
        :[]),
    ],
    policySnapshotId:policy.id,
    evaluatedAt,
    authority:'MARKETPLACE_ELIGIBILITY_ANALYTICS_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

export function assessDigitalProductProvenance(
  record:DigitalProductProvenanceRecord,
):DigitalProductProvenanceAssessment{
  requireText(record.id,'digitalProductProvenance.id')
  requireText(record.productId,'digitalProductProvenance.productId')
  requireDate(record.observedAt,'digitalProductProvenance.observedAt')
  requireText(record.originalityHash,'digitalProductProvenance.originalityHash')
  const evidenceRefs=requireEvidence(
    record.evidenceRefs,
    'digitalProductProvenance.evidenceRefs',
  )
  const blockers:string[]=[]

  if(record.exportFiles.length===0){
    blockers.push('no export files are registered')
  }
  if(!record.commercialRightsVerified){
    blockers.push('commercial rights are not verified')
  }
  for(const asset of record.sourceAssets){
    requireText(asset.assetRef,'digitalProductProvenance.sourceAsset.assetRef')
    requireEvidence(
      asset.evidenceRefs,
      'digitalProductProvenance.sourceAsset.evidenceRefs',
    )
    if(!asset.commercialUseAllowed){
      blockers.push(`source asset ${asset.assetRef} lacks commercial-use rights`)
    }
    if(
      ['licensed','template'].includes(asset.sourceType)&&
      !asset.licenseRef?.trim()
    ){
      blockers.push(`source asset ${asset.assetRef} lacks license evidence`)
    }
  }
  if(
    record.creationMethod==='template_transformed'&&
    !record.sourceAssets.some(asset=>asset.sourceType==='template')
  ){
    blockers.push('template-transformed product has no template source')
  }
  if(
    record.creationMethod==='template_transformed'&&
    record.humanEdits.length===0
  ){
    blockers.push('template-transformed product has no documented transformation')
  }
  if(
    ['original_ai_assisted','mixed'].includes(record.creationMethod)&&
    record.aiModels.length===0
  ){
    blockers.push('AI-assisted creation has no model provenance')
  }
  if(record.fonts.some(font=>!font.trim())){
    blockers.push('font provenance contains an empty font reference')
  }

  return{
    productId:record.productId,
    status:blockers.length===0?'passed':'blocked',
    blockers:[...new Set(blockers)],
    evidenceRefs,
    authority:'DIGITAL_PRODUCT_PROVENANCE_ASSESSMENT_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

export function validateMarketplacePolicySnapshot(
  policy:MarketplacePolicySnapshot,
):MarketplacePolicySnapshot{
  requireText(policy.id,'marketplacePolicy.id')
  requireText(policy.marketplace,'marketplacePolicy.marketplace')
  if(!isHttpsUrl(policy.sourceUrl)){
    throw new Error('marketplacePolicy.sourceUrl must use HTTPS')
  }
  const verifiedAt=requireDate(policy.verifiedAt,'marketplacePolicy.verifiedAt')
  const recheckAfter=requireDate(policy.recheckAfter,'marketplacePolicy.recheckAfter')
  if(Date.parse(recheckAfter)<=Date.parse(verifiedAt)){
    throw new Error('marketplacePolicy.recheckAfter must follow verifiedAt')
  }
  requireEvidence(policy.evidenceRefs,'marketplacePolicy.evidenceRefs')
  if(policy.rules.length===0){
    throw new Error('marketplacePolicy requires at least one rule')
  }
  for(const rule of policy.rules){
    requireText(rule.id,'marketplacePolicy.rule.id')
    requireEvidence(rule.evidenceRefs,'marketplacePolicy.rule.evidenceRefs')
    if(rule.productFamily)requireFamily(rule.productFamily)
  }
  return{
    ...policy,
    verifiedAt,
    recheckAfter,
  }
}

function specificity(rule:MarketplacePolicyRule):number{
  return(rule.productType?2:0)+(rule.productFamily?1:0)
}

function requireDigitalProductOpportunity(opportunity:Opportunity):void{
  const profile=opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='digital_products'){
    throw new Error('Digital Product Studio requires digital_products Opportunity')
  }
}

function requireFamily(family:DigitalProductFamily):void{
  getDigitalProductFamilyDefinition(family)
}

function geometricMean(values:number[]):number{
  return Math.exp(
    values.reduce((sum,value)=>sum+Math.log(value),0)/values.length
  )
}

function floorUnit(value:number):number{
  return Math.max(.01,value)
}

function requireUnit(value:number,field:string):void{
  if(!Number.isFinite(value)||value<0||value>1){
    throw new Error(`${field} must be between 0 and 1`)
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
  const normalized=[...new Set(values.map(value=>value.trim()).filter(Boolean))]
  if(normalized.length===0)throw new Error(`${field} requires evidence`)
  return normalized
}

function isHttpsUrl(value:string):boolean{
  try{
    return new URL(value).protocol==='https:'
  }catch{
    return false
  }
}

function clamp(value:number,min:number,max:number):number{
  return Math.min(max,Math.max(min,value))
}

function round(value:number,places:number):number{
  const factor=10**places
  return Math.round((value+Number.EPSILON)*factor)/factor
}
