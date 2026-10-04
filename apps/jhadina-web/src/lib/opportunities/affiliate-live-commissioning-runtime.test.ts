import {describe,expect,it} from "vitest"
import type {
  AffiliateNetworkObservationAdapter,
  AffiliateNetworkReadBatch,
  AffiliatePayoutBalanceAdapter,
  AffiliatePayoutBalanceSnapshot,
} from "@jhadina/commerce-adapters"
import {
  buildSideHustleProfile,
  type Opportunity,
  type SideHustleCommissioningEvidence,
  type SideHustleCommerceRecord,
} from "@jhadina/opportunity-core"
import type {StoredCanonicalOpportunity} from "./canonical"
import type {
  AffiliatePayoutSnapshotRepository,
  StoredAffiliatePayoutSnapshot,
} from "./affiliate-payout-repository"
import {
  commissionAffiliateLiveRuntime,
} from "./affiliate-live-commissioning-runtime"
import type {
  SideHustleCommissioningEvidenceRepository,
} from "./side-hustle-commissioning-repository"
import type {
  SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime"
import type {
  StoredSideHustleCommerceRecord,
} from "./supabase-opportunity-repository"

const opportunityId="opportunity:affiliate:commissioning"
const accountRef="publisher-1"

function opportunity():Opportunity{
  const now="2026-10-03T19:00:00.000Z"
  return{
    id:opportunityId,
    title:"Affiliate commissioning fixture",
    family:"business",
    type:"commercial",
    sourceName:"fixture",
    sourceUrl:"https://example.test/affiliate-commissioning",
    claims:[],
    evidence:[],
    verificationStatus:"unverified",
    sourceConfidence:.9,
    riskFlags:[],
    metadata:{
      sideHustleProfile:buildSideHustleProfile({family:"commerce_affiliate"}),
    },
    status:"ready",
    createdAt:now,
    updatedAt:now,
  }
}

function payoutSnapshot(
  paid:number,
  observedAt:string,
):AffiliatePayoutBalanceSnapshot{
  return{
    provider:"partnerize",
    accountRef,
    balances:[{
      currency:"USD",
      pending:0,
      approved:20,
      confirmed:20,
      available:0,
      paid,
    }],
    observedAt,
    evidenceRefs:[`partnerize:publisher:${accountRef}:payment-summary`],
    sourceSemantics:"CUMULATIVE_PROVIDER_BALANCES",
    readOnly:true,
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function fixture(){
  const op=opportunity()
  const stored:StoredCanonicalOpportunity={
    userId:"owner:test",
    opportunity:op,
    triageState:"saved",
  }
  const commerceRows=new Map<string,StoredSideHustleCommerceRecord>()
  const payoutRows:StoredAffiliatePayoutSnapshot[]=[]
  const commissioningRows:SideHustleCommissioningEvidence[]=[]

  const opportunityRepository:SideHustleCommercePersistence={
    async get(id){return id===opportunityId?stored:undefined},
    async getSideHustleCommerceRecord(id){return commerceRows.get(id)},
    async listSideHustleCommerceRecords(input={}){
      return [...commerceRows.values()].filter(row=>
        (!input.opportunityId||row.opportunityId===input.opportunityId)&&
        (!input.family||row.family===input.family)&&
        (!input.kind||row.kind===input.kind)
      )
    },
    async saveSideHustleCommerceRecord(kind,record){
      const existing=commerceRows.get(record.id)
      if(existing)return existing.payload
      commerceRows.set(record.id,{
        id:record.id,
        opportunityId:record.opportunityId,
        family:record.family,
        kind,
        status:"status" in record?String(record.status):undefined,
        payload:structuredClone(record) as SideHustleCommerceRecord,
        recordedAt:"occurredAt" in record
          ?String(record.occurredAt)
          :"2026-10-03T19:00:00.000Z",
      })
      return record
    },
  }

  const payoutRepository:AffiliatePayoutSnapshotRepository={
    async list(input){
      return payoutRows
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
      const existing=payoutRows.find(row=>row.id===record.id)
      if(existing){
        expect(existing).toEqual(record)
        return existing
      }
      payoutRows.push(structuredClone(record))
      return record
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
    opportunityRepository,
    payoutRepository,
    commissioningRepository,
    commerceRows,
    payoutRows,
    commissioningRows,
  }
}

function networkAdapter(
  provider:"partnerize"|"cj-affiliate",
  economicState:"pending"|"approved"|"rejected"|"paid"="approved",
):AffiliateNetworkObservationAdapter{
  return{
    name:provider,
    async read(input):Promise<AffiliateNetworkReadBatch>{
      return{
        provider,
        accountRef:input.accountRef,
        observations:[{
          provider,
          accountRef:input.accountRef,
          programRef:`${provider}:program:1`,
          externalEventRef:`${provider}:conversion:1`,
          kind:"conversion",
          providerStatus:economicState,
          economicState,
          amount:20,
          currency:"USD",
          occurredAt:"2026-10-03T19:30:00.000Z",
          evidenceRefs:[`${provider}:conversion:1`],
        }],
        complete:true,
        readOnly:true,
      }
    },
  }
}

function programPayoutAdapter():AffiliateNetworkObservationAdapter{
  return{
    name:"partnerize",
    async read(input):Promise<AffiliateNetworkReadBatch>{
      return{
        provider:"partnerize",
        accountRef:input.accountRef,
        observations:[{
          provider:"partnerize",
          accountRef:input.accountRef,
          programRef:"partnerize:campaign:campaign-7",
          externalEventRef:"partnerize:selfbill:selfbill-3:item:item-9",
          kind:"payout",
          providerStatus:"paid_selfbill_item",
          economicState:"paid",
          amount:25,
          currency:"USD",
          occurredAt:"2026-10-03T19:45:00.000Z",
          evidenceRefs:[
            "partnerize:publisher:publisher-1:conversion:conversion-1:item:item-9",
            "partnerize:publisher:publisher-1:selfbill:selfbill-3",
          ],
          metadata:{
            conversion_at:"2026-10-03T19:35:00.000Z",
            selfbill_payment_at:"2026-10-03T19:45:00.000Z",
            settlement_basis:"paid_selfbill_item_no_fx_no_tax",
          },
        }],
        complete:true,
        warnings:[],
        readOnly:true,
      }
    },
  }
}

class PayoutSequence implements AffiliatePayoutBalanceAdapter{
  readonly name="partnerize"
  private index=0
  constructor(private readonly snapshots:AffiliatePayoutBalanceSnapshot[]){}
  async readPayoutBalances(){
    const snapshot=this.snapshots[Math.min(this.index,this.snapshots.length-1)]
    this.index+=1
    return structuredClone(snapshot)
  }
}

describe("affiliate live commissioning runtime",()=>{
  it("baselines historical payout, then passes payment only after a new positive paid delta",async()=>{
    const f=fixture()
    const payout=new PayoutSequence([
      payoutSnapshot(100,"2026-10-03T20:00:00.000Z"),
      payoutSnapshot(120,"2026-10-03T21:00:00.000Z"),
    ])

    const first=await commissionAffiliateLiveRuntime(
      {
        opportunityId,
        provider:"partnerize",
        accountRef,
        observedAt:"2026-10-03T20:00:00.000Z",
      },
      {
        networkAdapter:networkAdapter("partnerize","approved"),
        programPayoutAdapter:programPayoutAdapter(),
        payoutAdapter:payout,
        opportunityRepository:f.opportunityRepository,
        payoutRepository:f.payoutRepository,
        commissioningRepository:f.commissioningRepository,
      },
    )

    expect(first.evidence.map(row=>row.gateType)).toEqual(
      expect.arrayContaining(["provider","credential","live_customer"]),
    )
    expect(first.evidence.map(row=>row.gateType)).toContain("payment_billing")
    expect(first.payout?.recognizedPayoutSinceBaseline).toEqual({USD:0})
    expect(first.programPayout?.observationsPersisted).toBe(1)
    expect(first.portfolio.programs.some(program=>
      program.currencies.some(currency=>currency.realizedRevenueAmount===25)
    )).toBe(true)
    expect(first.pendingGates).toEqual(
      expect.arrayContaining(["compliance","data_analytics"]),
    )
    expect(first.status).toBe("commissioning")

    const second=await commissionAffiliateLiveRuntime(
      {
        opportunityId,
        provider:"partnerize",
        accountRef,
        observedAt:"2026-10-03T21:00:00.000Z",
      },
      {
        networkAdapter:networkAdapter("partnerize","approved"),
        programPayoutAdapter:programPayoutAdapter(),
        payoutAdapter:payout,
        opportunityRepository:f.opportunityRepository,
        payoutRepository:f.payoutRepository,
        commissioningRepository:f.commissioningRepository,
      },
    )

    expect(second.payout?.reconciliation.hasNewPayoutEvidence).toBe(true)
    expect(second.payout?.recognizedPayoutSinceBaseline).toEqual({USD:20})
    expect(second.evidence.map(row=>row.gateType)).toContain("payment_billing")
    expect(second.passedGates).toEqual(
      expect.arrayContaining([
        "provider",
        "credential",
        "live_customer",
        "payment_billing",
      ]),
    )
    expect(second.pendingGates).toEqual(
      expect.arrayContaining(["compliance","data_analytics"]),
    )
    expect(second.status).toBe("commissioning")
    expect(second.moneyMovementAuthorized).toBe(false)
  })

  it("keeps CJ payment commissioning pending because no payout adapter proves cash received",async()=>{
    const f=fixture()
    const result=await commissionAffiliateLiveRuntime(
      {
        opportunityId,
        provider:"cj-affiliate",
        accountRef,
        observedAt:"2026-10-03T20:00:00.000Z",
      },
      {
        networkAdapter:networkAdapter("cj-affiliate","approved"),
        opportunityRepository:f.opportunityRepository,
        payoutRepository:f.payoutRepository,
        commissioningRepository:f.commissioningRepository,
      },
    )

    expect(result.payout).toBeUndefined()
    expect(result.passedGates).toEqual(
      expect.arrayContaining(["provider","credential","live_customer"]),
    )
    expect(result.pendingGates).toContain("payment_billing")
    expect(result.status).toBe("commissioning")
  })

  it("does not pass live-customer on pending or rejected conversion evidence",async()=>{
    for(const economicState of ["pending","rejected"] as const){
      const f=fixture()
      const result=await commissionAffiliateLiveRuntime(
        {
          opportunityId,
          provider:"cj-affiliate",
          accountRef,
          observedAt:"2026-10-03T20:00:00.000Z",
        },
        {
          networkAdapter:networkAdapter("cj-affiliate",economicState),
          opportunityRepository:f.opportunityRepository,
          payoutRepository:f.payoutRepository,
          commissioningRepository:f.commissioningRepository,
        },
      )
      expect(result.passedGates).not.toContain("live_customer")
      expect(result.pendingGates).toContain("live_customer")
    }
  })

  it("refuses incomplete provider pagination before writing commissioning evidence",async()=>{
    const f=fixture()
    const adapter:AffiliateNetworkObservationAdapter={
      name:"cj-affiliate",
      async read(input):Promise<AffiliateNetworkReadBatch>{
        return{
          provider:"cj-affiliate",
          accountRef:input.accountRef,
          observations:[],
          nextCursor:"next",
          complete:false,
          readOnly:true,
        }
      },
    }

    await expect(commissionAffiliateLiveRuntime(
      {
        opportunityId,
        provider:"cj-affiliate",
        accountRef,
        observedAt:"2026-10-03T20:00:00.000Z",
        maxPages:1,
      },
      {
        networkAdapter:adapter,
        opportunityRepository:f.opportunityRepository,
        payoutRepository:f.payoutRepository,
        commissioningRepository:f.commissioningRepository,
      },
    )).rejects.toThrow("AFFILIATE_COMMISSIONING_NETWORK_INCOMPLETE")

    expect(f.commissioningRows).toHaveLength(0)
  })
})
