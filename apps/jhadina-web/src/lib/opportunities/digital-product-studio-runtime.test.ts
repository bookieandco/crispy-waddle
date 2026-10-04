import {describe,expect,it} from "vitest"
import {
  buildSideHustleProfile,
  type DigitalProductProvenanceRecord,
  type DigitalProductStudioRecord,
  type MarketplacePolicySnapshot,
  type Opportunity,
} from "@jhadina/opportunity-core"
import type {StoredCanonicalOpportunity} from "./canonical"
import type {
  DigitalProductStudioRepository,
  StoredDigitalProductStudioRecord,
} from "./digital-product-studio-repository"
import {
  createDigitalProductMatrixRuntime,
  defineDigitalProductRuntime,
  evaluateDigitalProductMarketplaceRuntime,
  recordDigitalProductPolicyRuntime,
  recordDigitalProductProvenanceRuntime,
  scoreDigitalProductB2bRoiRuntime,
  scoreDigitalProductOpportunityRuntime,
  summarizeDigitalProductStudioRuntime,
} from "./digital-product-studio-runtime"

const opportunityId="opportunity:digital-product:runtime"

function opportunity():Opportunity{
  return{
    id:opportunityId,
    title:"Digital Product Studio runtime fixture",
    family:"business",
    type:"commercial",
    sourceName:"fixture",
    sourceUrl:"https://example.test/digital-product-runtime",
    claims:[],
    evidence:[],
    verificationStatus:"unverified",
    sourceConfidence:.9,
    riskFlags:[],
    metadata:{
      sideHustleProfile:buildSideHustleProfile({family:"digital_products"}),
    },
    status:"ready",
    createdAt:"2026-10-04T00:00:00.000Z",
    updatedAt:"2026-10-04T00:00:00.000Z",
  }
}

function fixture(){
  const stored:StoredCanonicalOpportunity={
    userId:"owner:test",
    opportunity:opportunity(),
    triageState:"saved",
  }
  const rows:StoredDigitalProductStudioRecord[]=[]

  const opportunityRepository={
    async get(id:string){return id===opportunityId?stored:undefined},
  }

  const repository:DigitalProductStudioRepository={
    async get(id){
      return rows.find(row=>row.id===id)
    },
    async list(input={}){
      return rows
        .filter(row=>
          (!input.opportunityId||row.opportunityId===input.opportunityId)&&
          (!input.kind||row.kind===input.kind)
        )
        .slice(0,input.limit??100)
    },
    async record(record){
      const existing=rows.find(row=>row.id===record.id)
      if(existing){
        expect(existing.payload).toEqual(record)
        return existing.payload
      }
      rows.push({
        id:record.id,
        opportunityId:record.opportunityId,
        kind:record.kind,
        status:record.status,
        evidenceRefs:[...record.evidenceRefs],
        payload:structuredClone(record),
        recordedAt:record.recordedAt,
      })
      return record
    },
  }

  return{stored,rows,opportunityRepository,repository}
}

describe("Digital Product Studio registry runtime",()=>{
  it("persists the complete foundation chain with dependency integrity",async()=>{
    const f=fixture()

    const score=await scoreDigitalProductOpportunityRuntime(
      {
        opportunityId,
        id:"score:1",
        signals:{
          demand:.9,buyerIntent:.9,pricePotential:.8,marginPotential:.95,
          differentiation:.8,searchability:.75,repeatability:.9,bundlePotential:.9,
          competition:.35,productionCost:.2,supportBurden:.15,
        },
        evidenceRefs:["evidence:demand"],
        recordedAt:"2026-10-04T01:00:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(score.status).toBe("priority")

    const matrix=await createDigitalProductMatrixRuntime(
      {
        opportunityId,
        id:"matrix:photographer",
        industry:"photography",
        businessStage:"operating",
        businessFunction:"client onboarding",
        buyerRole:"independent photographer",
        lifecycleStep:"booking to shoot preparation",
        buyerType:"business",
        family:"business_form",
        productType:"photographer_client_onboarding_pack",
        problem:"Client intake is fragmented.",
        desiredOutcome:"One reusable onboarding workflow.",
        evidenceRefs:["evidence:workflow"],
        recordedAt:"2026-10-04T01:05:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(matrix.kind).toBe("matrix_cell")

    const roi=await scoreDigitalProductB2bRoiRuntime(
      {
        opportunityId,
        id:"roi:photographer",
        matrixCellId:matrix.id,
        signals:{
          timeSaved:.9,revenueEnablement:.7,riskReduction:.8,
          workflowCriticality:.95,repeatUsage:.9,customizationUpsell:.85,
        },
        evidenceRefs:["evidence:roi"],
        recordedAt:"2026-10-04T01:10:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(roi.status).toBe("high")

    const product=await defineDigitalProductRuntime(
      {
        opportunityId,
        product:{
          id:"product:photographer:onboarding",
          family:"business_form",
          productType:"photographer_client_onboarding_pack",
          title:"Photographer Client Onboarding Pack",
          buyerType:"business",
          marketplaceDisclosures:["ai_assisted"],
          evidenceRefs:["evidence:product"],
        },
        recordedAt:"2026-10-04T01:15:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(product.kind).toBe("product_definition")

    const policy:Omit<
      MarketplacePolicySnapshot,
      "authority"|"externalActionAuthorized"|"publishingAuthorized"
    >={
      id:"policy:fixture",
      marketplace:"marketplace-fixture",
      sourceUrl:"https://marketplace.example/policy",
      verifiedAt:"2026-10-04T00:00:00.000Z",
      recheckAfter:"2026-11-04T00:00:00.000Z",
      rules:[{
        id:"rule:business-form",
        productFamily:"business_form",
        eligibility:"allowed_with_requirements",
        requirements:["disclosure:ai_assisted"],
        evidenceRefs:["evidence:policy-rule"],
      }],
      evidenceRefs:["evidence:policy"],
    }
    const policyRecord=await recordDigitalProductPolicyRuntime(
      {
        opportunityId,
        policy,
        recordedAt:"2026-10-04T01:20:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(policyRecord.kind).toBe("policy_snapshot")

    const eligibility=await evaluateDigitalProductMarketplaceRuntime(
      {
        opportunityId,
        id:"eligibility:1",
        productId:product.id,
        policyRecordId:policyRecord.id,
        evaluatedAt:"2026-10-04T01:25:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(eligibility.status).toBe("conditional")
    expect(eligibility.publishingAuthorized).toBe(false)

    const rawProvenance:Omit<
      DigitalProductProvenanceRecord,
      "productId"|"authority"|"externalActionAuthorized"|"publishingAuthorized"|"paymentAuthorized"
    >={
      id:"provenance:raw:1",
      creationMethod:"template_transformed",
      sourceAssets:[{
        assetRef:"template:licensed:1",
        sourceType:"template",
        licenseRef:"license:template:1",
        commercialUseAllowed:true,
        redistributionAllowed:true,
        evidenceRefs:["evidence:license"],
      }],
      aiModels:[],
      humanEdits:["Rebuilt layout","Rewrote copy"],
      templateProvider:"provider-fixture",
      templateLicenseRef:"license:template:1",
      fonts:["font:licensed:1"],
      commercialRightsVerified:true,
      marketplaceDisclosures:[],
      originalityHash:"sha256:fixture",
      exportFiles:["product.pdf"],
      evidenceRefs:["evidence:provenance"],
      observedAt:"2026-10-04T01:30:00.000Z",
    }
    const provenance=await recordDigitalProductProvenanceRuntime(
      {
        opportunityId,
        id:"provenance-snapshot:1",
        productId:product.id,
        provenance:rawProvenance,
        recordedAt:"2026-10-04T01:30:00.000Z",
      },
      f.opportunityRepository,
      f.repository,
    )
    expect(provenance.status).toBe("passed")

    const summary=await summarizeDigitalProductStudioRuntime(
      {opportunityId},
      f.repository,
    )
    expect(summary).toMatchObject({
      opportunityScores:1,
      matrixCells:1,
      b2bRoiAssessments:1,
      productDefinitions:1,
      policySnapshots:1,
      marketplaceEvaluations:1,
      provenanceSnapshots:1,
      blockedMarketplaceEvaluations:0,
      blockedProvenance:0,
      externalActionAuthorized:false,
      publishingAuthorized:false,
      paymentAuthorized:false,
      moneyMovementAuthorized:false,
    })
    expect(f.stored.opportunity.status).toBe("ready")
  })

  it("refuses dependency records from another opportunity",async()=>{
    const f=fixture()
    const foreign:DigitalProductStudioRecord={
      id:"matrix:foreign",
      opportunityId:"opportunity:other",
      family:"digital_products",
      kind:"matrix_cell",
      status:"recorded",
      payload:{
        id:"matrix:foreign",
        opportunityId:"opportunity:other",
        industry:"other",
        businessStage:"operating",
        businessFunction:"onboarding",
        buyerRole:"owner",
        lifecycleStep:"lead",
        buyerType:"business",
        family:"business_form",
        productType:"form",
        problem:"problem",
        desiredOutcome:"outcome",
        evidenceRefs:["evidence:foreign"],
      },
      evidenceRefs:["evidence:foreign"],
      recordedAt:"2026-10-04T01:00:00.000Z",
      authority:"DIGITAL_PRODUCT_STUDIO_RECORD_ONLY",
      externalActionAuthorized:false,
      publishingAuthorized:false,
      paymentAuthorized:false,
      moneyMovementAuthorized:false,
    }
    f.rows.push({
      id:foreign.id,
      opportunityId:foreign.opportunityId,
      kind:foreign.kind,
      status:foreign.status,
      evidenceRefs:[...foreign.evidenceRefs],
      payload:foreign,
      recordedAt:foreign.recordedAt,
    })

    await expect(scoreDigitalProductB2bRoiRuntime(
      {
        opportunityId,
        id:"roi:bad",
        matrixCellId:foreign.id,
        signals:{
          timeSaved:.8,revenueEnablement:.8,riskReduction:.8,
          workflowCriticality:.8,repeatUsage:.8,customizationUpsell:.8,
        },
        evidenceRefs:["evidence:bad"],
      },
      f.opportunityRepository,
      f.repository,
    )).rejects.toThrow("DIGITAL_PRODUCT_STUDIO_RECORD_OPPORTUNITY_MISMATCH")
  })
})
