import { afterEach, describe, expect, it, vi } from 'vitest'
import { scanSamOpportunityWindow } from './sam-client'

afterEach(()=>{
  vi.unstubAllGlobals()
  delete process.env.SAM_GOV_API_KEY
})

describe('SAM wide pagination',()=>{
  it('uses SAM page-index offsets and consumes every page',async()=>{
    process.env.SAM_GOV_API_KEY='test-key'
    const offsets:string[]=[]
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=new URL(String(input))
      const offset=url.searchParams.get('offset')??''
      offsets.push(offset)
      const page=Number(offset)
      return new Response(JSON.stringify({
        totalRecords:2,
        limit:1,
        offset:page,
        opportunitiesData:page<2?[{noticeId:`N${page+1}`,title:`Notice ${page+1}`}]:[],
      }),{status:200,headers:{'content-type':'application/json'}})
    }))

    const result=await scanSamOpportunityWindow({
      postedFrom:'09/20/2026',
      postedTo:'09/21/2026',
      pageSize:1,
      maxPages:5,
    })
    expect(offsets).toEqual(['0','1'])
    expect(result.opportunities.map(row=>row.noticeId)).toEqual(['N1','N2'])
    expect(result.truncated).toBe(false)
  })

  it('marks a page-budget cutoff as truncated',async()=>{
    process.env.SAM_GOV_API_KEY='test-key'
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=new URL(String(input))
      return new Response(JSON.stringify({
        totalRecords:2,
        limit:1,
        offset:Number(url.searchParams.get('offset')??0),
        opportunitiesData:[{noticeId:'N1',title:'Notice 1'}],
      }),{status:200,headers:{'content-type':'application/json'}})
    }))
    const result=await scanSamOpportunityWindow({
      postedFrom:'09/20/2026',
      postedTo:'09/21/2026',
      pageSize:1,
      maxPages:1,
    })
    expect(result.truncated).toBe(true)
  })
})
