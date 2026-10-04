import {describe,expect,it} from "vitest"
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleAffiliateEvent,
  type SideHustleCommissioningEvidence,
  type SideHustleExperiment,
  type SideHustleExperimentObservation,
} from "@jhadina/opportunity-core"
import type {StoredCanonicalOpportunity} from "./canonical"
import {
  proveAffiliateContributionRuntime,
  type AffiliateContributionRepository,
} from "./affiliate-contribution-runtime"
import type {
  SideHustleCommissioningEvidenceRepository,
} from "./side-hustle-commissioning-repository"
import type {
  StoredSideHustleCommerceRecord,
  StoredSideHustleExperiment,
} from "./supabase-opportunity-repository"

const opportunityId="opportunity:affiliate:contribution-runtime"

function opportunity():Opportunity{
  return{
    id:opportunityId,
    title:"Affiliate contribution runtime fixture",
    family:"business",
    type:"commercial",
    sourceName:"fixture",
    sourceUrl:"https://example.test/affiliate-contribution-runtime",
    claims:[],
    evidence:[],
    verificationStatus:"unverified",
    sourceConfidence:.9,
    riskFlags:[],
    metadata:{
      sideHustleProfile:buildSideHustleProfile({family:"commerce_affiliate"}),
    },
    status:"ready",
    createdAt:"2026-10-01T00:00:00.000Z",
    updatedAt:"2026-10-01T00:00:00.000Z",
  }
}

function experiment(spend:number):StoredSideHustleExperiment{
  const exp:SideHustleExperiment={
    id:"side-hustle-experiment:affiliate:contribution-runtime",
    opportunityId,
    profile:buildSideHustleProfile({family:"commerce_affiliate"}),
    hypothesis:"Paid affiliate revenue exceeds bounded spend.",
    targetCustomer:"Qualified buyers",
    channel:"Owned content",
    offer:"Affiliate recommendation",
    maxSpend:100,
    currency:"USD",
    maxHours:10,
    maxDurationDays:14,
    minimumObservations:1,
    successCriteria:[{
      id:"conversion",
      metric:"attributed_conversions",
      operator:"gte",
      threshold:1,
      aggregation:"sum",
      unit:"conversions",
    }],
    killCriteria:[],
    evidenceRefs:["experiment:plan"],
    requiresApproval:true,
    status:"completed",
    createdAt:"2026-10-01T00:00:00.000Z",
    startedAt:"2026-10-01T01:00:00.000Z",
    completedAt:"2026-10-03T01:00:00.000Z",
  }
  const observation:SideHustleExperimentObservation={
    id:"experiment-observation:1",
    experimentId:exp.id,
    observedAt:"2026-10-02T20:00:00.000Z",
    metrics:{attributed_conversions:1},
    spend,
    hours:2,
    evidenceRefs:["experiment:observation:1"],
  }
  return{experiment:exp,observations:[observation]}
}

function affiliateEvent(
  input:Partial<SideHustleAffiliateEvent>&
    Pick<SideHustleAffiliateEvent,"id"|"kind"|"externalEventRef">,
):SideHustleAffiliateEvent{
  return{
    opportunityId,
    family:"commerce_affiliate",
    programRef:"partnerize:campaign:campaign-7",
    providerRef:"provider:partnerize",
    economicState:"paid",
    amount:60,
    currency:"USD",
    evidenceRefs:[`evidence:${input.id}`],
    occurredAt:"2026-10-04T12:00:00.000Z",
    authority:"AFFILIATE_OBSERVATION_ONLY",
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
    ...input,
  }
}

function records():StoredSideHustleCommerceRecord[]{
  const conversion=affiliateEvent({
    id:"affiliate:conversion:1",
    kind:"conversion",
    externalEventRef:"partnerize:conversion:conversion-1",
    economicState:"approved",
    occurredAt:"2026-10-02T12:00:00.000Z",
  })
  const payout=affiliateEvent({
    id:"affiliate:payout:1",
    kind:"payout",
    externalEventRef:"partnerize:selfbill:selfbill-3:item:item-9",
    economicState:"paid",
    occurredAt:"2026-10-04T12:00:00.000Z",
    metadata:{
      conversion_id:"conversion-1",
      conversion_item_id:"item-9",
      conversion_at:"2026-10-02T12:00:00.000Z",
      selfbill_id:"selfbill-3",
      selfbill_payment_at:"2026-10-04T12:00:00.000Z",
      settlement_currency:"USD",
      settlement_basis:"paid_selfbill_item_no_fx_no_tax",
    },
  })
  return[conversion,payout].map(payload=>({
    id:payload.id,
    opportunityId,
    family:"commerce_affiliate",
    kind:"affiliate_event",
    status:undefined,
    payload,
    recordedAt:payload.occurredAt,
  }))
}

function fixture(spend:number){
  const stored:StoredCanonicalOpportunity={
    userId:"owner:test",
    opportunity:opportunity(),
    triageState:"saved",
  }
  const storedExperiment=experiment(spend)
  const commerceRows=records()
  const commissioningRows:SideHustleCommissioningEvidence[]=[]

  const repository:AffiliateContributionRepository={
    async get(id){return id===opportunityId?stored:undefined},
    async listSideHustleExperiments(id){
      return id===opportunityId?[storedExperiment]:[]
    },
    async listSideHustleCommerceRecords(input={}){
      return commerceRows.filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
  }

  const commissioningRepository:SideHustleCommissioningEvidenceRepository={
    async list(input={}){
      return commissioningRows.filter(row=>
        !input.family||row.family===input.family
      )
    },
    async record(evidence){
      const existing=commissioningRows.find(row=>row.id===evidence.id)
      if(existing){
        expect(existing).toEqual(evidence)
        return existing
      }
      commissioningRows.push(structuredClone(evidence))
      return evidence
    },
  }

  return{
    repository,
    commissioningRepository,
    commissioningRows,
    stored,
    experimentId:storedExperiment.experiment.id,
  }
}

describe("affiliate contribution runtime",()=>{
  it("passes data analytics from positive paid-item contribution without closing the opportunity",async()=>{
    const f=fixture(30)
    const result=await proveAffiliateContributionRuntime(
      {
        opportunityId,
        experimentId:f.experimentId,
        currency:"USD",
        evaluatedAt:"2026-10-05T00:00:00.000Z",
      },
      f.repository,
      f.commissioningRepository,
    )

    expect(result.proof.status).toBe("passed")
    expect(result.proof.calculation.profit).toBe(30)
    expect(result.proof.calculation.margin).toBe(.5)
    expect(result.proof.calculation.dollarsPerHour).toBe(15)
    expect(result.proof.canonicalOutcomePersisted).toBe(false)
    expect(result.canonicalOutcomePersisted).toBe(false)
    expect(result.passedGates).toContain("data_analytics")
    expect(result.pendingGates).toContain("compliance")
    expect(result.commissioningStatus).toBe("commissioning")
    expect(f.stored.opportunity.status).toBe("ready")

    const evidence=f.commissioningRows.find(row=>row.gateType==="data_analytics")
    expect(evidence?.status).toBe("passed")
    expect(evidence?.expiresAt).toBe("2026-11-04T00:00:00.000Z")
    expect(evidence?.evidenceRefs).toEqual(
      expect.arrayContaining([
        f.experimentId,
        "affiliate:payout:1",
      ]),
    )
  })

  it("blocks data analytics when realized payout does not exceed bounded spend",async()=>{
    const f=fixture(80)
    const result=await proveAffiliateContributionRuntime(
      {
        opportunityId,
        experimentId:f.experimentId,
        currency:"USD",
        evaluatedAt:"2026-10-05T00:00:00.000Z",
      },
      f.repository,
      f.commissioningRepository,
    )

    expect(result.proof.status).toBe("blocked")
    expect(result.proof.calculation.profit).toBe(-20)
    expect(result.commissioningStatus).toBe("blocked")
    expect(result.pendingGates).toContain("data_analytics")
    expect(f.commissioningRows.find(row=>row.gateType==="data_analytics")?.status)
      .toBe("blocked")
  })

  it("refuses an experiment that does not belong to the requested opportunity",async()=>{
    const f=fixture(30)
    await expect(proveAffiliateContributionRuntime(
      {
        opportunityId:"opportunity:missing",
        experimentId:f.experimentId,
        currency:"USD",
        evaluatedAt:"2026-10-05T00:00:00.000Z",
      },
      f.repository,
      f.commissioningRepository,
    )).rejects.toThrow("AFFILIATE_CONTRIBUTION_OPPORTUNITY_NOT_FOUND")
  })
})
