import {describe,expect,it} from "vitest"
import {
  buildSideHustleProfile,
  type AffiliateComplianceSnapshot,
  type AffiliateContentComplianceReview,
  type AffiliateDisclosureObservation,
  type AffiliateTermsSnapshot,
  type Opportunity,
  type SideHustleAffiliateEvent,
  type SideHustleCommissioningEvidence,
  type SideHustleCommerceRecord,
} from "@jhadina/opportunity-core"
import type {StoredCanonicalOpportunity} from "./canonical"
import {
  certifyAffiliateComplianceRuntime,
} from "./affiliate-compliance-runtime"
import type {
  AffiliateComplianceSnapshotRepository,
} from "./affiliate-compliance-repository"
import type {
  SideHustleCommissioningEvidenceRepository,
} from "./side-hustle-commissioning-repository"
import type {
  SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime"
import type {
  StoredSideHustleCommerceRecord,
} from "./supabase-opportunity-repository"

const opportunityId="opportunity:affiliate:compliance-runtime"

function opportunity():Opportunity{
  return{
    id:opportunityId,
    title:"Affiliate compliance runtime fixture",
    family:"business",
    type:"commercial",
    sourceName:"fixture",
    sourceUrl:"https://example.test/affiliate-compliance",
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

function affiliateEvents():StoredSideHustleCommerceRecord[]{
  const payload:SideHustleAffiliateEvent={
    id:"affiliate:conversion:compliance:1",
    opportunityId,
    family:"commerce_affiliate",
    programRef:"partnerize:campaign:campaign-7",
    providerRef:"provider:partnerize",
    externalEventRef:"partnerize:conversion:conversion-1",
    kind:"conversion",
    providerStatus:"approved",
    economicState:"approved",
    amount:60,
    currency:"USD",
    evidenceRefs:["evidence:conversion"],
    occurredAt:"2026-10-03T10:00:00.000Z",
    authority:"AFFILIATE_OBSERVATION_ONLY",
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
  return[{
    id:payload.id,
    opportunityId,
    family:"commerce_affiliate",
    kind:"affiliate_event",
    status:undefined,
    payload,
    recordedAt:payload.occurredAt,
  }]
}

const networkTerms:AffiliateTermsSnapshot={
  id:"terms:partnerize",
  scope:"network",
  providerRef:"provider:partnerize",
  sourceUrl:"https://provider.example/terms",
  termsVersion:"2026-10",
  verifiedAt:"2026-10-03T12:00:00.000Z",
  evidenceRefs:["evidence:network-terms"],
  authority:"AFFILIATE_TERMS_OBSERVATION_ONLY",
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
  moneyMovementAuthorized:false,
}

const programTerms:AffiliateTermsSnapshot={
  id:"terms:campaign-7",
  scope:"program",
  providerRef:"provider:partnerize",
  programRef:"partnerize:campaign:campaign-7",
  sourceUrl:"https://merchant.example/affiliate-terms",
  verifiedAt:"2026-10-03T12:05:00.000Z",
  evidenceRefs:["evidence:program-terms"],
  authority:"AFFILIATE_TERMS_OBSERVATION_ONLY",
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
  moneyMovementAuthorized:false,
}

const disclosure:AffiliateDisclosureObservation={
  id:"disclosure:youtube:1",
  channel:"youtube",
  assetRef:"content:youtube:1",
  clearCommercialRelationship:true,
  prominent:true,
  beforeOrAdjacentToAffiliateLink:true,
  evidenceRefs:["evidence:disclosure"],
  observedAt:"2026-10-03T12:10:00.000Z",
  authority:"AFFILIATE_DISCLOSURE_OBSERVATION_ONLY",
  externalActionAuthorized:false,
  publishingAuthorized:false,
}

const review:AffiliateContentComplianceReview={
  id:"review:youtube:1",
  channel:"youtube",
  assetRef:"content:youtube:1",
  reviewerType:"human",
  reviewerRef:"reviewer:owner",
  checks:{
    channelAllowed:"passed",
    claimsSubstantiated:"passed",
    firstHandClaimsTruthful:"not_applicable",
    syntheticMediaDisclosure:"not_applicable",
    brandBidding:"not_applicable",
    geoRestrictions:"passed",
    emailRules:"not_applicable",
  },
  evidenceRefs:["evidence:review"],
  reviewedAt:"2026-10-03T12:15:00.000Z",
  authority:"AFFILIATE_CONTENT_COMPLIANCE_REVIEW_ONLY",
  externalActionAuthorized:false,
  publishingAuthorized:false,
}

function fixture(){
  const stored:StoredCanonicalOpportunity={
    userId:"owner:test",
    opportunity:opportunity(),
    triageState:"saved",
  }
  const commerceRows=affiliateEvents()
  const complianceRows:AffiliateComplianceSnapshot[]=[]
  const commissioningRows:SideHustleCommissioningEvidence[]=[]

  const opportunityRepository:SideHustleCommercePersistence={
    async get(id){return id===opportunityId?stored:undefined},
    async getSideHustleCommerceRecord(id){
      return commerceRows.find(row=>row.id===id)
    },
    async listSideHustleCommerceRecords(input={}){
      return commerceRows.filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async saveSideHustleCommerceRecord(_kind,record){
      return record as SideHustleCommerceRecord
    },
  }

  const complianceRepository:AffiliateComplianceSnapshotRepository={
    async list(input={}){
      return complianceRows
        .filter(row=>!input.opportunityId||row.opportunityId===input.opportunityId)
        .slice(0,input.limit??50)
    },
    async latest(input){
      return(await this.list({...input,limit:1}))[0]
    },
    async record(snapshot){
      const existing=complianceRows.find(row=>row.id===snapshot.id)
      if(existing){
        expect(existing).toEqual(snapshot)
        return existing
      }
      complianceRows.push(structuredClone(snapshot))
      return snapshot
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
    stored,
    opportunityRepository,
    complianceRepository,
    commissioningRepository,
    complianceRows,
    commissioningRows,
  }
}

describe("affiliate compliance runtime",()=>{
  it("records a fresh evidence-backed compliance pass without granting action authority",async()=>{
    const f=fixture()
    const result=await certifyAffiliateComplianceRuntime(
      {
        opportunityId,
        usedChannels:["youtube"],
        termsSnapshots:[networkTerms,programTerms],
        disclosureObservations:[disclosure],
        contentReviews:[review],
        evaluatedAt:"2026-10-04T00:00:00.000Z",
      },
      f.opportunityRepository,
      f.complianceRepository,
      f.commissioningRepository,
    )

    expect(result.snapshot.status).toBe("passed")
    expect(result.snapshot.activeProgramRefs).toEqual([
      "partnerize:campaign:campaign-7",
    ])
    expect(result.snapshot.expiresAt).toBe("2026-11-03T00:00:00.000Z")
    expect(result.passedGates).toContain("compliance")
    expect(result.commissioningStatus).toBe("commissioning")
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.publishingAuthorized).toBe(false)
    expect(result.paymentAuthorized).toBe(false)
    expect(result.moneyMovementAuthorized).toBe(false)
    expect(f.stored.opportunity.status).toBe("ready")
    expect(f.complianceRows).toHaveLength(1)
    expect(
      f.commissioningRows.find(row=>row.gateType==="compliance")?.status
    ).toBe("passed")
  })

  it("records a blocked compliance gate when required program terms are missing",async()=>{
    const f=fixture()
    const result=await certifyAffiliateComplianceRuntime(
      {
        opportunityId,
        usedChannels:["youtube"],
        termsSnapshots:[networkTerms],
        disclosureObservations:[disclosure],
        contentReviews:[review],
        evaluatedAt:"2026-10-04T00:00:00.000Z",
      },
      f.opportunityRepository,
      f.complianceRepository,
      f.commissioningRepository,
    )

    expect(result.snapshot.status).toBe("blocked")
    expect(result.snapshot.blockers.some(value=>
      value.includes("missing program terms")
    )).toBe(true)
    expect(result.commissioningStatus).toBe("blocked")
    expect(result.pendingGates).toContain("compliance")
    expect(
      f.commissioningRows.find(row=>row.gateType==="compliance")?.status
    ).toBe("blocked")
  })

  it("blocks stale disclosure/review evidence",async()=>{
    const f=fixture()
    const result=await certifyAffiliateComplianceRuntime(
      {
        opportunityId,
        usedChannels:["youtube"],
        termsSnapshots:[networkTerms,programTerms],
        disclosureObservations:[{
          ...disclosure,
          observedAt:"2026-08-01T00:00:00.000Z",
        }],
        contentReviews:[{
          ...review,
          reviewedAt:"2026-08-01T00:00:00.000Z",
        }],
        evaluatedAt:"2026-10-04T00:00:00.000Z",
      },
      f.opportunityRepository,
      f.complianceRepository,
      f.commissioningRepository,
    )

    expect(result.snapshot.status).toBe("blocked")
    expect(result.snapshot.blockers).toEqual(
      expect.arrayContaining([
        "missing fresh disclosure evidence for channel youtube",
        "missing fresh content compliance review for channel youtube",
      ]),
    )
  })
})
