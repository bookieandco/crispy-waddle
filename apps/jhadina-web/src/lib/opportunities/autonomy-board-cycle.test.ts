import { describe,expect,it,vi } from 'vitest'
import { runBoundedBoardCycle } from './autonomy-board-cycle'
import { normalizePublicBoardRows } from './public-job-board'
const now='2026-10-22T07:00:00Z'
const jobs=normalizePublicBoardRows({source:'greenhouse',board:'acme'},{
  jobs:[{id:111,title:'Research Analyst',absolute_url:'https://careers.example/111'}],
},now)
describe('Autonomy bounded job discovery',()=>{
  it('previews without inserting, contacts or applications',async()=>{
    const ingest=vi.fn().mockResolvedValue({id:jobs[0].id})
    const discover=vi.fn().mockResolvedValue({capturedAt:now,sourceUrl:'https://boards-api.greenhouse.io',opportunities:jobs})
    const result=await runBoundedBoardCycle({
      sources:[{source:'greenhouse',board:'acme'}],mode:'preview',ownerAuthenticated:true,
    },{discover,ingest})
    expect(result.scanned).toBe(1)
    expect(result.fetched).toBe(1)
    expect(result.persisted).toBe(0)
    expect(result.status).toBe('preview')
    expect(result.eligibleForUnattendedSchedule).toBe(false)
    expect(result.applicationAuthorized).toBe(false)
    expect(ingest).not.toHaveBeenCalled()
  })
  it('writes only on authenticated owner import and dedupes board tokens',async()=>{
    const ingest=vi.fn().mockImplementation(async row=>({id:row.id}))
    const discover=vi.fn().mockResolvedValue({capturedAt:now,sourceUrl:'https://boards-api.greenhouse.io',opportunities:jobs})
    const result=await runBoundedBoardCycle({
      sources:[{source:'greenhouse',board:'acme'},{source:'greenhouse',board:'ACME'}],
      mode:'owner_import',ownerAuthenticated:true,
    },{discover,ingest})
    expect(result.scanned).toBe(1)
    expect(result.persisted).toBe(1)
    expect(discover).toHaveBeenCalledOnce()
    expect(ingest).toHaveBeenCalledOnce()
  })
  it('refuses unauthenticated and excessive requests',async()=>{
    const deps={discover:vi.fn(),ingest:vi.fn()}
    await expect(runBoundedBoardCycle({sources:[{source:'lever',board:'acme'}],mode:'preview',ownerAuthenticated:false},deps)).rejects.toThrow(/Authenticated/)
    await expect(runBoundedBoardCycle({sources:Array(6).fill({source:'lever',board:'acme'}),mode:'preview',ownerAuthenticated:true},deps)).rejects.toThrow(/1-5/)
  })
  it('does not disguise failed imports as successful',async()=>{
    const result=await runBoundedBoardCycle({sources:[{source:'greenhouse',board:'acme'}],mode:'owner_import',ownerAuthenticated:true},{
      discover:vi.fn().mockResolvedValue({capturedAt:now,sourceUrl:'https://example.org',opportunities:jobs}),
      ingest:vi.fn().mockRejectedValue(new Error('storage rejected')),
    })
    expect(result.status).toBe('partially_failed')
    expect(result.persisted).toBe(0)
    expect(result.failed[0]).toContain('storage rejected')
  })
})
