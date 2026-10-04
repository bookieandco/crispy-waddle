import type {Opportunity} from './opportunity.js'
import {
  assessDigitalProductProvenance,
  evaluateDigitalProductMarketplaceEligibility,
  scoreDigitalProductB2bRoi,
  scoreDigitalProductOpportunity,
  validateDigitalProductDraft,
  validateMarketplacePolicySnapshot,
  type DigitalProductB2bRoiScore,
  type DigitalProductB2bRoiSignals,
  type DigitalProductDraft,
  type DigitalProductIndustryMatrixCell,
  type DigitalProductOpportunityScore,
  type DigitalProductOpportunitySignals,
  type DigitalProductProvenanceAssessment,
  type DigitalProductProvenanceRecord,
  type MarketplaceEligibilityEvaluation,
  type MarketplacePolicySnapshot,
} from './side-hustle-digital-product-studio.js'
import {isSideHustleProfile} from './side-hustles.js'

export type DigitalProductStudioRecordKind=
  |'opportunity_score'
  |'matrix_cell'
  |'b2b_roi'
  |'product_definition'
  |'policy_snapshot'
  |'marketplace_eligibility'
  |'provenance'

export type DigitalProductOpportunityAssessment={
  signals:DigitalProductOpportunitySignals
  score:DigitalProductOpportunityScore
}

export type DigitalProductB2bRoiAssessment={
  matrixCellId:string
  signals:DigitalProductB2bRoiSignals
  score:DigitalProductB2bRoiScore
}

export type DigitalProductMarketplaceEligibilitySnapshot={
  product:DigitalProductDraft
  evaluation:MarketplaceEligibilityEvaluation
}

export type DigitalProductProvenanceSnapshot={
  provenance:DigitalProductProvenanceRecord
  assessment:DigitalProductProvenanceAssessment
}

export type DigitalProductStudioPayload=
  |DigitalProductOpportunityAssessment
  |DigitalProductIndustryMatrixCell
  |DigitalProductB2bRoiAssessment
  |DigitalProductDraft
  |MarketplacePolicySnapshot
  |DigitalProductMarketplaceEligibilitySnapshot
  |DigitalProductProvenanceSnapshot

export type DigitalProductStudioRecord={
  id:string
  opportunityId:string
  family:'digital_products'
  kind:DigitalProductStudioRecordKind
  status:string
  payload:DigitalProductStudioPayload
  evidenceRefs:string[]
  recordedAt:string
  authority:'DIGITAL_PRODUCT_STUDIO_RECORD_ONLY'
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export function createDigitalProductOpportunityScoreRecord(input:{
  opportunity:Opportunity
  id:string
  signals:DigitalProductOpportunitySignals
  evidenceRefs:string[]
  recordedAt:string
}):DigitalProductStudioRecord{
  requireDigitalProductOpportunity(input.opportunity)
  const score=scoreDigitalProductOpportunity(input.signals)
  return studioRecord({
    opportunity:input.opportunity,
    id:input.id,
    kind:'opportunity_score',
    status:score.decision,
    payload:{
      signals:{...input.signals},
      score,
    },
    evidenceRefs:input.evidenceRefs,
    recordedAt:input.recordedAt,
  })
}

export function createDigitalProductMatrixRecord(input:{
  opportunity:Opportunity
  cell:DigitalProductIndustryMatrixCell
  recordedAt:string
}):DigitalProductStudioRecord{
  requireDigitalProductOpportunity(input.opportunity)
  if(input.cell.opportunityId!==input.opportunity.id){
    throw new Error('Digital product matrix cell does not belong to opportunity')
  }
  return studioRecord({
    opportunity:input.opportunity,
    id:input.cell.id,
    kind:'matrix_cell',
    status:'recorded',
    payload:{...input.cell,evidenceRefs:[...input.cell.evidenceRefs]},
    evidenceRefs:input.cell.evidenceRefs,
    recordedAt:input.recordedAt,
  })
}

export function createDigitalProductB2bRoiRecord(input:{
  opportunity:Opportunity
  id:string
  cell:DigitalProductIndustryMatrixCell
  signals:DigitalProductB2bRoiSignals
  evidenceRefs:string[]
  recordedAt:string
}):DigitalProductStudioRecord{
  requireDigitalProductOpportunity(input.opportunity)
  if(input.cell.opportunityId!==input.opportunity.id){
    throw new Error('Digital product B2B ROI cell does not belong to opportunity')
  }
  const score=scoreDigitalProductB2bRoi(input.cell,input.signals)
  return studioRecord({
    opportunity:input.opportunity,
    id:input.id,
    kind:'b2b_roi',
    status:score.tier,
    payload:{
      matrixCellId:input.cell.id,
      signals:{...input.signals},
      score,
    },
    evidenceRefs:unique([...input.cell.evidenceRefs,...input.evidenceRefs]),
    recordedAt:input.recordedAt,
  })
}

export function createDigitalProductDefinitionRecord(input:{
  opportunity:Opportunity
  product:DigitalProductDraft
  recordedAt:string
}):DigitalProductStudioRecord{
  const product=validateDigitalProductDraft(input.product,input.opportunity)
  return studioRecord({
    opportunity:input.opportunity,
    id:product.id,
    kind:'product_definition',
    status:'draft',
    payload:product,
    evidenceRefs:product.evidenceRefs,
    recordedAt:input.recordedAt,
  })
}

export function createDigitalProductPolicyRecord(input:{
  opportunity:Opportunity
  policy:MarketplacePolicySnapshot
  recordedAt:string
}):DigitalProductStudioRecord{
  requireDigitalProductOpportunity(input.opportunity)
  const policy=validateMarketplacePolicySnapshot(input.policy)
  return studioRecord({
    opportunity:input.opportunity,
    id:policy.id,
    kind:'policy_snapshot',
    status:'verified',
    payload:policy,
    evidenceRefs:unique([
      ...policy.evidenceRefs,
      ...policy.rules.flatMap(rule=>rule.evidenceRefs),
    ]),
    recordedAt:input.recordedAt,
  })
}

export function createDigitalProductEligibilityRecord(input:{
  opportunity:Opportunity
  id:string
  product:DigitalProductDraft
  policy:MarketplacePolicySnapshot
  evaluatedAt:string
}):DigitalProductStudioRecord{
  const product=validateDigitalProductDraft(input.product,input.opportunity)
  const policy=validateMarketplacePolicySnapshot(input.policy)
  const evaluation=evaluateDigitalProductMarketplaceEligibility({
    product,
    policy,
    evaluatedAt:input.evaluatedAt,
  })
  return studioRecord({
    opportunity:input.opportunity,
    id:input.id,
    kind:'marketplace_eligibility',
    status:evaluation.status,
    payload:{product,evaluation},
    evidenceRefs:unique([
      ...product.evidenceRefs,
      ...policy.evidenceRefs,
      ...policy.rules.flatMap(rule=>rule.evidenceRefs),
    ]),
    recordedAt:evaluation.evaluatedAt,
  })
}

export function createDigitalProductProvenanceRecord(input:{
  opportunity:Opportunity
  id:string
  product:DigitalProductDraft
  provenance:DigitalProductProvenanceRecord
  recordedAt:string
}):DigitalProductStudioRecord{
  const product=validateDigitalProductDraft(input.product,input.opportunity)
  if(input.provenance.productId!==product.id){
    throw new Error('Digital product provenance does not belong to product')
  }
  const assessment=assessDigitalProductProvenance(input.provenance)
  return studioRecord({
    opportunity:input.opportunity,
    id:input.id,
    kind:'provenance',
    status:assessment.status,
    payload:{
      provenance:{
        ...input.provenance,
        sourceAssets:input.provenance.sourceAssets.map(asset=>({
          ...asset,
          evidenceRefs:[...asset.evidenceRefs],
        })),
        aiModels:[...input.provenance.aiModels],
        humanEdits:[...input.provenance.humanEdits],
        fonts:[...input.provenance.fonts],
        marketplaceDisclosures:[...input.provenance.marketplaceDisclosures],
        exportFiles:[...input.provenance.exportFiles],
        evidenceRefs:[...input.provenance.evidenceRefs],
      },
      assessment,
    },
    evidenceRefs:unique([
      ...product.evidenceRefs,
      ...assessment.evidenceRefs,
      ...input.provenance.sourceAssets.flatMap(asset=>asset.evidenceRefs),
    ]),
    recordedAt:input.recordedAt,
  })
}

export function digitalProductStudioRecordKind(
  record:DigitalProductStudioRecord,
):DigitalProductStudioRecordKind{
  return record.kind
}

function studioRecord(input:{
  opportunity:Opportunity
  id:string
  kind:DigitalProductStudioRecordKind
  status:string
  payload:DigitalProductStudioPayload
  evidenceRefs:string[]
  recordedAt:string
}):DigitalProductStudioRecord{
  requireDigitalProductOpportunity(input.opportunity)
  const id=requireText(input.id,'digitalProductStudioRecord.id')
  const status=requireText(input.status,'digitalProductStudioRecord.status')
  const evidenceRefs=requireEvidence(
    input.evidenceRefs,
    'digitalProductStudioRecord.evidenceRefs',
  )
  const recordedAt=requireDate(
    input.recordedAt,
    'digitalProductStudioRecord.recordedAt',
  )
  return{
    id,
    opportunityId:input.opportunity.id,
    family:'digital_products',
    kind:input.kind,
    status,
    payload:input.payload,
    evidenceRefs,
    recordedAt,
    authority:'DIGITAL_PRODUCT_STUDIO_RECORD_ONLY',
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function requireDigitalProductOpportunity(opportunity:Opportunity):void{
  const profile=opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='digital_products'){
    throw new Error('Digital Product Studio registry requires digital_products Opportunity')
  }
}

function requireText(value:string,field:string):string{
  if(typeof value!=='string'||!value.trim()){
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function requireDate(value:string,field:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed)){
    throw new Error(`${field} must be a valid date`)
  }
  return new Date(parsed).toISOString()
}

function requireEvidence(values:readonly string[],field:string):string[]{
  const normalized=unique(values)
  if(normalized.length===0){
    throw new Error(`${field} requires evidence`)
  }
  return normalized
}

function unique(values:readonly string[]):string[]{
  return[...new Set(values.map(value=>value.trim()).filter(Boolean))]
}
