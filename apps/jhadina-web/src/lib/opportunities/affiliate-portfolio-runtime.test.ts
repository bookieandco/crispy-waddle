import {describe,expect,it} from 'vitest'
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleCommerceRecord,
  type SideHustleAffiliateEvent,
} from '@jhadina/opportunity-core'
import type {StoredCanonicalOpportunity} from './canonical'
import type {StoredSideHustleCommerceRecord} from './supabase-opportunity-repository'
import {summarizeAffiliatePortfolioRuntime} from './affiliate-portfolio-runtime'
import type {SideHustleCommercePersistence} from './side-hustle-commerce-runtime'

const now='2026-10-03T19:00:00.000Z'

function opportunity(family:'commerce_affiliate'|'digital_products'):Opportunity{
  return{
    id:'opportunity:affiliate:portfolio',
    title:'Affiliate portfolio fixture',
    family:'business',
    type:'commercial',
    sourceName:'fixture',
    sourceUrl:'https://example.test/portfolio',
    claims:[],
    evidence:[],
    verificationStatus:'unverified',
    sourceConfidence:.9,
    riskFlags:[],
    metadata:{sideHustleProfile:buildSideHustleProfile({family})},
    status:'ready',
    createdAt:now,
    updatedAt:now,
  }
}

function affiliateEvent(
  input:Pick<SideHustleAffiliateEvent,'id'|'externalEventRef'|'kind'>&
    Partial<SideHustleAffiliateEvent>,
):SideHustleAffiliateEvent{
  return{
    opportunityId:'opportunity:affiliate:portfolio',
    family:'commerce_affiliate',
    programRef:'program:1',
    providerRef:'provider:1',
    evidenceRefs:[`evidence:${input.id}`],
    occurredAt:now,
    authority:'AFFILIATE_OBSERVATION_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
    ...input,
  }
}

function fixture(family:'commerce_affiliate'|'digital_products'='commerce_affiliate'){
  const op=opportunity(family)
  const records:StoredSideHustleCommerceRecord[]=[
    {
      id:'click:1',
      opportunityId:op.id,
      family:'commerce_affiliate',
      kind:'affiliate_event',
      payload:affiliateEvent({id:'click:1',externalEventRef:'click:1',kind:'click'}),
      recordedAt:now,
    },
    {
      id:'conversion:1',
      opportunityId:op.id,
      family:'commerce_affiliate',
      kind:'affiliate_event',
      payload:affiliateEvent({
        id:'conversion:1',
        externalEventRef:'conversion:1',
        kind:'conversion',
        economicState:'approved',
        amount:25,
        currency:'USD',
      }),
      recordedAt:now,
    },
    {
      id:'payout:1',
      opportunityId:op.id,
      family:'commerce_affiliate',
      kind:'affiliate_event',
      payload:affiliateEvent({
        id:'payout:1',
        externalEventRef:'payout:1',
        kind:'payout',
        economicState:'paid',
        amount:20,
        currency:'USD',
      }),
      recordedAt:now,
    },
  ]

  const stored:StoredCanonicalOpportunity={
    userId:'owner:test',
    opportunity:op,
    triageState:'saved',
  }

  const repository:SideHustleCommercePersistence={
    async get(id){return id===op.id?stored:undefined},
    async getSideHustleCommerceRecord(id){return records.find(row=>row.id===id)},
    async listSideHustleCommerceRecords(input={}){
      return records.filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async saveSideHustleCommerceRecord(_kind,record){
      return record as SideHustleCommerceRecord
    },
  }
  return repository
}

describe('affiliate portfolio runtime',()=>{
  it('reports explicit payouts as realized revenue while keeping approved commission separate',async()=>{
    const portfolio=await summarizeAffiliatePortfolioRuntime(
      {opportunityId:'opportunity:affiliate:portfolio'},
      fixture(),
    )

    const program=portfolio.programs[0]
    const usd=program.currencies[0]
    expect(program.clickCount).toBe(1)
    expect(program.approvedConversionCount).toBe(1)
    expect(usd.approvedCommissionAmount).toBe(25)
    expect(usd.realizedRevenueAmount).toBe(20)
    expect(usd.realizedRevenueSource).toBe('PAYOUT_EVENT_ONLY')
    expect(portfolio.warning).toBe('APPROVED_COMMISSION_IS_NOT_REALIZED_REVENUE')
    expect(portfolio.moneyMovementAuthorized).toBe(false)
  })

  it('refuses non-affiliate opportunities even if rows are malformed or mislabeled',async()=>{
    await expect(summarizeAffiliatePortfolioRuntime(
      {opportunityId:'opportunity:affiliate:portfolio'},
      fixture('digital_products'),
    )).rejects.toThrow('AFFILIATE_PORTFOLIO_REQUIRES_COMMERCE_AFFILIATE')
  })
})
