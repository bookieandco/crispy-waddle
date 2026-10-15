import { describe,it,expect } from 'vitest'
import type { MemeTradeAssessment } from '@jhadina/shark-intelligence-core/meme-trader'
import { mapSharkAssessmentToMemePaper,type MemePaperSafetyReceipt } from './meme-wallet-paper-adapter'

const token='So11111111111111111111111111111111111111112'
const quote='11111111111111111111111111111111'
const cutoff='2026-10-14T19:00:10.000Z'
const assessment={
  assessmentId:'a-persisted-100',assessedAt:'2026-10-14T19:00:01.000Z',
  token:{chainId:'solana-mainnet',tokenAddress:token},
  riskAssessment:{overallRisk:0.11,band:'candidate'},
  rugProtection:{disposition:'ALLOW_CANDIDATE',evidenceIds:['shark:rug:1'],hardBlockers:[],warnings:[]},
  rugSelfProtection:{action:'ALLOW_PAPER_STUDY',missingCriticalCoverage:[],evidenceIds:['shark:coverage:1']},
  evidenceIds:['shark:assessment:1'],
} as unknown as MemeTradeAssessment
const safety=(check:MemePaperSafetyReceipt['check']):MemePaperSafetyReceipt=>({
  check,tokenMint:token,verified:true,sourceId:'onchain-verifier:'+check,
  sourceGroup:'chain-checks',evidenceId:'proof:'+check,
  observedAt:'2026-10-14T19:00:02.000Z',
  availableAt:'2026-10-14T19:00:03.000Z',
  authority:'CHAIN_RESEARCH_EVIDENCE_ONLY',canAuthorizeTrade:false,
})
const checks=['LIQUIDITY','SELLABILITY','TOKEN_PERMISSIONS','HOLDER_INDEPENDENCE'] as const
const args={
  assessment,strategyId:'JHADINA_SHARK_SNIPER_PAPER_V1',
  quote:{
    quoteMint:quote,receivedAt:'2026-10-14T19:00:04.000Z',
    expectedSlippageBps:80,totalCostsMinor:20n,
    sourceId:'research-quote',evidenceId:'quote:receipt:1',
    authority:'QUOTE_RESEARCH_ONLY' as const,canExecute:false as const,
  },
  safety:checks.map(safety),cutoff,maxEvidenceAgeMs:20_000,
}
describe('canonical SHARK assessment paper mapping',()=>{
  it('never infers verified safety from favorable SHARK score',()=>{
    const missing=mapSharkAssessmentToMemePaper({...args,safety:[]})
    expect(missing.sellabilityVerified).toBe(false)
    expect(missing.liquidityVerified).toBe(false)
    expect(missing.tokenPermissionsSafe).toBe(false)
    expect(missing.holderConcentrationSafe).toBe(false)
    expect(missing.canAuthorizeTrade).toBe(false)
    const full=mapSharkAssessmentToMemePaper(args)
    expect(full.sellabilityVerified).toBe(true)
    expect(full.liquidityVerified).toBe(true)
    expect(full.authority).toBe('SHARK_RESEARCH_ONLY')
  })
  it('rejects missing, mismatched, duplicate or stale safety receipts',()=>{
    const wrong=mapSharkAssessmentToMemePaper({...args,safety:[
      ...checks.filter(x=>x!=='SELLABILITY').map(safety),
      {...safety('SELLABILITY'),tokenMint:quote},
    ]})
    expect(wrong.sellabilityVerified).toBe(false)
    const duplicate=mapSharkAssessmentToMemePaper({...args,safety:[...checks.map(safety),safety('SELLABILITY')]})
    expect(duplicate.sellabilityVerified).toBe(false)
    const stale=mapSharkAssessmentToMemePaper({...args,safety:[
      ...checks.filter(x=>x!=='LIQUIDITY').map(safety),
      {...safety('LIQUIDITY'),availableAt:'2026-10-14T18:00:00.000Z'},
    ]})
    expect(stale.liquidityVerified).toBe(false)
  })
  it('rug veto supersedes positive receipts; missing critical coverage still blocks',()=>{
    const rug=mapSharkAssessmentToMemePaper({...args,assessment:{
      ...assessment,rugProtection:{...assessment.rugProtection,disposition:'BLOCK'},
    } as MemeTradeAssessment})
    expect(rug.rugVeto).toBe(true)
    const noCoverage=mapSharkAssessmentToMemePaper({...args,assessment:{
      ...assessment,rugSelfProtection:undefined,
    }})
    expect(noCoverage.rugVeto).toBe(true)
    const caution=mapSharkAssessmentToMemePaper({...args,assessment:{
      ...assessment,rugSelfProtection:{...assessment.rugSelfProtection!,action:'CAUTION'},
    }})
    expect(caution.rugVeto).toBe(true)
  })
  it('rejects lookahead assessments and stale research quotes',()=>{
    expect(()=>mapSharkAssessmentToMemePaper({...args,quote:{
      ...args.quote,receivedAt:'2026-10-15T19:00:10Z',
    }})).toThrow(/MEME_SHARK_BRIDGE_QUOTE_UNAVAILABLE/)
    expect(()=>mapSharkAssessmentToMemePaper({...args,assessment:{
      ...assessment,assessedAt:'2026-10-15T20:00:00Z',
    }})).toThrow(/MEME_SHARK_BRIDGE_FUTURE_ASSESSMENT/)
  })
})
