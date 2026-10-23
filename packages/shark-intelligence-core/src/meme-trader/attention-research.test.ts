import {describe,expect,it} from 'vitest'
import {assessPublicAttention} from './attention-research'
import type {PublicAttentionEvidence,AttentionConfiguration} from './attention-research'
import {reviewPositionWithPublicAttention} from './attention-position'
import {compareAttentionPaperPairs} from './attention-paper-evaluation'
import type {AttentionPaperPair} from './attention-paper-evaluation'

const MINT='So11111111111111111111111111111111111111112'
const COMPETITOR='11111111111111111111111111111112'
const config:AttentionConfiguration={
  priceMoveAlertBps:1500,competingMarketCapAlertUsd:500000,
  competingVolumeAlertUsd:100000,maxEvidenceAgeSeconds:3600,
}
const evidence=(override:Partial<PublicAttentionEvidence>={}):PublicAttentionEvidence=>({
  eventId:'e1',mint:MINT,publicOnly:true,source:'PUBLIC_NEWS',signal:'ARTICLE',
  claimId:'claim:abc',sourceUrl:'https://news.example.com/article',
  providerReceiptId:'public-reader:100',
  eventAt:'2026-10-23T17:55:00.000Z',observedAt:'2026-10-23T17:56:00.000Z',
  availableAt:'2026-10-23T17:57:00.000Z',...override,
})
const evaluate=(observations:readonly PublicAttentionEvidence[])=>assessPublicAttention({
  mint:MINT,informationCutoff:'2026-10-23T18:00:00.000Z',config,observations,
})
describe('SHARK-ATTENTION.01-.03 + .05',()=>{
  it('keeps catalysts as public host claims, not independently verified news',()=>{
    const r=evaluate([
      evidence(),evidence({eventId:'e2',sourceUrl:'https://media.example.org/report'}),
    ])
    expect(r.catalysts).toHaveLength(1)
    expect(r.catalysts[0].state).toBe('MULTI_HOST_REPORTED')
    expect(r.catalysts[0].distinctPublicHosts).toBe(2)
    expect(r.evidenceVerification).toBe('PUBLIC_SOURCE_CLAIMS_NOT_INDEPENDENTLY_ATTESTED')
    expect(r.canExecute).toBe(false)
    expect(r.canNotify).toBe(false)
  })
  it('degrades thesis signals on an explicit reported retraction',()=>{
    const r=evaluate([evidence({signal:'CLAIM_RETRACTED'})])
    expect(r.catalysts[0].state).toBe('RETRACTED')
    expect(r.riskSignals.narrativeDegradationScore).toBe(.9)
    expect(r.alerts[0].code).toBe('NARRATIVE_RETRACTED')
  })
  it('provides report-only competition alerts with configurable volume and cap',()=>{
    const create=(id:string,cap:number,volume:number):PublicAttentionEvidence=>evidence({
      eventId:id,signal:'COMPETING_CONTRACT',source:'PUBLIC_MARKET',
      competingMint:COMPETITOR,competitorMarketCapUsd:cap,competitorVolumeUsd:volume,
      sourceUrl:'https://market.example.com/pair',
    })
    const r=evaluate([create('low',600000,5000),create('high',700000,200000)])
    expect(r.competingContracts).toHaveLength(1)
    expect(r.competingContracts[0].status).toBe('UNVERIFIED_MARKET_REPORT')
    expect(r.alerts.filter(a=>a.code==='CONTRACT_COMPETITION')).toHaveLength(1)
  })
  it('records actual two-snapshot view changes without claiming a universal virality score',()=>{
    const a=evidence({source:'PUBLIC_SOCIAL',signal:'SOCIAL_METRIC',eventId:'m1',
      sourceItemId:'post-100',views:100,sourceUrl:'https://social.example.com/p/1'})
    const b=evidence({source:'PUBLIC_SOCIAL',signal:'SOCIAL_METRIC',eventId:'m2',
      sourceItemId:'post-100',views:400,sourceUrl:'https://social.example.com/p/1',
      availableAt:'2026-10-23T17:59:00.000Z'})
    const r=evaluate([a,b])
    expect(r.viewChanges).toEqual([{sourceItemId:'post-100',earlierViews:100,
      laterViews:400,elapsedSeconds:120}])
  })
  it('alerts on price moves and on-chain distribution without financial authority',()=>{
    const r=evaluate([
      evidence({eventId:'price',signal:'PRICE_MOVE',source:'PUBLIC_MARKET',
        priceMoveBps:-1800,sourceUrl:'https://market.example.com/pair'}),
      evidence({eventId:'whale',signal:'WHALE_SELL',source:'PUBLIC_ONCHAIN',severityScore:.92,
        sourceUrl:'https://solscan.io/tx/123'}),
    ])
    expect(r.alerts.map(a=>a.code)).toContain('PRICE_SWING')
    expect(r.alerts.map(a=>a.code)).toContain('ONCHAIN_DISTRIBUTION')
    expect(r.riskSignals.whaleDistributionScore).toBe(.92)
    expect(r.alerts.every(a=>a.canExecute===false&&a.researchOnly===true)).toBe(true)
  })
  it('denies Telegram, private body text, stale/future timestamps and duplicate receipts',()=>{
    expect(()=>evaluate([evidence({source:'TELEGRAM' as PublicAttentionEvidence['source']})])).toThrow('ATTENTION_FORBIDDEN_SOURCE')
    expect(()=>evaluate([{...evidence(),rawText:'private-message'} as PublicAttentionEvidence])).toThrow('ATTENTION_UNKNOWN_OR_PRIVATE_FIELDS')
    expect(()=>evaluate([evidence({availableAt:'2026-10-23T18:01:00.000Z'})])).toThrow('ATTENTION_LATE_STALE_OR_FUTURE_EVIDENCE')
    expect(()=>evaluate([evidence(),evidence()])).toThrow('ATTENTION_CROSS_MINT_OR_DUPLICATE')
    expect(()=>evaluate([evidence({sourceUrl:'http://127.0.0.1/private'})])).toThrow('ATTENTION_NONPUBLIC_URL')
  })
  it('rejects mismatched contract identities and impossible evidence',()=>{
    expect(()=>evaluate([evidence({mint:COMPETITOR})])).toThrow('ATTENTION_CROSS_MINT_OR_DUPLICATE')
    expect(()=>evaluate([evidence({eventAt:'2026-10-23T18:00:00.000Z'})])).toThrow('ATTENTION_LATE_STALE_OR_FUTURE_EVIDENCE')
    expect(()=>evaluate([evidence({signal:'COMPETING_CONTRACT',source:'PUBLIC_MARKET',
      competingMint:MINT,competitorMarketCapUsd:500000,competitorVolumeUsd:100000})])).toThrow('ATTENTION_COMPETITOR_INVALID')
  })
})

describe('SHARK-ATTENTION.04',()=>{
  const position={
    entryPrice:1,currentPrice:1.35,peakPrice:1.4,liquidityUsd:500000,
    momentumScore:.82,distributionScore:.15,riskScore:.25,thesisStrength:.9,
    secondsSinceEntry:90,incrementalEdgeBps:900,correlationRiskBps:2500,
  }
  it('uses canonical SHARK position review and only adds downside risk',()=>{
    const r=reviewPositionWithPublicAttention({
      position,attention:{mint:MINT,informationCutoff:'2026-10-23T18:00:00.000Z',config,
        observations:[evidence({source:'PUBLIC_ONCHAIN',signal:'WHALE_SELL',
          severityScore:.95,sourceUrl:'https://solscan.io/tx/abc'})]},
    })
    expect(r.positionReview.action).toBe('EXIT')
    expect(r.positionReview.requiresMoneyCoreReview).toBe(true)
    expect(r.positionReview.canExecute).toBe(false)
    expect(r.riskOverlay).toBe('NEGATIVE_EVIDENCE_ONLY')
  })
  it('empty research does not add unsupported risk or remove existing risk',()=>{
    const r=reviewPositionWithPublicAttention({position:{...position,whaleDistributionScore:.91},
      attention:{mint:MINT,informationCutoff:'2026-10-23T18:00:00.000Z',config,observations:[]}})
    expect(r.positionReview.action).toBe('EXIT')
    expect(r.report.alerts).toEqual([])
  })
})

describe('SHARK-ATTENTION.06',()=>{
  const row=(override:Partial<AttentionPaperPair>={}):AttentionPaperPair=>({
    caseId:'case-1',subjectMint:MINT,
    decisionAt:'2026-10-23T18:00:00.000Z',
    featureAvailableAt:'2026-10-23T17:59:00.000Z',
    outcomeObservedAt:'2026-10-24T18:00:00.000Z',evidenceIds:['e1'],
    baselineNetReturnBps:0,attentionNetReturnBps:100,
    netReturnBasis:'HYPOTHETICAL_PAPER_COST_ASSUMPTIONS',...override,
  })
  it('produces paired descriptive differences but never claims executable performance',()=>{
    const r=compareAttentionPaperPairs([row(),row({caseId:'case-2',
      baselineNetReturnBps:200,attentionNetReturnBps:300})])
    expect(r.sampleCount).toBe(2)
    expect(r.averageDeltaBps).toBe(100)
    expect(r.attentionBetterFraction).toBe(1)
    expect(r.independentlyValidated).toBe(false)
    expect(r.canPromoteStrategy).toBe(false)
    expect(r.canExecute).toBe(false)
  })
  it('rejects hindsight research, duplicated cases and invented fill authority',()=>{
    expect(()=>compareAttentionPaperPairs([row({featureAvailableAt:'2026-10-23T18:01:00.000Z'})])).toThrow('ATTENTION_PAPER_LOOKAHEAD')
    expect(()=>compareAttentionPaperPairs([row(),row()])).toThrow('ATTENTION_PAPER_CASE_INVALID')
    expect(()=>compareAttentionPaperPairs([row({netReturnBasis:'ACTUAL_FILLED' as AttentionPaperPair['netReturnBasis']})])).toThrow('ATTENTION_PAPER_CASE_INVALID')
  })
  it('gives empty samples no fabricated result',()=>{
    const r=compareAttentionPaperPairs([])
    expect(r.averageDeltaBps).toBeNull()
    expect(r.verdict).toBe('NO_SAMPLES')
  })
})
