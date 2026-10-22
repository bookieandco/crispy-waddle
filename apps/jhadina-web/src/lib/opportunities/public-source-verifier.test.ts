import { describe,expect,it,vi } from 'vitest'
import type { Opportunity } from '@jhadina/opportunity-core'
import { verifyCanonicalPublicExcerpts } from './public-source-verifier'

const time='2026-10-22T07:00:00Z'
const opportunity={
  id:'research:1',title:'Public report',family:'business',type:'commercial',sourceName:'official',sourceUrl:'https://reports.example/a',
  evidence:[
    {id:'e1',sourceId:'a',sourceUrl:'https://reports.example/a',sourceName:'First',sourceType:'official',capturedAt:time,excerpt:'Grounded economic evidence',confidence:0.9},
    {id:'e2',sourceId:'b',sourceUrl:'https://records.example/b',sourceName:'Second',sourceType:'secondary',capturedAt:time,excerpt:'Independent supply figures',confidence:0.8},
  ],
  claims:[],verificationStatus:'unverified',sourceConfidence:0.8,riskFlags:[],status:'discovered',createdAt:time,updatedAt:time,
} as Opportunity

function response(text:string,type='text/html'){
  const bytes=new TextEncoder().encode(text)
  return {ok:true,status:200,headers:{get:(key:string)=>key==='content-type'?type:null},body:new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes);controller.close()}})}
}
describe('OCE actual source inspection',()=>{
  it('requires actual public source content and emits hash evidence',async()=>{
    const fetcher=vi.fn().mockImplementation(async url=>url.includes('reports')?
      response('<main>Grounded economic evidence</main>'):
      response('<main>Independent supply figures</main>'))
    const result=await verifyCanonicalPublicExcerpts({
      opportunity,now:'2026-10-22T07:30:00Z',allowedHosts:['reports.example','records.example'],
    },fetcher)
    expect(result.blockers).toEqual([])
    expect(result.observations).toHaveLength(2)
    expect(result.sourceReceipts).toHaveLength(2)
    expect(result.sourceReceipts[0].contentSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(fetcher.mock.calls[0][1].redirect).toBe('error')
    expect(result.sourceReceipts[0].externalActionAuthorized).toBe(false)
  })
  it('blocks an unapproved host before network IO',async()=>{
    const fetcher=vi.fn()
    const result=await verifyCanonicalPublicExcerpts({
      opportunity,now:'2026-10-22T07:30:00Z',allowedHosts:['reports.example'],
    },fetcher)
    expect(result.blockers.some(x=>x.includes('OCE_SOURCE_HOST_NOT_APPROVED'))).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('denies missing text matches and unsafe source types',async()=>{
    const result=await verifyCanonicalPublicExcerpts({
      opportunity,now:'2026-10-22T07:30:00Z',allowedHosts:['reports.example','records.example'],
    },vi.fn().mockResolvedValue(response('No matching evidence here')))
    expect(result.observations).toHaveLength(0)
    expect(result.blockers).toHaveLength(2)
  })
  it('fails closed on oversized streams, even with false content-length',async()=>{
    const result=await verifyCanonicalPublicExcerpts({
      opportunity:{...opportunity,evidence:opportunity.evidence.slice(0,1)},
      now:'2026-10-22T07:30:00Z',allowedHosts:['reports.example'],
    },vi.fn().mockResolvedValue(response('x'.repeat(1_000_001))))
    expect(result.blockers.join(' ')).toContain('OCE_SOURCE_TOO_LARGE')
    expect(result.sourceReceipts).toHaveLength(0)
  })
  it('requires explicit operator allowlist, never assumes a website is safe',async()=>{
    const fetcher=vi.fn()
    const result=await verifyCanonicalPublicExcerpts({opportunity,allowedHosts:[],now:time},fetcher)
    expect(result.blockers).toEqual(['OCE_APPROVED_SOURCE_HOSTS_REQUIRED'])
    expect(fetcher).not.toHaveBeenCalled()
  })
})
