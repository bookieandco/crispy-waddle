import { describe, expect, it } from 'vitest'
import { runVentureMarketScout, ventureSignalFromTrend, type VentureScoutSeed } from './venture-market-scout-runtime'

const seed: VentureScoutSeed = {
  id: 'pod-test',
  family: 'pod_personalized_commerce',
  query: 'personalized gifts',
  freshnessDays: 30,
}

describe('venture market scout mapping', () => {
  it('creates stable provenance-rich search signals without execution authority', () => {
    const observation = {
      source: 'web' as const,
      title: 'Personalized hometown gift demand',
      url: 'https://example.test/product-cluster',
      observedAt: '2026-10-01T15:00:00.000Z',
      signals: { topic: 'personalized gifts' },
      evidence: ['buyer review velocity increased'],
    }

    const first = ventureSignalFromTrend(seed, observation)
    const second = ventureSignalFromTrend(seed, observation)

    expect(first.signal.id).toBe(second.signal.id)
    expect(first.signal.kind).toBe('search')
    expect(first.signal.sourceRef).toBe(observation.url)
    expect(first.signal.confidence).toBeGreaterThan(0.5)
    expect(first.family).toBe('pod_personalized_commerce')
    expect(first.signal.note).toContain('buyer review velocity increased')
  })

  it('maps non-web observations to social evidence rather than creative replicas', () => {
    const mapped = ventureSignalFromTrend(seed, {
      source: 'tiktok',
      title: 'Gift personalization trend',
      url: 'https://example.test/video',
      observedAt: '2026-10-01T15:00:00.000Z',
      signals: { topic: 'personalized gifts', engagement: 1200 },
      evidence: ['views:5000', 'shares:120'],
    })
    expect(mapped.signal.kind).toBe('social')
    expect(mapped.signal.value).toBe(1200)
    expect(mapped.signal.unit).toBe('engagement')
  })  it('treats persisted native Etsy evidence as a processed scout cycle even when web search is unavailable', async () => {
    const persisted:string[]=[]
    const result=await runVentureMarketScout({} as never,{
      seeds:[{
        id:'pod-personalized-market',
        family:'pod_personalized_commerce',
        query:'personalized gifts',
        freshnessDays:30,
      }],
      async search(){ throw new Error('WEB_SEARCH_NOT_CONFIGURED') },
      etsyEnabled:true,
      async etsyScout(){
        return{
          configured:true,
          query:'personalized gifts print on demand',
          listingsObserved:1,
          shopsObserved:1,
          fastGrowthShops:1,
          records:[{
            seedId:'pod-personalized-market',
            family:'pod_personalized_commerce',
            sourceTitle:'FixtureShop',
            sourceUrl:'https://www.etsy.com/shop/FixtureShop',
            signal:{
              id:'venture-signal:etsy:shop-sales',
              kind:'sales',
              sourceRef:'https://www.etsy.com/shop/FixtureShop',
              observedAt:'2026-10-01T18:00:00.000Z',
              value:1400,
              unit:'shop_transaction_sold_count',
              note:'scope:shop_level — listing_sales:not_exposed_by_this_public_read_path',
              confidence:0.9,
            },
          }],
          readOnly:true,
          perListingSalesClaimed:false,
          creativeAssetsFetched:false,
        }
      },
      repository:{
        async upsertScoutSignals(records){
          persisted.push(...records.map(record=>record.signal.id))
          return records.length
        },
      },
    })

    expect(result.status).toBe('PROCESSED')
    expect(result.successfulSeeds).toBe(0)
    expect(result.failedSeeds).toBe(1)
    expect(result.nativeMarketplaces.etsy.status).toBe('ok')
    expect(result.nativeMarketplaces.etsy.persisted).toBe(1)
    expect(result.observations).toBe(1)
    expect(persisted).toContain('venture-signal:etsy:shop-sales')
  })

  it('remains blocked when neither web nor native marketplace evidence is persisted', async () => {
    const result=await runVentureMarketScout({} as never,{
      seeds:[{
        id:'pod-personalized-market',
        family:'pod_personalized_commerce',
        query:'personalized gifts',
        freshnessDays:30,
      }],
      async search(){ throw new Error('WEB_SEARCH_NOT_CONFIGURED') },
      etsyEnabled:false,
      repository:{async upsertScoutSignals(records){return records.length}},
    })
    expect(result.status).toBe('BLOCKED')
    expect(result.observations).toBe(0)
    expect(result.nativeMarketplaces.etsy.status).toBe('skipped')
  })

})
