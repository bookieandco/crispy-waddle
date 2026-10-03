import {describe,expect,it} from 'vitest'
import {
  buildLaunchFitShortlist,
  scoreLaunchCandidateFit,
  type LaunchCandidate,
  type LaunchTarget,
} from './printify-catalog-sync'

const mugTarget:LaunchTarget={
  productId:'mugWhite',
  variantId:'mug-11oz',
  label:'11oz white mug',
  productName:'Classic White Mug',
  productType:'mug',
  fulfillmentProductId:'mug',
  variantLabel:'11oz',
  colors:['White'],
  printAreaName:'wrap',
  searchKeywords:['mug'],
}

function candidate(input:Partial<LaunchCandidate>&Pick<LaunchCandidate,'blueprintId'|'blueprintTitle'|'printProviderId'|'printProviderTitle'|'providerVariantId'|'providerVariantTitle'>):LaunchCandidate{
  return{
    providerProductId:null,
    printArea:'front',
    availablePrintAreas:['front'],
    ...input,
  }
}

describe('Printify launch fit shortlist',()=>{
  it('ranks storefront semantic fit without ranking provider quality',()=>{
    const plain=candidate({
      blueprintId:68,blueprintTitle:'Mug 11oz',printProviderId:1,printProviderTitle:'SPOKE Custom Products',
      providerVariantId:33719,providerVariantTitle:'11oz',
    })
    const heart=candidate({
      blueprintId:896,blueprintTitle:'Heart-Shaped Mug',printProviderId:30,printProviderTitle:'OPT OnDemand',
      providerVariantId:77224,providerVariantTitle:'11oz / White',
    })
    const whiteCeramic=candidate({
      blueprintId:1244,blueprintTitle:'White Ceramic Mug, 11oz',printProviderId:228,printProviderTitle:'Taylor',
      providerVariantId:94262,providerVariantTitle:'11oz / White',
    })

    const ranked=buildLaunchFitShortlist(mugTarget,[heart,plain,whiteCeramic])
    expect(ranked[0].candidate.blueprintId).toBe(1244)
    expect(ranked[0].fitReasons).toContain('requested color represented in provider variant')
    expect(ranked.every(entry=>entry.fitReasons.every(reason=>!reason.toLowerCase().includes('quality')))).toBe(true)
  })

  it('keeps provider choice visible while limiting duplicate blueprint dominance',()=>{
    const candidates:LaunchCandidate[]=[
      candidate({blueprintId:5,blueprintTitle:'Unisex Cotton Crew Tee',printProviderId:99,printProviderTitle:'Printify Choice',providerVariantId:17428,providerVariantTitle:'Solid Black / M'}),
      candidate({blueprintId:5,blueprintTitle:'Unisex Cotton Crew Tee',printProviderId:50,printProviderTitle:'Underground Threads',providerVariantId:17428,providerVariantTitle:'Solid Black / M'}),
      candidate({blueprintId:5,blueprintTitle:'Unisex Cotton Crew Tee',printProviderId:39,printProviderTitle:'SwiftPOD',providerVariantId:17428,providerVariantTitle:'Solid Black / M'}),
      candidate({blueprintId:6,blueprintTitle:'Unisex Heavy Cotton Tee',printProviderId:30,printProviderTitle:'OPT OnDemand',providerVariantId:12125,providerVariantTitle:'Black / M'}),
    ]
    const teeTarget:LaunchTarget={
      productId:'concertShirt',variantId:'tee-concert-m',label:'medium concert tee',
      productName:'Vintage Concert Tee',productType:'shirt',fulfillmentProductId:'tee-concert',
      variantLabel:'M',colors:['Black'],printAreaName:'front',searchKeywords:['t-shirt','tee'],
    }

    const shortlist=buildLaunchFitShortlist(teeTarget,candidates,5)
    expect(shortlist.filter(entry=>entry.candidate.blueprintId===5)).toHaveLength(2)
    expect(shortlist.some(entry=>entry.candidate.blueprintId===6)).toBe(true)
  })

  it('excludes candidates whose print area is unresolved',()=>{
    const unresolved=candidate({
      blueprintId:68,blueprintTitle:'Mug 11oz',printProviderId:1,printProviderTitle:'SPOKE Custom Products',
      providerVariantId:33719,providerVariantTitle:'11oz',printArea:null,availablePrintAreas:['left','right'],
    })
    expect(buildLaunchFitShortlist(mugTarget,[unresolved])).toEqual([])
  })

  it('scores exact variant and color evidence above bare family overlap',()=>{
    const exact=candidate({
      blueprintId:1244,blueprintTitle:'White Ceramic Mug, 11oz',printProviderId:228,printProviderTitle:'Taylor',
      providerVariantId:94262,providerVariantTitle:'11oz / White',
    })
    const bare=candidate({
      blueprintId:68,blueprintTitle:'Mug 11oz',printProviderId:1,printProviderTitle:'SPOKE Custom Products',
      providerVariantId:33719,providerVariantTitle:'11oz',
    })
    expect(scoreLaunchCandidateFit(mugTarget,exact).fitScore)
      .toBeGreaterThan(scoreLaunchCandidateFit(mugTarget,bare).fitScore)
  })
})
