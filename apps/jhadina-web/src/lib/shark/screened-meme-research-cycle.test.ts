import {describe,expect,it,vi} from 'vitest'
import {runScreenedMemeResearchCycle} from './screened-meme-research-cycle'
import type {runMemeAssessmentCycle} from './meme-assessment-worker'
const cutoff='2026-10-21T19:02:00Z'
const baseDiscovery={
  chainId:'solana' as const,mint:'mintX',stage:'NEW_PAIR' as const,protocol:'pump',
  observedAt:'2026-10-21T19:00:00Z',availableAt:'2026-10-21T19:01:00Z',
  evaluatedAsOf:cutoff,volumeUsd:1200,socialLinksCount:1,
  evidenceIds:['discovery','fee-1'],
  fee:{kind:'GLOBAL_FEES_PAID' as const,unit:'SOL' as const,amount:1,
    venue:'verified-terminal',observedAt:'2026-10-21T19:01:00Z',evidenceId:'fee-1'},
}
const cycle={
  assessment:{market:{chainId:'solana',subjectId:'mintX'}},
} as unknown as Parameters<typeof runMemeAssessmentCycle>[0]
const stub=vi.fn(async()=>({
  assessment:{
    assessmentId:'a',assessedAt:'2026-10-21T19:03:00Z',
    token:{chainId:'solana',tokenAddress:'mintX'},
    rugProtection:{disposition:'ALLOW_CANDIDATE'},
    rugSelfProtection:{action:'ALLOW_PAPER_STUDY',missingCriticalCoverage:[]},
    riskAssessment:{band:'candidate'},evidenceIds:['assessment-proof'],
  },
})) as unknown as typeof runMemeAssessmentCycle

describe('screened SHARK app composition',()=>{
  it('does not call canonical runtime for filtered or unknown observations',async()=>{
    const execute=vi.fn() as unknown as typeof runMemeAssessmentCycle
    const skipped=await runScreenedMemeResearchCycle({
      discovery:{...baseDiscovery,volumeUsd:9},presetId:'VIDEO1_NEW_PAIR_SOL_V1',cycle,
    },{executeCycle:execute})
    expect(skipped.persisted).toBe(false)
    expect(skipped.candidate.disposition).toBe('SKIP')
    expect(execute).not.toHaveBeenCalled()
    const unknown=await runScreenedMemeResearchCycle({
      discovery:{...baseDiscovery,fee:undefined},presetId:'VIDEO1_NEW_PAIR_SOL_V1',cycle,
    },{executeCycle:execute})
    expect(unknown.candidate.disposition).toBe('REVIEW')
    expect(execute).not.toHaveBeenCalled()
  })
  it('calls exactly the existing persisted intelligence cycle on matching evidence',async()=>{
    const execute=vi.fn(stub) as unknown as typeof runMemeAssessmentCycle
    const result=await runScreenedMemeResearchCycle({
      discovery:baseDiscovery,presetId:'VIDEO1_NEW_PAIR_SOL_V1',cycle,
    },{executeCycle:execute})
    expect(execute).toHaveBeenCalledTimes(1)
    expect(result.persisted).toBe(true)
    expect(result.candidate.disposition).toBe('WATCH_RESEARCH_ONLY')
    expect(result.canAuthorizeTrade).toBe(false)
  })
  it('rejects a mismatched assessment subject before touching persistence',async()=>{
    const execute=vi.fn() as unknown as typeof runMemeAssessmentCycle
    await expect(runScreenedMemeResearchCycle({
      discovery:baseDiscovery,presetId:'VIDEO1_NEW_PAIR_SOL_V1',
      cycle:{assessment:{market:{chainId:'solana',subjectId:'other'}}} as never,
    },{executeCycle:execute})).rejects.toThrow('ASSET_MISMATCH')
    expect(execute).not.toHaveBeenCalled()
  })
})
