import assert from 'node:assert/strict'
import {
  assessDigitalProductProvenance,
  buildSideHustleProfile,
  createDigitalProductIndustryMatrixCell,
  evaluateDigitalProductMarketplaceEligibility,
  getDigitalProductFamilyDefinition,
  scoreDigitalProductB2bRoi,
  scoreDigitalProductOpportunity,
  type DigitalProductDraft,
  type DigitalProductProvenanceRecord,
  type MarketplacePolicySnapshot,
} from '../index.js'
import type {Opportunity} from './opportunity.js'

const opportunity:Opportunity={
  id:'opportunity:digital-product:fixture',
  title:'Digital Product Studio fixture',
  family:'business',
  type:'commercial',
  sourceName:'fixture',
  sourceUrl:'https://example.test/digital-product',
  claims:[],
  evidence:[],
  verificationStatus:'unverified',
  sourceConfidence:.9,
  riskFlags:[],
  metadata:{sideHustleProfile:buildSideHustleProfile({family:'digital_products'})},
  status:'ready',
  createdAt:'2026-10-03T00:00:00Z',
  updatedAt:'2026-10-03T00:00:00Z',
}

const strong=scoreDigitalProductOpportunity({
  demand:.9,
  buyerIntent:.9,
  pricePotential:.8,
  marginPotential:.95,
  differentiation:.8,
  searchability:.75,
  repeatability:.9,
  bundlePotential:.9,
  competition:.35,
  productionCost:.2,
  supportBurden:.15,
})
const weak=scoreDigitalProductOpportunity({
  demand:.3,
  buyerIntent:.3,
  pricePotential:.25,
  marginPotential:.4,
  differentiation:.2,
  searchability:.25,
  repeatability:.2,
  bundlePotential:.2,
  competition:.9,
  productionCost:.8,
  supportBurden:.7,
})
assert.ok(strong.score>weak.score)
assert.equal(strong.decision,'priority')
assert.equal(weak.decision,'reject')
assert.equal(strong.externalActionAuthorized,false)

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
  problem:'Client intake and shoot preparation are fragmented across documents.',
  desiredOutcome:'One reusable branded client onboarding workflow.',
  evidenceRefs:['evidence:photographer-workflow'],
})
assert.equal(cell.family,'business_form')
assert.equal(getDigitalProductFamilyDefinition(cell.family).tier,'business_roi')

const roi=scoreDigitalProductB2bRoi(cell,{
  timeSaved:.9,
  revenueEnablement:.7,
  riskReduction:.8,
  workflowCriticality:.95,
  repeatUsage:.9,
  customizationUpsell:.85,
})
assert.equal(roi.tier,'high')
assert.ok(roi.score>=75)

const product:DigitalProductDraft={
  id:'digital-product:photographer:onboarding',
  opportunityId:opportunity.id,
  family:'business_form',
  productType:'photographer_client_onboarding_pack',
  title:'Photographer Client Onboarding Pack',
  buyerType:'business',
  marketplaceDisclosures:['ai_assisted'],
  evidenceRefs:['evidence:product-draft'],
}

const policy:MarketplacePolicySnapshot={
  id:'policy:marketplace:2026-10',
  marketplace:'marketplace-fixture',
  sourceUrl:'https://marketplace.example/policy',
  verifiedAt:'2026-10-03T10:00:00Z',
  recheckAfter:'2026-11-03T10:00:00Z',
  rules:[
    {
      id:'rule:business-form',
      productFamily:'business_form',
      eligibility:'allowed_with_requirements',
      requirements:['disclosure:ai_assisted','seller_originality_required'],
      evidenceRefs:['evidence:policy:business-form'],
    },
  ],
  evidenceRefs:['evidence:policy'],
  authority:'MARKETPLACE_POLICY_OBSERVATION_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
}

const eligible=evaluateDigitalProductMarketplaceEligibility({
  product,
  policy,
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(eligible.status,'conditional')
assert.equal(eligible.matchedRuleId,'rule:business-form')
assert.equal(eligible.publishingAuthorized,false)

const stale=evaluateDigitalProductMarketplaceEligibility({
  product,
  policy,
  evaluatedAt:'2026-12-04T00:00:00Z',
})
assert.equal(stale.status,'stale')

const prohibited=evaluateDigitalProductMarketplaceEligibility({
  product:{...product,family:'ai_knowledge',productType:'prompt_pack'},
  policy:{
    ...policy,
    rules:[{
      id:'rule:prompt-pack',
      productFamily:'ai_knowledge',
      productType:'prompt_pack',
      eligibility:'prohibited',
      requirements:[],
      evidenceRefs:['evidence:prompt-policy'],
    }],
  },
  evaluatedAt:'2026-10-04T00:00:00Z',
})
assert.equal(prohibited.status,'blocked')

const provenance:DigitalProductProvenanceRecord={
  id:'provenance:product:1',
  productId:product.id,
  creationMethod:'template_transformed',
  sourceAssets:[{
    assetRef:'template:licensed:1',
    sourceType:'template',
    licenseRef:'license:template:1',
    commercialUseAllowed:true,
    redistributionAllowed:true,
    evidenceRefs:['evidence:template-license'],
  }],
  aiModels:[],
  humanEdits:['Rebuilt hierarchy','Rewrote copy','Created original client workflow'],
  templateProvider:'provider-fixture',
  templateLicenseRef:'license:template:1',
  fonts:['font:licensed:1'],
  commercialRightsVerified:true,
  marketplaceDisclosures:[],
  originalityHash:'sha256:fixture',
  exportFiles:['product.pdf','instructions.pdf'],
  evidenceRefs:['evidence:provenance'],
  observedAt:'2026-10-04T00:00:00Z',
  authority:'DIGITAL_PRODUCT_PROVENANCE_ONLY',
  externalActionAuthorized:false,
  publishingAuthorized:false,
  paymentAuthorized:false,
}
assert.equal(assessDigitalProductProvenance(provenance).status,'passed')

const blocked=assessDigitalProductProvenance({
  ...provenance,
  commercialRightsVerified:false,
  humanEdits:[],
  sourceAssets:[{
    ...provenance.sourceAssets[0],
    licenseRef:undefined,
    commercialUseAllowed:false,
  }],
})
assert.equal(blocked.status,'blocked')
assert.ok(blocked.blockers.some(value=>value.includes('commercial rights')))
assert.ok(blocked.blockers.some(value=>value.includes('documented transformation')))
assert.ok(blocked.blockers.some(value=>value.includes('license evidence')))

assert.throws(()=>createDigitalProductIndustryMatrixCell({
  opportunity,
  id:'bad',
  industry:'photography',
  businessStage:'operating',
  businessFunction:'onboarding',
  buyerRole:'consumer',
  lifecycleStep:'purchase',
  buyerType:'consumer',
  family:'business_form',
  productType:'bad',
  problem:'bad',
  desiredOutcome:'bad',
  evidenceRefs:['evidence:bad'],
}),/does not support buyer type/)

console.log('side hustle digital product studio foundation tests passed')
