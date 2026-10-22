import { describe, expect, it, vi } from 'vitest'
import { discoverPublicBoard, normalizePublicBoardRows } from './public-job-board'

const captured='2026-10-22T05:00:00.000Z'
describe('OCE owner-triggered public job discovery',()=>{
  it('normalizes official Greenhouse posts into stable, unverified canonical jobs',()=>{
    const input={source:'greenhouse' as const,board:'acme',limit:2}
    const result=normalizePublicBoardRows(input,{jobs:[
      {id:100,title:'Remote AI Evaluator',location:{name:'Remote - US'},absolute_url:'https://acme.example/jobs/100'},
      {id:100,title:'Duplicate',absolute_url:'https://acme.example/jobs/100'},
      {id:101,title:'Not usable',absolute_url:'http://127.0.0.1/private'},
      {id:102,title:'Support',location:{name:'California'},absolute_url:'https://acme.example/jobs/102'},
    ]},captured)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('employment:provider:placement-jobs:greenhouse:acme:100')
    expect(result[0].status).toBe('discovered')
    expect(result[0].verificationStatus).toBe('unverified')
    expect(result[0].metadata?.applicationAuthority).toBe('NONE')
    expect(result[0].metadata?.automationLevel).toBe('ai_plus_user')
    expect(result[0].evidence[0].sourceUrl).toBe('https://acme.example/jobs/100')
  })
  it('normalizes Lever jobs without trusting a listing as an employment offer',()=>{
    const result=normalizePublicBoardRows({source:'lever',board:'acme'},[
      {id:'abc-01',text:'Analyst',hostedUrl:'https://jobs.lever.co/acme/abc-01',categories:{location:'Remote'}},
    ],captured)
    expect(result).toHaveLength(1)
    expect(result[0].sourceName).toContain('Lever')
    expect(result[0].riskFlags).toContain('ELIGIBILITY_UNVERIFIED')
    expect(result[0].eligibility?.remote).toBe(true)
  })
  it('blocks invalid company board slugs and malformed feeds',()=>{
    expect(()=>normalizePublicBoardRows({source:'lever',board:'localhost/../admin'},[],captured)).toThrow(/Invalid board/)
    expect(()=>normalizePublicBoardRows({source:'lever',board:'safe'},{},captured)).toThrow(/unexpected jobs format/)
  })
  it('fetches only the constructed official GET URL with redirect denial',async()=>{
    const spy=vi.fn().mockResolvedValue({ok:true,status:200,headers:{get:()=>null},json:async()=>({jobs:[]})})
    const r=await discoverPublicBoard({source:'greenhouse',board:'acme'},spy)
    expect(r.opportunities).toHaveLength(0)
    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0][0]).toBe('https://boards-api.greenhouse.io/v1/boards/acme/jobs')
    expect(spy.mock.calls[0][1].redirect).toBe('error')
  })
  it('rejects an oversized streamed body even without Content-Length',async()=>{
    const bytes=new TextEncoder().encode('x'.repeat(5_000_001))
    const body=new ReadableStream<Uint8Array>({
      start(controller){controller.enqueue(bytes);controller.close()},
    })
    const source=vi.fn().mockResolvedValue({
      ok:true,status:200,headers:{get:()=>null},body,
      json:async()=>{throw new Error('JSON fallback must not be used')},
    })
    await expect(discoverPublicBoard({source:'greenhouse',board:'acme'},source)).rejects.toThrow(/exceeds limit/)
  })
  it('fails closed on oversize or failed upstream',async()=>{
    const big=vi.fn().mockResolvedValue({ok:true,status:200,headers:{get:()=>String(5_000_001)},json:async()=>[]})
    await expect(discoverPublicBoard({source:'lever',board:'acme'},big)).rejects.toThrow(/exceeds limit/)
    const bad=vi.fn().mockResolvedValue({ok:false,status:503,headers:{get:()=>null},json:async()=>[]})
    await expect(discoverPublicBoard({source:'lever',board:'acme'},bad)).rejects.toThrow(/HTTP 503/)
  })
})
