import {describe,expect,it} from "vitest"
import {
  PartnerizeProgramPayoutAttributionAdapter,
  type PartnerizeFetch,
} from "@jhadina/commerce-adapters"

type FixtureOptions={
  paymentDate?:string|null
  paidCurrency?:string
  selfbillCurrency?:string
  trackedCurrency?:string
  vat?:number
  withheldTax?:number
  publisherId?:string
  itemStatus?:string
  itemCommission?:number
}

function adapterFixture(options:FixtureOptions={}){
  const requests:string[]=[]
  const fetchImpl:PartnerizeFetch=async(url)=>{
    requests.push(url)
    if(url.includes("/conversion.json")){
      return{
        ok:true,
        status:200,
        statusText:"OK",
        async json(){
          return{
            count:1,
            limit:300,
            offset:0,
            conversions:[{
              conversion_data:{
                conversion_id:"conversion-1",
                campaign_id:"campaign-7",
                publisher_id:"publisher-1",
                conversion_time:"2026-10-01 10:00:00",
                currency:"USD",
                customer_reference:"customer-1",
                conversion_items:[{
                  conversion_item_id:"item-9",
                  item_publisher_commission:options.itemCommission??25,
                  item_status:options.itemStatus??"approved",
                  publisher_self_bill_id:"selfbill-3",
                }],
              },
            }],
          }
        },
      }
    }
    if(url.includes("/selfbill/selfbill-3")){
      return{
        ok:true,
        status:200,
        statusText:"OK",
        async json(){
          return{
            selfbill:{
              publisher_self_bill_id:"selfbill-3",
              publisher_id:options.publisherId??"publisher-1",
              payment_date:
                options.paymentDate===undefined
                  ?"2026-10-03 12:00:00"
                  :options.paymentDate,
              paid_currency:options.paidCurrency??"USD",
              selfbill_currency:options.selfbillCurrency??"USD",
              tracked_currency:options.trackedCurrency??"USD",
              net_value:25,
              total_value:25,
              tracked_net_value:25,
              vat_value:options.vat??0,
              withheld_tax:options.withheldTax??0,
            },
          }
        },
      }
    }
    return{
      ok:false,
      status:404,
      statusText:"Not Found",
      async json(){return{}},
    }
  }

  return{
    requests,
    adapter:new PartnerizeProgramPayoutAttributionAdapter(fetchImpl,{
      authorizationHeader:"Basic fixture-token",
    }),
  }
}

describe("Partnerize program payout attribution",()=>{
  it("emits an item-level canonical payout only after a paid unambiguous selfbill",async()=>{
    const f=adapterFixture()
    const batch=await f.adapter.read({
      accountRef:"publisher-1",
      startAt:"2026-10-01T00:00:00Z",
      endAt:"2026-10-02T00:00:00Z",
    })

    expect(batch.complete).toBe(true)
    expect(batch.warnings).toEqual([])
    expect(batch.observations).toHaveLength(1)
    expect(batch.observations[0]).toMatchObject({
      provider:"partnerize",
      accountRef:"publisher-1",
      programRef:"partnerize:campaign:campaign-7",
      externalEventRef:"partnerize:selfbill:selfbill-3:item:item-9",
      kind:"payout",
      providerStatus:"paid_selfbill_item",
      economicState:"paid",
      amount:25,
      currency:"USD",
      occurredAt:"2026-10-03T12:00:00.000Z",
      metadata:{
        conversion_id:"conversion-1",
        conversion_item_id:"item-9",
        conversion_at:"2026-10-01T10:00:00.000Z",
        selfbill_id:"selfbill-3",
        selfbill_payment_at:"2026-10-03T12:00:00.000Z",
        settlement_currency:"USD",
        settlement_basis:"paid_selfbill_item_no_fx_no_tax",
      },
    })
    expect(batch.observations[0].evidenceRefs).toEqual(
      expect.arrayContaining([
        "partnerize:publisher:publisher-1:conversion:conversion-1",
        "partnerize:publisher:publisher-1:conversion:conversion-1:item:item-9",
        "partnerize:publisher:publisher-1:selfbill:selfbill-3",
      ]),
    )
    expect(f.requests.some(url=>url.includes("statuses%5B%5D=approved"))).toBe(true)
    expect(f.requests.some(url=>url.includes("include_payment_info=true"))).toBe(true)
  })

  it.each([
    ["unpaid",{paymentDate:null},"selfbill_unpaid"],
    ["fx",{paidCurrency:"EUR"},"selfbill_currency_ambiguous"],
    ["vat",{vat:1},"selfbill_tax_ambiguous"],
    ["withholding",{withheldTax:1},"selfbill_tax_ambiguous"],
    ["publisher mismatch",{publisherId:"publisher-other"},"selfbill_identity_mismatch"],
  ] as const)(
    "rejects %s selfbill attribution",
    async(_label,options,warning)=>{
      const f=adapterFixture(options)
      const batch=await f.adapter.read({
        accountRef:"publisher-1",
        startAt:"2026-10-01T00:00:00Z",
      })
      expect(batch.observations).toEqual([])
      expect(batch.warnings?.some(value=>value.includes(warning))).toBe(true)
    },
  )

  it("does not count a non-approved conversion item as paid revenue",async()=>{
    const f=adapterFixture({itemStatus:"pending"})
    const batch=await f.adapter.read({
      accountRef:"publisher-1",
      startAt:"2026-10-01T00:00:00Z",
    })
    expect(batch.observations).toEqual([])
    expect(batch.warnings?.some(value=>value.includes("item_not_approved"))).toBe(true)
    expect(f.requests.some(url=>url.includes("/selfbill/"))).toBe(false)
  })

  it("caches the same selfbill across repeated reads",async()=>{
    const f=adapterFixture()
    await f.adapter.read({
      accountRef:"publisher-1",
      startAt:"2026-10-01T00:00:00Z",
    })
    await f.adapter.read({
      accountRef:"publisher-1",
      startAt:"2026-10-01T00:00:00Z",
    })
    expect(f.requests.filter(url=>url.includes("/selfbill/selfbill-3"))).toHaveLength(1)
  })
})
