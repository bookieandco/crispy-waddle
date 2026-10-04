import assert from 'node:assert/strict'
import {
  buildSideHustleProfile,
} from './side-hustles.js'
import {
  createDigitalProductIndustryMatrixCell,
  type DigitalProductDraft,
  type DigitalProductProvenanceRecord,
  type MarketplacePolicySnapshot,
} from './side-hustle-digital-product-studio.js'
import {
  createDigitalProductB2bRoiRecord,
  createDigitalProductDefinitionRecord,
  createDigitalProductEligibilityRecord,
  createDigitalProductMatrixRecord,
  createDigitalProductOpportunityScoreRecord,
  createDigitalProductPolicyRecord,
  createDigitalProductProvenanceRecord,
} from './side-hustle-digital-product-registry.js'
import type {Opportunity} from './opportunity.js'

const opportunity:Opportunity={
  id:'opportunity:digital-product:registry',
  title:'Digital Product Registry fixture',
  family:'business',
  type:'commercial',
  sourceName:'fixture',
  sourceUrl:'https://example.test/digital-product-registry',
  claims:[],
  evidence:[],
  verificationStatus:'unverified',
  sourceConfidence:.9,
  riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'digital_products'})},
  status:'ready',
  createdAt:'2026-10-04T00:00:00Z',
  updatedAt:'2026-10-04T00:00:00Z',
}

const score=createDigitalProductOpportunityScoreRecord({
  opportunity,
  id:'digital-product-score:1',
  signals:{
    demand:.9,buyerIntent:.9,pricePotential:.8,marginPotential:.95,
    differentiation:.8,searchability:.75,repeatability:.9,bundlePotential:.9,
    competition:.35,productionCost:.2,supportBurden:.15,
  },
  evidenceRefs:['evidence:market-demand'],
  recordedAt:'2026-10-04T01:00:00Z',
})
assert.equal(score.family,'digital_products')
assert.equal(score.kind,'opportunity_score')
assert.equal(score.status,'priority')
assert.equal(score.externalActionAuthorized,false)

const cell=createDigitalProductIndustryMatrixCell({
  opportunity,
  id:'matrix:photographer:onboarding',
  industry:'photography',
  businessStage:'operating',
  businessFunction:'client onboarding',
  buyerRole:'independent photographer',
  lifecycleStep:'booking to shoot preparation',
  buyerType:'business',
  family:'business_form',
  productType:'photographer_client_onboarding_pack',
  problem:'Client intake is fragmented.',
  desiredOutcome:'One reusable onboarding workflow.',
  evidenceRefs:['evidence:workflow'],
})
const matrix=createDigitalProductMatrixRecord({
  opportunity,
  cell,
  recordedAt:'2026-10-04T01:05:00Z',
})
assert.equal(matrix.kind,'matrix_cell')

const roi=createDigitalProductB2bRoiRecord({
  opportunity,
  id:'b2b-roi:photographer:onboarding',
  cell,
  signals:{
    timeSaved:.9,revenueEnablement:.7,riskReduction:.8,
    workflowCriticality:.95,repeatUsage:.9,customizationUpsell:.85,
  },
  evidenceRefs:['evidence:roi'],
  recordedAt:'2026-10-04T01:10:00Z',
})
assert.equal(roi.kind,'b2b_roi')
assert.equal(roi.status,'high')

const product:DigitalProductDraft={
  id:'digital-product:photographer:onboarding',
  opportunityId:opportunity.id,
  family:'business_form',
  productType:'photographer_client_onboarding_pack',
  title:'Photographer Client Onboarding Pack',
  buyerType:'business',
  marketplaceDisclosures:['ai_assisted'],
  evidenceRefs:['evidence:product-definition'],
}
const definition=createDigitalProductDefinitionRecord({
  opportunity,
  product,
  recordedAt:'2026-10-04T01:15:00Z',
})
assert.equal(definition.kind,'product_definition')
assert.equal(definition.status,'draft')

const policy:MarketplacePolicySnapshot={
  id:'policy:fixture:2026-10',
  marketplace:'marketplace-fixture',
  sourceUrl:'https://marketplace.example/policy',
  verifiedAt:'2026-10-04T00:00:00Z',
  recheckAfter:'2026-11-04T00:00:00Z',
  rules:[{
    id:'rule:business-form',
    productFamily:'business_form',
    eligibility:'allowed_with_requirements',
    requirements:['disclosure:ai_assisted'],
    evidenceRefs:['evidence:policy-rule'],
  }],
  evidenceRefs:['evidence:policy'],
  authority:'MARKETPLACE_POLICY_OBSERVATION_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
}
const policyRecord=createDigitalProductPolicyRecord({
  opportunity,
  policy,
  recordedAt:'2026-10-04T01:20:00Z',
})
assert.equal(policyRecord.kind,'policy_snapshot')
assert.equal(policyRecord.status,'verified')

const eligibility=createDigitalProductEligibilityRecord({
  opportunity,
  id:'eligibility:product:fixture',
  product,
  policy,
  evaluatedAt:'2026-10-04T01:25:00Z',
})
assert.equal(eligibility.kind,'marketplace_eligibility')
assert.equal(eligibility.status,'conditional')
assert.equal(eligibility.publishingAuthorized,false)

const provenance:DigitalProductProvenanceRecord={
  id:'provenance:fixture',
  productId:product.id,
  creationMethod:'template_transformed',
  sourceAssets:[{
    assetRef:'template:licensed:1',
    sourceType:'template',
    licenseRef:'license:template:1',
    commercialUseAllowed:true,
    redistributionAllowed:true,
    evidenceRefs:['evidence:license'],
  }],
  aiModels:[],
  humanEdits:['Rebuilt layout','Rewrote copy'],
  templateProvider:'provider-fixture',
  templateLicenseRef:'license:template:1',
  fonts:['font:licensed:1'],
  commercialRightsVerified:true,
  marketplaceDisclosures:[],
  originalityHash:'sha256:fixture',
  exportFiles:['product.pdf'],
  evidenceRefs:['evidence:provenance'],
  observedAt:'2026-10-04T01:30:00Z',
  authority:'DIGITAL_PRODUCT_PROVENANCE_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
}
const provenanceRecord=createDigitalProductProvenanceRecord({
  opportunity,
  id:'provenance-snapshot:fixture',
  product,
  provenance,
  recordedAt:'2026-10-04T01:30:00Z',
})
assert.equal(provenanceRecord.kind,'provenance')
assert.equal(provenanceRecord.status,'passed')

assert.throws(()=>createDigitalProductDefinitionRecord({
  opportunity:{...opportunity,id:'opportunity:other'},
  product,
  recordedAt:'2026-10-04T01:30:00Z',
}),/does not belong to opportunity/)

assert.throws(()=>createDigitalProductProvenanceRecord({
  opportunity,
  id:'provenance:bad',
  product,
  provenance:{...provenance,productId:'product:other'},
  recordedAt:'2026-10-04T01:30:00Z',
}),/does not belong to product/)

console.log('side hustle digital product registry tests passed')
