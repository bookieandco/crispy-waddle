import "server-only"

import {createHash} from "node:crypto"
import {
  buildAffiliateContributionProof,
  evaluateSideHustleExperiment,
  type AffiliateContributionProof,
  type SideHustleAffiliateEvent,
  type SideHustleCommerceRecordKind,
  type SideHustleFamily,
} from "@jhadina/opportunity-core"
import type {StoredCanonicalOpportunity} from "./canonical"
import {
  listSideHustleLiveCommissioningRuntime,
  recordSideHustleCommissioningEvidenceRuntime,
} from "./side-hustle-commissioning-runtime"
import type {
  SideHustleCommissioningEvidenceRepository,
} from "./side-hustle-commissioning-repository"
import type {
  StoredSideHustleCommerceRecord,
  StoredSideHustleExperiment,
} from "./supabase-opportunity-repository"

export type AffiliateContributionRepository={
  get(id:string):Promise<StoredCanonicalOpportunity|undefined>
  listSideHustleExperiments(opportunityId:string):Promise<StoredSideHustleExperiment[]>
  listSideHustleCommerceRecords(input?:{
    opportunityId?:string
    family?:SideHustleFamily
    kind?:SideHustleCommerceRecordKind
  }):Promise<StoredSideHustleCommerceRecord[]>
}

export type AffiliateContributionRuntimeResult={
  opportunityId:string
  experimentId:string
  currency:string
  proof:AffiliateContributionProof
  commissioningEvidenceId:string
  commissioningStatus:"commissioning"|"blocked"|"certified"|"not_applicable"
  passedGates:string[]
  pendingGates:string[]
  evaluatedAt:string
  expiresAt:string
  canonicalOutcomePersisted:false
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export async function proveAffiliateContributionRuntime(
  input:{
    opportunityId:string
    experimentId:string
    currency:string
    evaluatedAt?:string
    freshnessDays?:number
  },
  repository:AffiliateContributionRepository,
  commissioningRepository:SideHustleCommissioningEvidenceRepository,
):Promise<AffiliateContributionRuntimeResult>{
  const opportunityId=requireText(input.opportunityId,"opportunityId")
  const experimentId=requireText(input.experimentId,"experimentId")
  const evaluatedAt=normalizeDate(input.evaluatedAt??new Date().toISOString(),"evaluatedAt")
  const freshnessDays=input.freshnessDays??30
  if(!Number.isInteger(freshnessDays)||freshnessDays<1||freshnessDays>90){
    throw new Error("AFFILIATE_CONTRIBUTION_FRESHNESS_DAYS_INVALID")
  }

  const stored=await repository.get(opportunityId)
  if(!stored)throw new Error("AFFILIATE_CONTRIBUTION_OPPORTUNITY_NOT_FOUND")

  const experiments=await repository.listSideHustleExperiments(opportunityId)
  const selected=experiments.find(row=>row.experiment.id===experimentId)
  if(!selected)throw new Error("AFFILIATE_CONTRIBUTION_EXPERIMENT_NOT_FOUND")

  const evaluation=evaluateSideHustleExperiment({
    experiment:selected.experiment,
    observations:selected.observations,
    evaluatedAt,
  })

  const commerceRows=await repository.listSideHustleCommerceRecords({
    opportunityId,
    family:"commerce_affiliate",
    kind:"affiliate_event",
  })
  const affiliateEvents=commerceRows
    .filter(row=>row.kind==="affiliate_event")
    .map(row=>row.payload as SideHustleAffiliateEvent)

  const proof=buildAffiliateContributionProof({
    opportunity:stored.opportunity,
    experiment:selected.experiment,
    evaluation,
    affiliateEvents,
    currency:input.currency,
    evaluatedAt,
  })

  const expiresAt=addDays(evaluatedAt,freshnessDays)
  const evidence=await recordSideHustleCommissioningEvidenceRuntime({
    id:commissioningEvidenceId(proof),
    family:"commerce_affiliate",
    gateType:"data_analytics",
    status:proof.status,
    providerRef:"commerce:affiliate-contribution",
    note:contributionNote(proof),
    evidenceRefs:unique([
      proof.experimentId,
      ...proof.evidenceRefs,
      ...proof.payoutEventIds,
      ...proof.reversalEventIds,
    ]),
    observedAt:evaluatedAt,
    expiresAt,
  },commissioningRepository)

  const live=await listSideHustleLiveCommissioningRuntime(
    {family:"commerce_affiliate",evaluatedAt},
    commissioningRepository,
  )
  const state=live.states[0]
  if(!state)throw new Error("AFFILIATE_CONTRIBUTION_COMMISSIONING_STATE_UNAVAILABLE")

  return{
    opportunityId,
    experimentId,
    currency:proof.currency,
    proof,
    commissioningEvidenceId:evidence.id,
    commissioningStatus:state.status,
    passedGates:state.gates
      .filter(gate=>gate.status==="passed"||gate.status==="not_applicable")
      .map(gate=>gate.gateType),
    pendingGates:state.gates
      .filter(gate=>gate.status==="pending"||gate.status==="blocked")
      .map(gate=>gate.gateType),
    evaluatedAt,
    expiresAt,
    canonicalOutcomePersisted:false,
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function commissioningEvidenceId(proof:AffiliateContributionProof):string{
  const digest=createHash("sha256")
    .update([
      proof.opportunityId,
      proof.experimentId,
      proof.currency,
      proof.status,
      proof.evaluatedAt,
      proof.calculation.grossRevenue,
      proof.calculation.refunds,
      proof.calculation.directCosts,
      proof.calculation.profit,
    ].join("|"))
    .digest("hex")
    .slice(0,24)
  return `affiliate-contribution-evidence:${digest}`
}

function contributionNote(proof:AffiliateContributionProof):string{
  const margin=proof.calculation.margin===null
    ?"n/a"
    :`${(proof.calculation.margin*100).toFixed(2)}%`
  const base=
    `Affiliate contribution ${proof.calculation.profit.toFixed(2)} ${proof.currency}; `+
    `realized revenue ${proof.calculation.grossRevenue.toFixed(2)}, `+
    `reversals ${proof.calculation.refunds.toFixed(2)}, `+
    `direct spend ${proof.calculation.directCosts.toFixed(2)}, `+
    `margin ${margin}, hours ${proof.calculation.hours.toFixed(2)}.`
  return proof.blockers.length
    ?`${base} Blockers: ${proof.blockers.join("; ")}`
    :base
}

function addDays(value:string,days:number):string{
  return new Date(Date.parse(value)+days*86_400_000).toISOString()
}

function normalizeDate(value:string,field:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed))throw new Error(`${field} must be a valid date`)
  return new Date(parsed).toISOString()
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
