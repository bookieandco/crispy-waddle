import "server-only"

import {createHash} from "node:crypto"
import {
  buildAffiliateComplianceSnapshot,
  type AffiliateComplianceChannel,
  type AffiliateComplianceSnapshot,
  type AffiliateContentComplianceReview,
  type AffiliateDisclosureObservation,
  type AffiliateTermsSnapshot,
} from "@jhadina/opportunity-core"
import {
  summarizeAffiliatePortfolioRuntime,
} from "./affiliate-portfolio-runtime"
import type {
  AffiliateComplianceSnapshotRepository,
} from "./affiliate-compliance-repository"
import {
  listSideHustleLiveCommissioningRuntime,
  recordSideHustleCommissioningEvidenceRuntime,
} from "./side-hustle-commissioning-runtime"
import type {
  SideHustleCommissioningEvidenceRepository,
} from "./side-hustle-commissioning-repository"
import type {
  SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime"

export type AffiliateComplianceRuntimeResult={
  opportunityId:string
  snapshot:AffiliateComplianceSnapshot
  commissioningEvidenceId:string
  commissioningStatus:"commissioning"|"blocked"|"certified"|"not_applicable"
  passedGates:string[]
  pendingGates:string[]
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export async function certifyAffiliateComplianceRuntime(
  input:{
    opportunityId:string
    usedChannels:AffiliateComplianceChannel[]
    termsSnapshots:AffiliateTermsSnapshot[]
    disclosureObservations:AffiliateDisclosureObservation[]
    contentReviews:AffiliateContentComplianceReview[]
    evaluatedAt?:string
    freshnessDays?:number
  },
  opportunityRepository:SideHustleCommercePersistence,
  complianceRepository:AffiliateComplianceSnapshotRepository,
  commissioningRepository:SideHustleCommissioningEvidenceRepository,
):Promise<AffiliateComplianceRuntimeResult>{
  const opportunityId=requireText(input.opportunityId,"opportunityId")
  const evaluatedAt=normalizeDate(
    input.evaluatedAt??new Date().toISOString(),
    "evaluatedAt",
  )

  const stored=await opportunityRepository.get(opportunityId)
  if(!stored)throw new Error("AFFILIATE_COMPLIANCE_OPPORTUNITY_NOT_FOUND")

  const portfolio=await summarizeAffiliatePortfolioRuntime(
    {opportunityId},
    opportunityRepository,
  )

  const snapshot=buildAffiliateComplianceSnapshot({
    id:complianceSnapshotId({
      opportunityId,
      evaluatedAt,
      termsSnapshots:input.termsSnapshots,
      disclosureObservations:input.disclosureObservations,
      contentReviews:input.contentReviews,
    }),
    opportunity:stored.opportunity,
    portfolio,
    usedChannels:input.usedChannels,
    termsSnapshots:input.termsSnapshots,
    disclosureObservations:input.disclosureObservations,
    contentReviews:input.contentReviews,
    evaluatedAt,
    freshnessDays:input.freshnessDays,
  })

  const persisted=await complianceRepository.record(snapshot)

  const commissioningEvidence=
    await recordSideHustleCommissioningEvidenceRuntime({
      id:commissioningEvidenceId(persisted),
      family:"commerce_affiliate",
      gateType:"compliance",
      status:persisted.status,
      providerRef:"commerce:affiliate-compliance",
      note:complianceNote(persisted),
      evidenceRefs:unique([
        persisted.id,
        ...persisted.evidenceRefs,
      ]),
      observedAt:persisted.evaluatedAt,
      expiresAt:persisted.expiresAt,
    },commissioningRepository)

  const live=await listSideHustleLiveCommissioningRuntime(
    {
      family:"commerce_affiliate",
      evaluatedAt:persisted.evaluatedAt,
    },
    commissioningRepository,
  )
  const state=live.states[0]
  if(!state){
    throw new Error("AFFILIATE_COMPLIANCE_COMMISSIONING_STATE_UNAVAILABLE")
  }

  return{
    opportunityId,
    snapshot:persisted,
    commissioningEvidenceId:commissioningEvidence.id,
    commissioningStatus:state.status,
    passedGates:state.gates
      .filter(gate=>gate.status==="passed"||gate.status==="not_applicable")
      .map(gate=>gate.gateType),
    pendingGates:state.gates
      .filter(gate=>gate.status==="pending"||gate.status==="blocked")
      .map(gate=>gate.gateType),
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function complianceSnapshotId(input:{
  opportunityId:string
  evaluatedAt:string
  termsSnapshots:AffiliateTermsSnapshot[]
  disclosureObservations:AffiliateDisclosureObservation[]
  contentReviews:AffiliateContentComplianceReview[]
}):string{
  const digest=createHash("sha256")
    .update(JSON.stringify({
      opportunityId:input.opportunityId,
      evaluatedAt:input.evaluatedAt,
      terms:input.termsSnapshots.map(item=>item.id).sort(),
      disclosures:input.disclosureObservations.map(item=>item.id).sort(),
      reviews:input.contentReviews.map(item=>item.id).sort(),
    }))
    .digest("hex")
    .slice(0,24)
  return `affiliate-compliance:${digest}`
}

function commissioningEvidenceId(
  snapshot:AffiliateComplianceSnapshot,
):string{
  const digest=createHash("sha256")
    .update([
      snapshot.id,
      snapshot.status,
      snapshot.evaluatedAt,
      snapshot.expiresAt,
    ].join("|"))
    .digest("hex")
    .slice(0,24)
  return `affiliate-compliance-evidence:${digest}`
}

function complianceNote(snapshot:AffiliateComplianceSnapshot):string{
  const base=
    `Affiliate compliance ${snapshot.status}; `+
    `${snapshot.activeProgramRefs.length} active program(s), `+
    `${snapshot.usedChannels.length} used channel(s), `+
    `${snapshot.termsSnapshots.length} terms snapshot(s), `+
    `${snapshot.disclosureObservations.length} disclosure observation(s), `+
    `${snapshot.contentReviews.length} content review(s).`
  return snapshot.blockers.length
    ?`${base} Blockers: ${snapshot.blockers.join("; ")}`
    :base
}

function normalizeDate(value:string,field:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed)){
    throw new Error(`${field} must be a valid date`)
  }
  return new Date(parsed).toISOString()
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim()){
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function unique(values:readonly string[]):string[]{
  return[...new Set(values.map(value=>value.trim()).filter(Boolean))]
}
