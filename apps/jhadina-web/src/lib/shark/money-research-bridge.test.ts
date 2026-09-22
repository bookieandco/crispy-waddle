import { describe, expect, it } from 'vitest'
import { createSharkMoneyResearchEnvelope } from './money-research-bridge'

const assessment:any={
  assessmentId:'a1',
  assessedAt:'2026-09-21T20:00:00Z',
  token:{chainId:'solana-mainnet',tokenAddress:'TOKEN1'},
  tradeType:'new-pair-speculation',
  marketActivityQuality:{score:.8},
  supplyControl:{score:.2},
  holderCohort:{score:.6},
  attention:{score:.7},
  strategyFit:{score:.7,matchedSignals:['flow'],conflicts:[]},
  riskAssessment:{overallRisk:.3,band:'candidate'},
  rugProtection:{disposition:'ALLOW'},
  thesis:'Independent market and chain evidence support review.',
  invalidation:{conditions:['liquidity collapses'],severity:'high'},
  positionPlan:{maxPositionFraction:.01,entryConditions:[],profitTakingConditions:[],exitConditions:[]},
  confidence:.7,
  evidenceIds:['dex:1','chain:1'],
  assessmentVersion:'meme-trader-assessment-v6-multi-venue-liquidity-control',
}

const evidence:any[]=[
  {evidenceId:'dex:1',source:'dexscreener',sourceGroup:'market-api',stance:'SUPPORTS',direction:'BULLISH',strength:.7,confidence:.8,observedAt:'2026-09-21T19:59:55Z',availableAt:'2026-09-21T19:59:56Z',summary:'Market flow.',immutable:true},
  {evidenceId:'chain:1',source:'helius',sourceGroup:'chain-rpc',stance:'CONTRADICTS',direction:'BEARISH',strength:.6,confidence:.9,observedAt:'2026-09-21T19:59:57Z',availableAt:'2026-09-21T19:59:59Z',summary:'Wallet distribution risk.',immutable:true},
]

describe('SHARK -> Money research envelope v02',()=>{
  it('uses the latest evidence availability time as the information cutoff',()=>{
    const env=createSharkMoneyResearchEnvelope({assessment,contextId:'ctx1',evidence})
    expect(env.schemaVersion).toBe('SHARK-MONEY-02')
    expect(env.assessment.informationCutoff).toBe('2026-09-21T19:59:59Z')
    expect(env.assessment.evidenceRefs.map(x=>x.sourceGroup)).toEqual(['market-api','chain-rpc'])
    expect(env.assessment.evidenceRefs.map(x=>x.stance)).toEqual(['SUPPORTS','CONTRADICTS'])
    expect(env.authority.financialExecution).toBe('NONE')
  })

  it('binds source independence and availability metadata into the envelope hash',()=>{
    const a=createSharkMoneyResearchEnvelope({assessment,contextId:'ctx1',evidence})
    const b=createSharkMoneyResearchEnvelope({assessment,contextId:'ctx1',evidence:[evidence[0],{...evidence[1],sourceGroup:'same-feed'}]})
    const d=createSharkMoneyResearchEnvelope({assessment,contextId:'ctx1',evidence:[evidence[0],{...evidence[1],availableAt:'2026-09-21T19:59:58Z'}]})
    expect(a.envelopeId).not.toBe(b.envelopeId)
    expect(a.envelopeId).not.toBe(d.envelopeId)
  })

  it('fails when canonical assessment evidence lacks transport metadata',()=>{
    expect(()=>createSharkMoneyResearchEnvelope({assessment,contextId:'ctx1',evidence:[evidence[0]]})).toThrow('SHARK_MONEY_EVIDENCE_METADATA_MISSING')
  })

  it('rejects duplicate metadata IDs instead of silently overwriting them',()=>{
    expect(()=>createSharkMoneyResearchEnvelope({assessment:{...assessment,evidenceIds:['dex:1']},contextId:'ctx1',evidence:[evidence[0],{...evidence[0]}]})).toThrow('SHARK_MONEY_DUPLICATE_EVIDENCE_METADATA')
  })
})
