import { afterEach,describe,expect,it,vi } from 'vitest'
import {
  discoverPublicProcurementCandidates,
  discoverPublicProcurementCandidatesFromOfficialDomains,
  searchPublicProcurementSources,
} from './public-source-discovery-provider'

const jurisdiction={
  id:'county:06037',
  level:'county' as const,
  name:'Los Angeles County',
  state:'CA' as const,
  county:'Los Angeles',
}

afterEach(()=>{
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('public procurement source discovery provider',()=>{
  it('uses configured web search and corroborates portal links from official pages',async()=>{
    vi.stubEnv('WEB_SEARCH_URL','https://search.example.test/api')
    vi.stubEnv('WEB_SEARCH_API_KEY','test-key')
    const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input)
      if(url.startsWith('https://search.example.test/api')){
        return new Response(JSON.stringify({results:[{
          title:'Los Angeles County Purchasing - Bid Opportunities',
          url:'https://purchasing.lacounty.gov/bids',
          snippet:'Procurement RFP RFQ solicitations for Los Angeles County CA',
        }]}),{status:200,headers:{'content-type':'application/json'}})
      }
      if(url==='https://purchasing.lacounty.gov/bids'){
        return new Response('<a href="https://vendors.planetbids.com/portal/la">Vendor Portal Bid Opportunities</a>',{
          status:200,
          headers:{'content-type':'text/html'},
        })
      }
      return new Response('not found',{status:404})
    }) as unknown as typeof fetch

    const candidates=await discoverPublicProcurementCandidates({
      jurisdiction,
      queries:['Los Angeles County CA procurement bids'],
      queryBudget:1,
      fetchImpl:fetchMock,
      now:'2026-10-01T00:00:00Z',
    })
    expect(candidates.some(c=>c.status==='official_owner_verified')).toBe(true)
    const portal=candidates.find(c=>c.sourceUrl==='https://vendors.planetbids.com/portal/la')
    expect(portal?.status).toBe('official_portal_verified')
    expect(portal?.officialLinkEvidence?.officialPageUrl).toBe('https://purchasing.lacounty.gov/bids')
  })

  it('crawls authoritative dotgov domains without a search provider',async()=>{
    const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input)
      if(url==='https://lacounty.gov/'){
        return new Response(
          '<a href="https://lacounty.gov/purchasing">Purchasing and Bid Opportunities</a>',
          {status:200,headers:{'content-type':'text/html'}},
        )
      }
      if(url==='https://lacounty.gov/purchasing'){
        return new Response(
          '<a href="https://vendors.planetbids.com/portal/la">Vendor Portal</a><a href="/purchasing/awards">Awarded Contracts</a>',
          {status:200,headers:{'content-type':'text/html'}},
        )
      }
      return new Response('not found',{status:404})
    }) as unknown as typeof fetch

    const candidates=await discoverPublicProcurementCandidatesFromOfficialDomains({
      jurisdiction:{...jurisdiction,officialDomainHints:['lacounty.gov']},
      domains:['lacounty.gov'],
      fetchImpl:fetchMock,
      now:'2026-10-01T00:00:00Z',
    })
    expect(candidates.some(c=>c.sourceUrl==='https://lacounty.gov/purchasing'&&c.status==='official_owner_verified')).toBe(true)
    expect(candidates.some(c=>c.sourceUrl==='https://vendors.planetbids.com/portal/la'&&c.status==='official_portal_verified')).toBe(true)
    expect(candidates.some(c=>c.sourceUrl==='https://lacounty.gov/purchasing/awards'&&c.sourceKinds.includes('award'))).toBe(true)
    expect(candidates.every(c=>c.provider==='dotgov_registry')).toBe(true)
  })

  it('falls back to Exa when generic web search is not configured',async()=>{
    vi.stubEnv('EXA_API_KEY','exa-test')
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({results:[{
      title:'Los Angeles County Procurement',
      url:'https://procurement.lacounty.gov/',
      highlights:['County bids solicitations RFP RFQ'],
    }]}),{status:200,headers:{'content-type':'application/json'}})) as unknown as typeof fetch
    const result=await searchPublicProcurementSources({
      jurisdiction,
      queries:['Los Angeles County procurement'],
      queryBudget:1,
      fetchImpl:fetchMock,
      now:'2026-10-01T00:00:00Z',
    })
    expect(result.provider).toBe('exa')
    expect(result.results).toHaveLength(1)
  })

  it('fails closed when no discovery provider is configured',async()=>{
    await expect(searchPublicProcurementSources({
      jurisdiction,
      queries:['Los Angeles County procurement'],
      queryBudget:1,
      fetchImpl:vi.fn() as unknown as typeof fetch,
    })).rejects.toThrow('PUBLIC_SOURCE_SEARCH_NOT_CONFIGURED')
  })
})
