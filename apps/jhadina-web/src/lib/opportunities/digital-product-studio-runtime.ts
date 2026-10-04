import "server-only"

import {
  createDigitalProductB2bRoiRecord,
  createDigitalProductDefinitionRecord,
  createDigitalProductEligibilityRecord,
  createDigitalProductIndustryMatrixCell,
  createDigitalProductMatrixRecord,
  createDigitalProductOpportunityScoreRecord,
  createDigitalProductPolicyRecord,
  createDigitalProductProvenanceRecord,
  type DigitalProductB2bRoiSignals,
  type DigitalProductDraft,
  type DigitalProductFamily,
  type DigitalProductIndustryMatrixCell,
  type DigitalProductOpportunitySignals,
  type DigitalProductProvenanceRecord,
  type DigitalProductStudioRecord,
  type MarketplacePolicySnapshot,
} from "@jhadina/opportunity-core"
import type {StoredCanonicalOpportunity} from "./canonical"
import type {
  DigitalProductStudioRepository,
  StoredDigitalProductStudioRecord,
} from "./digital-product-studio-repository"

type OpportunityRepository={
  get(id:string):Promise<StoredCanonicalOpportunity|undefined>
}

type RawPolicy=Omit<
  MarketplacePolicySnapshot,
  "authority"|"externalActionAuthorized"|"publishingAuthorized"
>

type RawProvenance=Omit<
  DigitalProductProvenanceRecord,
  "productId"|"authority"|"externalActionAuthorized"|"publishingAuthorized"|"paymentAuthorized"
>

export async function scoreDigitalProductOpportunityRuntime(
  input:{
    opportunityId:string
    id:string
    signals:DigitalProductOpportunitySignals
    evidenceRefs:string[]
    recordedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  return repository.record(createDigitalProductOpportunityScoreRecord({
    opportunity,
    id:input.id,
    signals:input.signals,
    evidenceRefs:input.evidenceRefs,
    recordedAt:input.recordedAt??new Date().toISOString(),
  }))
}

export async function createDigitalProductMatrixRuntime(
  input:{
    opportunityId:string
    id:string
    industry:string
    businessStage:string
    businessFunction:string
    buyerRole:string
    lifecycleStep:string
    buyerType:"business"|"consumer"
    family:DigitalProductFamily
    productType:string
    problem:string
    desiredOutcome:string
    evidenceRefs:string[]
    recordedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  const recordedAt=input.recordedAt??new Date().toISOString()
  const cell=createDigitalProductIndustryMatrixCell({
    opportunity,
    id:input.id,
    industry:input.industry,
    businessStage:input.businessStage,
    businessFunction:input.businessFunction,
    buyerRole:input.buyerRole,
    lifecycleStep:input.lifecycleStep,
    buyerType:input.buyerType,
    family:input.family,
    productType:input.productType,
    problem:input.problem,
    desiredOutcome:input.desiredOutcome,
    evidenceRefs:input.evidenceRefs,
  })
  return repository.record(createDigitalProductMatrixRecord({
    opportunity,cell,recordedAt,
  }))
}

export async function scoreDigitalProductB2bRoiRuntime(
  input:{
    opportunityId:string
    id:string
    matrixCellId:string
    signals:DigitalProductB2bRoiSignals
    evidenceRefs:string[]
    recordedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  const stored=await requireRecord(
    input.matrixCellId,
    "matrix_cell",
    input.opportunityId,
    repository,
  )
  return repository.record(createDigitalProductB2bRoiRecord({
    opportunity,
    id:input.id,
    cell:stored.payload.payload as DigitalProductIndustryMatrixCell,
    signals:input.signals,
    evidenceRefs:input.evidenceRefs,
    recordedAt:input.recordedAt??new Date().toISOString(),
  }))
}

export async function defineDigitalProductRuntime(
  input:{
    opportunityId:string
    product:Omit<DigitalProductDraft,"opportunityId">
    recordedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  return repository.record(createDigitalProductDefinitionRecord({
    opportunity,
    product:{...input.product,opportunityId:opportunity.id},
    recordedAt:input.recordedAt??new Date().toISOString(),
  }))
}

export async function recordDigitalProductPolicyRuntime(
  input:{
    opportunityId:string
    policy:RawPolicy
    recordedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  return repository.record(createDigitalProductPolicyRecord({
    opportunity,
    policy:{
      ...input.policy,
      authority:"MARKETPLACE_POLICY_OBSERVATION_ONLY",
      externalActionAuthorized:false,
      publishingAuthorized:false,
    },
    recordedAt:input.recordedAt??new Date().toISOString(),
  }))
}

export async function evaluateDigitalProductMarketplaceRuntime(
  input:{
    opportunityId:string
    id:string
    productId:string
    policyRecordId:string
    evaluatedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  const[productRecord,policyRecord]=await Promise.all([
    requireRecord(input.productId,"product_definition",input.opportunityId,repository),
    requireRecord(input.policyRecordId,"policy_snapshot",input.opportunityId,repository),
  ])
  return repository.record(createDigitalProductEligibilityRecord({
    opportunity,
    id:input.id,
    product:productRecord.payload.payload as DigitalProductDraft,
    policy:policyRecord.payload.payload as MarketplacePolicySnapshot,
    evaluatedAt:input.evaluatedAt??new Date().toISOString(),
  }))
}

export async function recordDigitalProductProvenanceRuntime(
  input:{
    opportunityId:string
    id:string
    productId:string
    provenance:RawProvenance
    recordedAt?:string
  },
  opportunityRepository:OpportunityRepository,
  repository:DigitalProductStudioRepository,
):Promise<DigitalProductStudioRecord>{
  const opportunity=await requireOpportunity(input.opportunityId,opportunityRepository)
  const productRecord=await requireRecord(
    input.productId,
    "product_definition",
    input.opportunityId,
    repository,
  )
  const product=productRecord.payload.payload as DigitalProductDraft
  return repository.record(createDigitalProductProvenanceRecord({
    opportunity,
    id:input.id,
    product,
    provenance:{
      ...input.provenance,
      productId:product.id,
      authority:"DIGITAL_PRODUCT_PROVENANCE_ONLY",
      externalActionAuthorized:false,
      publishingAuthorized:false,
      paymentAuthorized:false,
    },
    recordedAt:input.recordedAt??new Date().toISOString(),
  }))
}

export async function summarizeDigitalProductStudioRuntime(
  input:{opportunityId:string},
  repository:DigitalProductStudioRepository,
){
  const records=await repository.list({opportunityId:requireText(input.opportunityId,"opportunityId")})
  return{
    opportunityId:input.opportunityId,
    opportunityScores:count(records,"opportunity_score"),
    matrixCells:count(records,"matrix_cell"),
    b2bRoiAssessments:count(records,"b2b_roi"),
    productDefinitions:count(records,"product_definition"),
    policySnapshots:count(records,"policy_snapshot"),
    marketplaceEvaluations:count(records,"marketplace_eligibility"),
    provenanceSnapshots:count(records,"provenance"),
    blockedMarketplaceEvaluations:records.filter(
      row=>row.kind==="marketplace_eligibility"&&
        ["blocked","stale","review_required"].includes(row.status)
    ).length,
    blockedProvenance:records.filter(
      row=>row.kind==="provenance"&&row.status==="blocked"
    ).length,
    externalActionAuthorized:false as const,
    publishingAuthorized:false as const,
    paymentAuthorized:false as const,
    moneyMovementAuthorized:false as const,
  }
}

async function requireOpportunity(
  id:string,
  repository:OpportunityRepository,
){
  const stored=await repository.get(requireText(id,"opportunityId"))
  if(!stored){
    throw new Error("DIGITAL_PRODUCT_STUDIO_OPPORTUNITY_NOT_FOUND")
  }
  return stored.opportunity
}

async function requireRecord(
  id:string,
  kind:StoredDigitalProductStudioRecord["kind"],
  opportunityId:string,
  repository:DigitalProductStudioRepository,
):Promise<StoredDigitalProductStudioRecord>{
  const stored=await repository.get(requireText(id,"recordId"))
  if(!stored){
    throw new Error("DIGITAL_PRODUCT_STUDIO_RECORD_NOT_FOUND")
  }
  if(stored.opportunityId!==opportunityId){
    throw new Error("DIGITAL_PRODUCT_STUDIO_RECORD_OPPORTUNITY_MISMATCH")
  }
  if(stored.kind!==kind){
    throw new Error("DIGITAL_PRODUCT_STUDIO_RECORD_KIND_MISMATCH")
  }
  return stored
}

function count(
  records:StoredDigitalProductStudioRecord[],
  kind:StoredDigitalProductStudioRecord["kind"],
):number{
  return records.filter(row=>row.kind===kind).length
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim()){
    throw new Error(`${field} is required`)
  }
  return value.trim()
}
