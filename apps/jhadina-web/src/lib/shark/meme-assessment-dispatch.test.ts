import {describe,expect,it} from 'vitest'
import {validateScheduledMemeAssessment} from './meme-assessment-dispatch'

const now='2026-10-08T17:00:00.000Z'
const submission=()=>({
  userId:'owner-paper',contextId:'pump:mint:17',source:'shark-canonical-producer',
  assessment:{
    market:{
      chainId:'solana-mainnet',subjectId:'mint',observationId:'observed:17',
      source:'dexscreener',observedAt:'2026-10-08T16:58:00.000Z',
      receivedAt:'2026-10-08T16:58:15.000Z',payload:{liquidityUsd:35000},
    },
  },
  evidence:[{
    evidenceId:'chain-evidence:17',source:'rpc',sourceGroup:'chain',
    immutable:true,observedAt:'2026-10-08T16:58:00.000Z',
    availableAt:'2026-10-08T16:58:15.000Z',
  }],
})

describe('SHARK protected assessment dispatch admission',()=>{
  it('accepts complete recent research evidence but grants no execution authority',()=>{
    const result=validateScheduledMemeAssessment(submission(),now)
    expect(result.contextId).toBe('pump:mint:17')
    expect(result.assessment.market.chainId).toBe('solana-mainnet')
  })
  it('rejects stale market data even with a valid persisted launch',()=>{
    const input=submission()
    input.assessment.market.receivedAt='2026-10-08T16:50:00.000Z'
    expect(()=>validateScheduledMemeAssessment(input,now)).toThrow('SHARK_MEME_DISPATCH_MARKET_STALE_OR_FUTURE')
  })
  it('rejects future quotes and source metadata that arrives after the decision',()=>{
    const input=submission()
    input.assessment.market.receivedAt='2026-10-08T17:01:00.000Z'
    expect(()=>validateScheduledMemeAssessment(input,now)).toThrow('SHARK_MEME_DISPATCH_MARKET_STALE_OR_FUTURE')
    const more=submission()
    more.evidence[0]!.availableAt='2026-10-08T17:01:00.000Z'
    expect(()=>validateScheduledMemeAssessment(more,now)).toThrow('SHARK_MEME_DISPATCH_EVIDENCE_TIME_INVALID')
  })
  it('does not accept unverified, empty or duplicated provenance',()=>{
    const missing=submission()
    missing.evidence[0]!.immutable=false
    expect(()=>validateScheduledMemeAssessment(missing,now)).toThrow('SHARK_MEME_DISPATCH_PROVENANCE_INVALID')
    const duplicate=submission()
    duplicate.evidence.push({...duplicate.evidence[0]!})
    expect(()=>validateScheduledMemeAssessment(duplicate,now)).toThrow('SHARK_MEME_DISPATCH_PROVENANCE_INVALID')
    const none=submission()
    none.evidence=[]
    expect(()=>validateScheduledMemeAssessment(none,now)).toThrow('SHARK_MEME_DISPATCH_EVIDENCE_REQUIRED')
  })
})
