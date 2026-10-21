import { describe, expect, it } from 'vitest'
import { fetchOwnedPageSpeed } from './business-growth-page-speed.js'

const site = 'https://pupsonstuff.example/'
const now = '2026-10-18T15:30:00Z'
function fakeResponse(id = site, score = 0.62): Response {
  return new Response(JSON.stringify({
    id,
    lighthouseResult: {
      categories: {
        performance:{score},seo:{score:0.92},
        accessibility:{score:0.83},'best-practices':{score:0.96},
      },
      audits: {
        'largest-contentful-paint':{title:'Largest Contentful Paint',score:0.31,displayValue:'4.2 s'},
        'uses-optimized-images':{title:'Serve optimized images',score:0.5},
        'not-applicable':{title:'Not applicable',score:null},
      },
    },
  }),{status:200})
}
describe('JH-PERSONAL-SEO.02 read-only PageSpeed lab adapter',()=>{
  it('checks only Google fixed API, produces bounded scores and no writes',async()=>{
    const calls: Array<{url:string;init:RequestInit}> = []
    const result = await fetchOwnedPageSpeed({
      businessWebsite:site,pageUrl:site+'products/portrait',strategy:'mobile',
      checkedAt:now,serverApiKey:'test-secret-keep-server-only',
      fetchClient:async(url,init)=>{
        calls.push({url,init})
        return fakeResponse(site+'products/portrait')
      },
    })
    expect(calls).toHaveLength(1)
    const endpoint=new URL(calls[0]!.url)
    expect(endpoint.origin).toBe('https://www.googleapis.com')
    expect(endpoint.pathname).toBe('/pagespeedonline/v5/runPagespeed')
    expect(endpoint.searchParams.get('strategy')).toBe('mobile')
    expect(endpoint.searchParams.getAll('category')).toEqual([
      'performance','seo','accessibility','best-practices',
    ])
    expect(calls[0]!.init.method).toBe('GET')
    expect(calls[0]!.init.redirect).toBe('error')
    expect(result.scores.performance).toBe(62)
    expect(result.scores.seo).toBe(92)
    expect(result.findings[0]?.id).toBe('largest-contentful-paint')
    expect(result.findings).toHaveLength(2)
    expect(result.measurementType).toBe('LAB_ONLY')
    expect(result.fieldCoreWebVitalsVerified).toBe(false)
    expect(result.externalActionAuthorized).toBe(false)
    expect(JSON.stringify(result)).not.toContain('test-secret-keep-server-only')
  })
  it('rejects cross-property pages and local/internal targets before network activity',async()=>{
    const blocked = async(businessWebsite:string,pageUrl:string)=>{
      let called=false
      await expect(fetchOwnedPageSpeed({businessWebsite,pageUrl,strategy:'desktop',
        checkedAt:now,fetchClient:async()=>{called=true;return fakeResponse()},
      })).rejects.toThrow()
      expect(called).toBe(false)
    }
    await blocked(site,'https://outside.example/')
    await blocked(site,'http://pupsonstuff.example/')
    await blocked('https://127.0.0.1/','https://127.0.0.1/')
    await blocked('https://localhost/','https://localhost/')
    await blocked('https://pupsonstuff.example/private/','https://pupsonstuff.example/other')
  })
  it('rejects provider redirects offsite or invalid Lighthouse scores',async()=>{
    await expect(fetchOwnedPageSpeed({businessWebsite:site,pageUrl:site,
      strategy:'mobile',checkedAt:now,fetchClient:async()=>fakeResponse('https://other.example/'),
    })).rejects.toThrow('PROVIDER_REDIRECTED_OFFSITE')
    await expect(fetchOwnedPageSpeed({businessWebsite:site,pageUrl:site,
      strategy:'mobile',checkedAt:now,fetchClient:async()=>fakeResponse(site,100),
    })).rejects.toThrow('SCORE_INVALID')
  })
})
