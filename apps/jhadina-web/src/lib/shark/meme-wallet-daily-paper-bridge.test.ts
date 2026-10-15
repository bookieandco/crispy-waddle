import { describe,expect,it } from 'vitest'
import type { MemeAssessmentCycleResult } from './meme-assessment-worker'
import { buildMemePaperBatchFromPersistedShark } from './meme-wallet-daily-paper-bridge'
import type { MemePaperSafetyReceipt } from './meme-wallet-paper-adapter'
const token='So11111111111111111111111111111111111111112'
const quote='11111111111111111111111111111111'
const cutoff='2026-10-14T22:07:00.000Z'
const proof=(check:MemePaperSafetyReceipt['check']):MemePaperSafetyReceipt=>({
  check,tokenMint:token,verified:true,sourceId:'chain:safe',sourceGroup:'rpc:primary',
  evidenceId:'chain:'+check,
  observedAt:'2026-10-14T22:06:58.000Z',
  availableAt:'2026-10-14T22:06:59.000Z',
  authority:'CHAIN_RESEARCH_EVIDENCE_ONLY',canAuthorizeTrade:false,
})
const assessment={
  assessmentId:'canonical:100',
  assessedAt:'2026-10-14T22:06:58.000Z',
  token:{chainId:'solana-mainnet',tokenAddress:token},
  evidenceIds:['assessment:100'],
  rugProtection:{disposition:'ALLOW_CANDIDATE',evidenceIds:['rug:100']},
  rugSelfProtection:{action:'ALLOW_PAPER_STUDY',missingCriticalCoverage:[],evidenceIds:['rug:self:100']},
  riskAssessment:{overallRisk:0.1,band:'candidate'},
}
const persisted={
  assessment,
  persistence:'INSERTED',runtimeIngress:'INSERTED',
  authority:'INTELLIGENCE_ONLY',canAuthorizeTrade:false,
  envelope:{
    assessment:{assessmentId:assessment.assessmentId,tokenAddress:token,informationCutoff:cutoff},
    authority:{financialExecution:'NONE',walletSigning:'NONE'},
  },
} as unknown as MemeAssessmentCycleResult
const quoteEvidence={
  quoteMint:quote,receivedAt:'2026-10-14T22:06:59.000Z',
  expectedSlippageBps:100,totalCostsMinor:5n,sourceId:'paper:quote',
  evidenceId:'quote:100',authority:'QUOTE_RESEARCH_ONLY' as const,canExecute:false as const,
}
const item={
  persisted,quote:quoteEvidence,
  safety:(['LIQUIDITY','SELLABILITY','TOKEN_PERMISSIONS','HOLDER_INDEPENDENCE'] as const).map(proof),
}
const make=(items:readonly typeof item[]= [item])=>buildMemePaperBatchFromPersistedShark({
  sourceBatchId:'stored:batch:100',items,
  informationCutoff:cutoff,maxEvidenceAgeMs:15000,
})
describe('MEME-WALLET persisted SHARK batch bridge',()=>{
  it('accepts persisted research envelopes as a paper-only immutable batch',()=>{
    const batch=make()
    expect(batch.canExecute).toBe(false)
    expect(batch.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(batch.candidates).toHaveLength(1)
    expect(batch.candidates[0]?.sellabilityVerified).toBe(true)
  })
  it('rejects unpersisted ingress, bad authority or mismatched token',()=>{
    for(const altered of [
      {...persisted,runtimeIngress:'PENDING'},
      {...persisted,authority:'TRADING_ONLY'},
      {...persisted,envelope:{...persisted.envelope,assessment:{...persisted.envelope.assessment,tokenAddress:quote}}},
    ]){
      expect(()=>make([{...item,persisted:altered as MemeAssessmentCycleResult}]))
        .toThrow(/MEME_PAPER_SHARK_PERSISTENCE_OR_AUTHORITY_INVALID/)
    }
  })
  it('does not permit duplicate candidates to double-count paper proposals',()=>{
    expect(()=>make([item,item])).toThrow(/MEME_PAPER_SHARK_DUPLICATE_ASSESSMENT/)
  })
})
