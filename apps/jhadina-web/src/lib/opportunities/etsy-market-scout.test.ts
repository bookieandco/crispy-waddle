import { describe,expect,it } from 'vitest'
import { runEtsyMarketplaceScout } from './etsy-market-scout'

function response(body:unknown,status=200,headers:Record<string,string>={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}})
}

describe('Etsy marketplace scout',()=>{
  it('uses public read endpoints and correctly labels shop-wide sales',async()=>{
    const calls:string[]=[]
    const fetchFn:typeof fetch=async(input)=>{
      const url=String(input)
      calls.push(url)
      if(url.includes('/listings/active')){
        return response({results:[{
          listing_id:11,shop_id:22,title:'Personalized hometown print',
          url:'https://www.etsy.com/listing/11/example',num_favorers:77,
        }]})
      }
      return response({
        shop_id:22,shop_name:'FixtureShop',
        created_timestamp:Date.parse('2026-06-01T00:00:00.000Z')/1000,
        transaction_sold_count:1400,review_count:300,review_average:4.9,
      },200,{'x-limit-per-day':'1000','x-remaining-today':'990'})
    }

    const result=await runEtsyMarketplaceScout({
      query:'personalized gifts',
      apiKey:'key:secret',
      now:'2026-10-01T18:00:00.000Z',
      fetchFn,
    })

    expect(calls[0]).toContain('/listings/active')
    expect(calls[0]).toContain('keywords=personalized+gifts')
    expect(calls[1]).toContain('/shops/22')
    expect(result.fastGrowthShops).toBe(1)
    expect(result.perListingSalesClaimed).toBe(false)
    expect(result.creativeAssetsFetched).toBe(false)
    expect(result.records.some(record=>record.signal.unit==='shop_transaction_sold_count')).toBe(true)
    expect(result.records.find(record=>record.signal.kind==='sales')?.signal.note).toContain('scope:shop_level')
    expect(result.records.find(record=>record.signal.kind==='sales')?.signal.note).toContain('listing_sales:not_exposed')
    expect(result.rateLimit?.remainingDay).toBe(990)
  })

  it('fails closed without an API key',async()=>{
    await expect(runEtsyMarketplaceScout({query:'gift',apiKey:''})).rejects.toThrow('ETSY_API_KEY_NOT_CONFIGURED')
  })

  it('does not treat an old high-volume shop as the under-one-year signal',async()=>{
    const fetchFn:typeof fetch=async(input)=>{
      if(String(input).includes('/listings/active'))return response({results:[{listing_id:1,shop_id:2,title:'Gift'}]})
      return response({
        shop_id:2,shop_name:'OldShop',
        created_timestamp:Date.parse('2020-01-01T00:00:00.000Z')/1000,
        transaction_sold_count:50000,
      })
    }
    const result=await runEtsyMarketplaceScout({
      query:'gift',apiKey:'key:secret',now:'2026-10-01T18:00:00.000Z',fetchFn,
    })
    expect(result.fastGrowthShops).toBe(0)
    expect(result.records.find(record=>record.signal.kind==='sales')?.signal.note).toContain('fast_growth_filter:not_passed')
  })
})
