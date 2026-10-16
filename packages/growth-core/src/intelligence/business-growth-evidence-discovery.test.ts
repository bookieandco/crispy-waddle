import { describe,expect,it } from 'vitest'
import { reviewAiVisibilitySamples,reviewSerpBuyerIntent } from './business-growth-evidence-discovery.js'
const site='https://www.pupsonstuff.com'
const now='2026-10-15T16:30:00Z'
const sample={
  id:'answer:1',engine:'chatgpt' as const,
  prompt:'Who makes custom dog portraits?',market:'us-en',observedAt:now,
  sourceRef:'manual:answer:1',source:'MANUAL_UNVERIFIED' as const,
  answer:'PupsonStuff makes custom portraits; check these pages.',
  citations:['https://www.pupsonstuff.com/portraits','https://other.example/a'],
}
const serp={
  query:'buy custom dog portrait',market:'us-en',observedAt:now,
  source:'MANUAL_UNVERIFIED' as const,sourceRef:'manual:serp:1',
  organic:[
    {url:'https://another.example/custom',position:1},
    {url:'https://www.pupsonstuff.com/custom',position:2},
  ],
  peopleAlsoAsk:['How do I order a dog portrait?'],
  relatedSearches:['custom dog portrait price'],
}
describe('Business Growth research sources and game gates',()=>{
  it('tracks cited samples without claiming AI ranking, revenue or earned XP',()=>{
    const review=reviewAiVisibilitySamples({site,brand:'PupsonStuff',now,observations:[sample]})
    expect(review.brandMentionSamples).toBe(1)
    expect(review.ownedSiteCitationSamples).toBe(1)
    expect(review.outsideCitationDomains).toEqual(['other.example'])
    expect(review.observationsAreSampledNotRankings).toBe(true)
    expect(review.noRevenueOrXp).toBe(true)
    expect(review.publishingAuthorized).toBe(false)
    expect(review.externalActionAuthorized).toBe(false)
  })
  it('does not confuse near-name or malicious lookalike domain with brand presence',()=>{
    const review=reviewAiVisibilitySamples({site,brand:'PupsonStuff',now,observations:[
      {...sample,answer:'PupsonStuffed is not the same brand',
        citations:['https://www.pupsonstuff.com.evil.example/path']},
    ]})
    expect(review.brandMentionSamples).toBe(0)
    expect(review.ownedSiteCitationSamples).toBe(0)
    expect(review.outsideCitationDomains).toEqual(['pupsonstuff.com.evil.example'])
  })
  it('rejects stale, duplicated, future and wrong-source samples',()=>{
    expect(()=>reviewAiVisibilitySamples({site,brand:'PupsonStuff',now,observations:[sample,sample]}))
      .toThrow('GROWTH_RESEARCH_DUPLICATE_SAMPLE')
    expect(()=>reviewAiVisibilitySamples({site,brand:'PupsonStuff',now,observations:[
      {...sample,observedAt:'2026-01-01T00:00:00Z'},
    ]})).toThrow('GROWTH_RESEARCH_SAMPLE_STALE')
    expect(()=>reviewAiVisibilitySamples({site,brand:'PupsonStuff',now,observations:[
      {...sample,observedAt:'2026-10-16T00:00:00Z'},
    ]})).toThrow('GROWTH_RESEARCH_SAMPLE_STALE')
  })
  it('prefers optimizing a real existing result to generating more copy',()=>{
    const review=reviewSerpBuyerIntent({site,now,snapshot:serp,
      ownedPages:['https://www.pupsonstuff.com/custom'],validatedOfferIds:['offer:portrait']})
    expect(review.action).toBe('OPTIMIZE_EXISTING_REVIEW')
    expect(review.existingOwnedPageUrls).toHaveLength(1)
    expect(review.unverifiedCompetitorDomains).toEqual(['another.example'])
    expect(review.intent).toBe('TRANSACTIONAL')
    expect(review.canPublish).toBe(false)
    expect(review.earnedXp).toBe(0)
  })
  it('uses commercial intent to propose a brief only when an eligible offer and provider report exist',()=>{
    const input={site,now,snapshot:{...serp,organic:[serp.organic[0]!],
      source:'PROVIDER_REPORTED' as const},ownedPages:[],validatedOfferIds:['offer:portrait']}
    const withSource=reviewSerpBuyerIntent(input)
    expect(withSource.action).toBe('EVALUATE_NEW_BRIEF')
    expect(withSource.sourceTrust).toBe('REPORTED_NOT_CERTIFIED')
    expect(withSource.canPublish).toBe(false)
    expect(reviewSerpBuyerIntent({...input,snapshot:{...input.snapshot,
      source:'MANUAL_UNVERIFIED' as const}}).action).toBe('RESEARCH_ONLY')
    expect(reviewSerpBuyerIntent({...input,validatedOfferIds:[]}).action).toBe('RESEARCH_ONLY')
    expect(reviewSerpBuyerIntent({...input,ownedPages:['https://www.pupsonstuff.com/existing-offer']})
      .action).toBe('RESEARCH_ONLY')
    expect(reviewSerpBuyerIntent({...input,snapshot:{...input.snapshot,
      query:'how to draw an animal'}}).action).toBe('RESEARCH_ONLY')
  })
  it('fails closed on unrelated venture pages and invented SERP positions',()=>{
    expect(()=>reviewSerpBuyerIntent({site,now,snapshot:serp,
      ownedPages:['https://another.example/'],validatedOfferIds:[]}))
      .toThrow('GROWTH_RESEARCH_CROSS_VENTURE_PAGE')
    expect(()=>reviewSerpBuyerIntent({site,now,snapshot:{...serp,
      organic:[serp.organic[0]!,{...serp.organic[1]!,position:1}]},
      ownedPages:[],validatedOfferIds:[]}))
      .toThrow('GROWTH_RESEARCH_SERP_POSITION_INVALID')
  })
})
