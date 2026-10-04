import {describe,expect,it} from 'vitest'
import {
  PartnerizePaymentSummaryAdapter,
  reconcileAffiliatePayoutBalances,
  type AffiliatePayoutBalanceAdapter,
  type AffiliatePayoutBalanceSnapshot,
} from '@jhadina/commerce-adapters'
import {
  buildSideHustleProfile,
  type Opportunity,
} from '@jhadina/opportunity-core'
import type {StoredCanonicalOpportunity} from './canonical'
import {
  syncAffiliatePayoutBalancesRuntime,
} from './affiliate-payout-runtime'
import type {
  AffiliatePayoutSnapshotRepository,
  StoredAffiliatePayoutSnapshot,
} from './affiliate-payout-repository'

const opportunityId='opportunity:affiliate:payout'
const accountRef='publisher-1'

function snapshot(
  paid:number,
  observedAt:string,
  overrides:Partial<AffiliatePayoutBalanceSnapshot>={},
):AffiliatePayoutBalanceSnapshot{
  return{
    provider:'partnerize',
    accountRef,
    balances:[{
      currency:'USD',
      pending:0,
      approved:25,
      confirmed:20,
      available:5,
      paid,
    }],
    observedAt,
    evidenceRefs:[`partnerize:publisher:${accountRef}:payment-summary`],
    sourceSemantics:'CUMULATIVE_PROVIDER_BALANCES',
    readOnly:true,
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
    ...overrides,
  }
}

function opportunity(family:'commerce_affiliate'|'digital_products'):Opportunity{
  const now='2026-10-03T20:00:00.000Z'
  return{
    id:opportunityId,
    title:'Affiliate payout fixture',
    family:'business',
    type:'commercial',
    sourceName:'fixture',
    sourceUrl:'https://example.test/affiliate-payout',
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

function fixture(family:'commerce_affiliate'|'digital_products'='commerce_affiliate'){
  const op=opportunity(family)
  const rows:StoredAffiliatePayoutSnapshot[]=[]
  const opportunityRepository={
    async get(id:string):Promise<StoredCanonicalOpportunity|undefined>{
      return id===op.id
        ?{userId:'owner:test',opportunity:op,triageState:'saved'}
        :undefined
    },
  }
  const payoutRepository:AffiliatePayoutSnapshotRepository={
    async list(input){
      return rows
        .filter(row=>
          row.opportunityId===input.opportunityId&&
          (!input.provider||row.provider===input.provider)&&
          (!input.accountRef||row.accountRef===input.accountRef)
        )
        .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))
        .slice(0,input.limit??50)
    },
    async latest(input){
      return (await this.list({...input,limit:1}))[0]
    },
    async record(record){
      const existing=rows.find(row=>row.id===record.id)
      if(existing){
        expect(existing).toEqual(record)
        return existing
      }
      rows.push(structuredClone(record))
      return record
    },
  }
  return{opportunityRepository,payoutRepository,rows}
}

class SequenceAdapter implements AffiliatePayoutBalanceAdapter{
  readonly name='partnerize'
  calls=0
  constructor(private readonly values:AffiliatePayoutBalanceSnapshot[]){}
  async readPayoutBalances(){
    const value=this.values[Math.min(this.calls,this.values.length-1)]
    this.calls+=1
    return structuredClone(value)
  }
}

describe('affiliate payout reconciliation',()=>{
  it('normalizes Partnerize payment summary as cumulative balance truth',async()=>{
    let requested=''
    let authorization=''
    const adapter=new PartnerizePaymentSummaryAdapter(
      async(url,init)=>{
        requested=url
        authorization=init?.headers?.Authorization??''
        return{
          ok:true,
          status:200,
          statusText:'OK',
          async json(){
            return{
              summary:{
                pending:{USD:10,EUR:'2.50'},
                approved:{USD:25},
                confirmed:{USD:20},
                available:{USD:5},
                paid:{USD:'100.25',EUR:40},
              },
            }
          },
        }
      },
      {authorizationHeader:'Basic fixture-token'},
    )

    const result=await adapter.readPayoutBalances({
      accountRef,
      observedAt:'2026-10-03T20:00:00Z',
    })

    expect(requested).toContain('/user/publisher/publisher-1/payment/summary')
    expect(authorization).toBe('Basic fixture-token')
    expect(result.balances).toEqual([
      {currency:'EUR',pending:2.5,approved:0,confirmed:0,available:0,paid:40},
      {currency:'USD',pending:10,approved:25,confirmed:20,available:5,paid:100.25},
    ])
    expect(result.sourceSemantics).toBe('CUMULATIVE_PROVIDER_BALANCES')
    expect(result.moneyMovementAuthorized).toBe(false)
  })

  it('uses a paid high-water mark so regressions and recoveries cannot double count',()=>{
    const first=snapshot(100,'2026-10-03T20:00:00Z')
    const baseline=reconcileAffiliatePayoutBalances(undefined,first)
    expect(baseline.baselineRequired).toBe(true)
    expect(baseline.currencies[0]).toMatchObject({
      currentPaid:100,
      highWaterPaid:100,
      realizedPayoutDelta:0,
      status:'baseline',
    })

    const increased=snapshot(125,'2026-10-04T20:00:00Z')
    const gain=reconcileAffiliatePayoutBalances(first,increased,{USD:100})
    expect(gain.currencies[0]).toMatchObject({
      previousPaid:100,
      highWaterPaid:125,
      currentPaid:125,
      realizedPayoutDelta:25,
      status:'increased',
    })

    const regressed=snapshot(120,'2026-10-05T20:00:00Z')
    const regression=reconcileAffiliatePayoutBalances(increased,regressed,{USD:125})
    expect(regression.currencies[0]).toMatchObject({
      previousPaid:125,
      highWaterPaid:125,
      currentPaid:120,
      realizedPayoutDelta:0,
      status:'regressed',
      anomaly:'CUMULATIVE_PAID_BALANCE_BELOW_HIGH_WATER',
    })

    const recovered=snapshot(125,'2026-10-06T20:00:00Z')
    const recovery=reconcileAffiliatePayoutBalances(regressed,recovered,{USD:125})
    expect(recovery.currencies[0]).toMatchObject({
      previousPaid:120,
      highWaterPaid:125,
      currentPaid:125,
      realizedPayoutDelta:0,
      status:'recovered',
    })

    const later=snapshot(130,'2026-10-07T20:00:00Z')
    const newMoney=reconcileAffiliatePayoutBalances(recovered,later,{USD:125})
    expect(newMoney.currencies[0]).toMatchObject({
      highWaterPaid:130,
      realizedPayoutDelta:5,
      status:'increased',
    })
  })

  it('baselines once, skips identical balances, and recognizes only growth above high-water',async()=>{
    const f=fixture()
    const adapter=new SequenceAdapter([
      snapshot(100,'2026-10-03T20:00:00Z'),
      snapshot(100,'2026-10-04T20:00:00Z'),
      snapshot(125,'2026-10-05T20:00:00Z'),
      snapshot(120,'2026-10-06T20:00:00Z'),
      snapshot(125,'2026-10-07T20:00:00Z'),
      snapshot(130,'2026-10-08T20:00:00Z'),
    ])

    const run=()=>syncAffiliatePayoutBalancesRuntime(
      {opportunityId,accountRef},
      adapter,
      f.opportunityRepository,
      f.payoutRepository,
    )

    const baseline=await run()
    expect(baseline.snapshotRecorded).toBe(true)
    expect(baseline.reconciliation.baselineRequired).toBe(true)
    expect(baseline.reconciliation.hasNewPayoutEvidence).toBe(false)
    expect(f.rows).toHaveLength(1)
    expect(f.rows[0].paidHighWater).toEqual({USD:100})

    const unchanged=await run()
    expect(unchanged.snapshotRecorded).toBe(false)
    expect(f.rows).toHaveLength(1)

    const gain=await run()
    expect(gain.reconciliation.currencies[0].realizedPayoutDelta).toBe(25)
    expect(gain.reconciliation.hasNewPayoutEvidence).toBe(true)
    expect(f.rows.at(-1)?.paidHighWater).toEqual({USD:125})

    const regression=await run()
    expect(regression.reconciliation.hasBalanceRegression).toBe(true)
    expect(regression.reconciliation.currencies[0].realizedPayoutDelta).toBe(0)
    expect(f.rows.at(-1)?.paidHighWater).toEqual({USD:125})

    const recovery=await run()
    expect(recovery.reconciliation.currencies[0].status).toBe('recovered')
    expect(recovery.reconciliation.currencies[0].realizedPayoutDelta).toBe(0)
    expect(f.rows.at(-1)?.paidHighWater).toEqual({USD:125})

    const newMoney=await run()
    expect(newMoney.reconciliation.currencies[0].realizedPayoutDelta).toBe(5)
    expect(f.rows.at(-1)?.paidHighWater).toEqual({USD:130})
    expect(newMoney.programAttributionAvailable).toBe(false)
    expect(newMoney.moneyMovementAuthorized).toBe(false)
  })

  it('rejects non-affiliate opportunities before reading provider balances',async()=>{
    const f=fixture('digital_products')
    const adapter=new SequenceAdapter([snapshot(100,'2026-10-03T20:00:00Z')])

    await expect(syncAffiliatePayoutBalancesRuntime(
      {opportunityId,accountRef},
      adapter,
      f.opportunityRepository,
      f.payoutRepository,
    )).rejects.toThrow('AFFILIATE_PAYOUT_REQUIRES_COMMERCE_AFFILIATE')
    expect(adapter.calls).toBe(0)
    expect(f.rows).toHaveLength(0)
  })
})
