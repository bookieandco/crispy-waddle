import { describe, expect, it } from 'vitest'
import { fetchReadOnlyGscSnapshot, type GscSnapshot } from './business-growth-gsc.js'
import { inspectOwnedWebsite, rankBusinessSearchWork, prepareGrowthContentBrief, prepareGrowthDistribution } from './business-growth-search-content.js'
import { reconcileGrowthContribution, createBusinessGrowthExperiment, assessBusinessGrowthExperiment } from './business-growth-experiments.js'

const retrievedAt='2026-10-15T15:30:00Z'
const property='https://www.pupsonstuff.example/'
function client(input?: { permission?:string; page?:string; clicks?:number; missingProperty?:boolean }) {
  const calls:{url:string;method:string;body?:unknown}[]=[]
  const fn=async(url:string, init:RequestInit): Promise<Response> => {
    calls.push({url,method:init.method??'',body:init.body?JSON.parse(String(init.body)):undefined})
    const body = url.endsWith('/sites')
      ? {siteEntry:input?.missingProperty?[]:[{siteUrl:property,permissionLevel:input?.permission??'siteOwner'}]}
      : {rows:[{keys:['custom dog portrait',input?.page??'https://www.pupsonstuff.example/products/portrait'],
        clicks:input?.clicks??6,impressions:150,ctr:0.04,position:5.5}]}
    return new Response(JSON.stringify(body),{status:200})
  }
  return { fn, calls }
}
const gscInput = {
  businessWebsite:'https://www.pupsonstuff.example/',property,
  startDate:'2026-09-01',endDate:'2026-09-30',retrievedAt,
  serverAccessToken:'secret-test-token',
}
describe('BIZ-GROWTH.02 — trusted read-only Search Console port',()=>{
  it('verifies the real property, scopes pages and keeps observations separate from commerce',async()=>{
    const provider=client()
    const snapshot=await fetchReadOnlyGscSnapshot({...gscInput,fetchClient:provider.fn})
    expect(provider.calls.map(x=>x.method)).toEqual(['GET','POST'])
    expect(provider.calls[1]?.url).toContain('searchAnalytics/query')
    expect((provider.calls[1]?.body as Record<string,unknown>).dataState).toBe('final')
    expect(snapshot.rows[0]?.query).toBe('custom dog portrait')
    expect(snapshot.rows[0]?.evidenceStatus).toBe('PROVIDER_OBSERVED_NOT_CONVERSION')
    expect(snapshot.revenueVerified).toBe(false)
    expect(snapshot.truncatedOrIncomplete).toBe(true)
    expect(JSON.stringify(snapshot)).not.toContain('secret-test-token')
  })
  it('fails closed on absent site permission or a cross-site result',async()=>{
    await expect(fetchReadOnlyGscSnapshot({...gscInput,fetchClient:client({missingProperty:true}).fn}))
      .rejects.toThrow('GSC_PROPERTY_ACCESS_NOT_VERIFIED')
    await expect(fetchReadOnlyGscSnapshot({...gscInput,fetchClient:client({permission:'siteUnverifiedUser'}).fn}))
      .rejects.toThrow('GSC_PROPERTY_ACCESS_NOT_VERIFIED')
    await expect(fetchReadOnlyGscSnapshot({...gscInput,fetchClient:client({page:'https://attacker.example/oops'}).fn}))
      .rejects.toThrow('GSC_RESULT_OUTSIDE_OWNED_SITE')
  })
  it('rejects client property escalation, future windows and impossible values',async()=>{
    await expect(fetchReadOnlyGscSnapshot({...gscInput,property:'sc-domain:attacker.example',fetchClient:client().fn}))
      .rejects.toThrow('GSC_PROPERTY_NOT_OWNED_BY_BUSINESS')
    await expect(fetchReadOnlyGscSnapshot({...gscInput,endDate:'2027-01-01',fetchClient:client().fn}))
      .rejects.toThrow('GSC_FUTURE_OR_INVALID_RETRIEVAL')
    await expect(fetchReadOnlyGscSnapshot({...gscInput,fetchClient:client({clicks:151}).fn}))
      .rejects.toThrow('GSC_METRIC_INCONSISTENT')
  })
})
const snapshot: GscSnapshot={
  property,retrievedAt,dateRange:{startDate:'2026-09-01',endDate:'2026-09-30'},
  truncatedOrIncomplete:true,revenueVerified:false,externalActionAuthorized:false,
  rows:[{
    id:'gsc:1',property,query:'custom dog portrait',
    page:'https://www.pupsonstuff.example/products/portrait',
    clicks:30,impressions:300,ctr:0.1,position:4.8,
    period:{startDate:'2026-09-01',endDate:'2026-09-30'},
    retrievedAt,source:'GOOGLE_SEARCH_CONSOLE_API',
    evidenceStatus:'PROVIDER_OBSERVED_NOT_CONVERSION',externalActionAuthorized:false,
  }],
}
describe('BIZ-GROWTH.03-.06 — evidence, content and Social-bound handoffs',()=>{
  it('audits only owned page observations, without inventing ranking improvements',()=>{
    const result=inspectOwnedWebsite({
      website:'https://www.pupsonstuff.example',
      observations:[{
        url:'https://www.pupsonstuff.example/products/portrait',
        responseStatus:200,title:'Custom dog portraits',description:'',
        productOfferId:'offer:portrait',schemaTypes:['BreadcrumbList'],
        evidenceRef:'crawl:receipt1',inspectedAt:retrievedAt,
      }],
    })
    expect(result.findings.map(x=>x.issue)).toEqual(['DESCRIPTION_MISSING','PRODUCT_SCHEMA_MISSING'])
    expect(result.claimsRankingImprovement).toBe(false)
    expect(()=>inspectOwnedWebsite({website:'https://www.pupsonstuff.example',observations:[{
      url:'https://outsider.example/products/portrait',responseStatus:200,
      evidenceRef:'crawl:2',inspectedAt:retrievedAt,
    }]})).toThrow('BIZ_GROWTH_AUDIT_CROSS_SITE')
  })
  it('places existing high-intent pages before new drafts and retains competitor uncertainty',()=>{
    const result=rankBusinessSearchWork({
      website:'https://www.pupsonstuff.example',
      gsc:snapshot,
      existingPages:['https://www.pupsonstuff.example/products/portrait'],
      competitors:[{id:'comp:1',url:'https://anotherstore.example/',businessName:'Another Store',
        overlap:'direct',evidenceRefs:['research:obs'],observedAt:retrievedAt}],
      candidates:[
        {id:'c:1',phrase:'custom dog portrait',intent:'transactional',buyerProblem:'Pet portrait gift',
          possibleOfferId:'offer:portrait',evidenceRefs:['gsc:1']},
        {id:'c:2',phrase:'how do portraits work',intent:'informational',buyerProblem:'Understand art',
          evidenceRefs:['research:2']},
        {id:'c:3',phrase:'personalized pet canvas gift',intent:'commercial',buyerProblem:'Buy a gift',
          possibleOfferId:'offer:canvas',evidenceRefs:['market:1']},
      ],
    })
    expect(result.actions[0]?.kind).toBe('REPAIR_EXISTING')
    expect(result.actions[1]?.kind).toBe('CREATE_DRAFT')
    expect(result.actions[2]?.kind).toBe('RESEARCH_ONLY')
    expect(result.competitorReview[0]?.overlap).toBe('unverified')
  })
  it('rejects sourced-claim-free briefs, creates drafts only, and never grants Reddit posting authority',()=>{
    const briefInput={
      id:'brief:1',businessId:'biz:pupsonstuff',offerId:'offer:portrait',
      title:'Custom dog portrait options',intent:'transactional' as const,
      buyerQuestion:'What is the best custom dog portrait?',customerBenefit:'Gift a personalized pet keepsake',
      sourceRefs:['gsc:1'],claimEvidenceRefs:['owner:offer:portrait'],
      CTAUrl:'https://www.pupsonstuff.example/products/portrait',mediaRightsRefs:['rights:photos'],
    }
    expect(()=>prepareGrowthContentBrief({...briefInput,mediaRightsRefs:[]})).toThrow('BIZ_GROWTH_BRIEF_PROVENANCE_REQUIRED')
    const brief=prepareGrowthContentBrief(briefInput)
    expect(brief.publishingAuthorized).toBe(false)
    const result=prepareGrowthDistribution({
      brief,brandId:'brand:pupsonstuff',anchorAssetId:'asset:original1',
      humanApprovedSourceAnswer:'A personalized portrait is made from your pet photo.',
      claims:['Photo is user provided'],createdAt:retrievedAt,
      surfaces:['social:instagram','community:reddit'],
    })
    expect(result.drafts).toHaveLength(2)
    expect(result.drafts[1]?.format).toBe('community_post')
    expect(result.drafts.every(x=>x.authority==='CONTENT_DRAFT_ONLY')).toBe(true)
    expect(result.directPostingAuthorized).toBe(false)
    expect(result.reviewState).toBe('BLOCKED_PENDING_CANONICAL_APPROVAL')
  })
})
const contribution={
  receiptId:'commerce:1',businessId:'biz:pupson',missionId:'growth:m1',experimentId:'experiment:1',
  sourceAssetId:'asset:1',campaignId:'campaign:1',orderId:'order:1',
  provider:'Shopify',providerSettlementRef:'shopify:paid:1',
  currency:'USD' as const,settledAt:retrievedAt,grossRevenueCents:3900,
  refundsCents:0,fulfillmentCents:1400,platformFeesCents:200,attributionCostCents:100,
  evidenceRefs:['commerce:settlement:1'],source:'CANONICAL_COMMERCE_RECONCILIATION' as const,
}
const accepted={businessId:'biz:pupson',missionId:'growth:m1',experimentId:'experiment:1',orderIdsAlreadyScored:[]}
describe('BIZ-GROWTH.07-.08 — observed outcomes and 30-day review',()=>{
  it('does not award XP to impressions, missing settlement details, refunds or duplicate orders',()=>{
    expect(reconcileGrowthContribution(null,accepted).earnedXp).toBe(0)
    expect(reconcileGrowthContribution({...contribution,fulfillmentCents:undefined},accepted).status).toBe('INCOMPLETE')
    expect(reconcileGrowthContribution(contribution,{...accepted,orderIdsAlreadyScored:['order:1']}).earnedXp).toBe(0)
    const scored=reconcileGrowthContribution(contribution,accepted)
    expect(scored.realizedCents).toBe(2200)
    expect(scored.earnedXp).toBe(42)
    expect(reconcileGrowthContribution({...contribution,refundsCents:3600},accepted).earnedXp).toBe(0)
    expect(reconcileGrowthContribution({...contribution,businessId:'biz:other'},accepted).status).toBe('INCOMPLETE')
  })
  it('produces a 30-day bounded plan and leaves missing future evidence incomplete',()=>{
    const experiment=createBusinessGrowthExperiment({
      id:'experiment:1',businessId:'biz:pupson',ventureId:'venture:pupson',
      startDate:'2026-10-15',hypothesis:'Prioritize existing buyer-intent pages over new informational articles',
    })
    expect(experiment.endDate).toBe('2026-11-13')
    expect(experiment.checkpoints).toHaveLength(9)
    expect(experiment.ownerApprovedSpendUsd).toBe(0)
    expect(experiment.automaticPublicationAuthorized).toBe(false)
    const now=assessBusinessGrowthExperiment({experiment,checkpointReceipts:[],
      outcome:reconcileGrowthContribution(contribution,accepted),assessedAt:retrievedAt})
    expect(now.outcome).toBe('INCOMPLETE')
    expect(now.earnedXp).toBe(0)
    const completed=experiment.checkpoints.map(cp=>({
      experimentId:experiment.id,day:cp.day,
      recordedAt:'2026-11-13T23:00:00Z',
      evidenceRefs:['receipt:checkpoint:'+cp.day],
      status:'COMPLETED' as const,kind:'PROVIDER_OR_OWNER_REVIEW' as const,
    }))
    expect(() => assessBusinessGrowthExperiment({experiment,
      checkpointReceipts:[{...completed[0]!,recordedAt:'2026-10-14T23:00:00Z'}],
      outcome:null, assessedAt:'2026-11-14T00:00:00Z',
    })).toThrow('BIZ_GROWTH_CHECKPOINT_RECEIPT_INVALID')
    const final=assessBusinessGrowthExperiment({experiment,checkpointReceipts:completed,
      outcome:reconcileGrowthContribution(contribution,accepted),assessedAt:'2026-11-14T00:00:00Z'})
    expect(final.outcome).toBe('POSITIVE_CONTRIBUTION_OBSERVED')
    expect(final.automaticScalingAuthorized).toBe(false)
    expect(final.earnedXp).toBe(42)
  })
})
