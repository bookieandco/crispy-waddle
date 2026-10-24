import {describe,it,expect,vi} from 'vitest'
import {normalizePublicDexSnapshot,readPublicDexSnapshot,deriveDexPriceMove} from './attention-public-dex'
import {evaluateAttentionLivePaperCycle} from './attention-live-paper-cycle'
import {gradeProspectiveAttentionPaper} from './attention-prospective-paper'
import type {ProspectiveAttentionCase} from './attention-prospective-paper'

const mint='So11111111111111111111111111111111111111112'
const pair='11111111111111111111111111111112'
const otherPair='11111111111111111111111111111113'
const config={priceMoveAlertBps:1500,competingMarketCapAlertUsd:500000,
  competingVolumeAlertUsd:100000,maxEvidenceAgeSeconds:900}
const pairData=(price='1',address=pair,token=mint)=>({
  chainId:'solana',pairAddress:address,baseToken:{address:token},
  liquidity:{usd:55000},priceUsd:price,volume:{h24:25000},
  txns:{h24:{buys:20,sells:4}},
})
const getSnap=(at:string,price='1',pairAddress=pair)=>
  normalizePublicDexSnapshot({mint,pairs:[pairData(price,pairAddress)],observedAt:at})
const before=getSnap('2026-10-23T17:50:00.000Z')
const after=getSnap('2026-10-23T18:00:00.000Z','1.20')

describe('SHARK-ATTENTION.LIVE-PAPER.07 public fixed-host adapter',()=>{
  it('only calls the exact keyless public token-pairs endpoint',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify([pairData()]),{
      status:200,headers:{'content-type':'application/json'},
    })) as unknown as typeof fetch
    const snap=await readPublicDexSnapshot({mint,request:fetcher,clock:()=>after.observedAt})
    expect(snap.mint).toBe(mint)
    expect(snap.sourceAuthenticated).toBe(false)
    expect(snap.canTrade).toBe(false)
    const [url,opts]=vi.mocked(fetcher).mock.calls[0]
    expect(url).toBe('https://api.dexscreener.com/token-pairs/v1/solana/'+mint)
    expect(opts?.method).toBe('GET')
    expect(opts?.redirect).toBe('error')
    expect(opts?.headers).toEqual({Accept:'application/json'})
  })
  it('rejects oversized replies, malformed pool metadata and off-curve tokens',async()=>{
    const big=(async()=>new Response('[]',{headers:{'content-length':'262145'}})) as typeof fetch
    await expect(readPublicDexSnapshot({mint,request:big,clock:()=>after.observedAt}))
      .rejects.toThrow('ATTENTION_DEX_BODY_TOO_LARGE')
    expect(()=>normalizePublicDexSnapshot({mint,pairs:[pairData('1',pair,'wrong')],
      observedAt:after.observedAt})).toThrow('ATTENTION_DEX_NO_VALID_BASE_PAIR')
    expect(()=>normalizePublicDexSnapshot({mint,pairs:[pairData('1','invalid')],
      observedAt:after.observedAt})).toThrow('ATTENTION_DEX_PAIR_ID_INVALID')
  })
  it('selects the same token BASE with deterministic liquidity priority',()=>{
    const smaller={...pairData(),liquidity:{usd:100}}
    const high={...pairData('1.2',otherPair),liquidity:{usd:80000}}
    const r=normalizePublicDexSnapshot({mint,pairs:[smaller,high],observedAt:after.observedAt})
    expect(r.pairAddress).toBe(otherPair)
  })
  it('derives sequential same-pair price moves without an executable quote',()=>{
    const e=deriveDexPriceMove(before,after)!
    expect(e.signal).toBe('PRICE_MOVE')
    expect(e.priceMoveBps).toBeCloseTo(2000)
    expect(e.sourceUrl).toBe('https://dexscreener.com/solana/'+pair)
    expect(()=>deriveDexPriceMove(before,getSnap(after.observedAt,'1.1',otherPair)))
      .toThrow('ATTENTION_DEX_POOL_MISMATCH')
  })
})

describe('SHARK-ATTENTION.LIVE-PAPER.08 bounded source-only cycle',()=>{
  it('first observation has no invented momentum; next can alert but never execute',()=>{
    const first=evaluateAttentionLivePaperCycle({current:before,config})
    expect(first.disposition).toBe('FIRST_OBSERVATION_NO_SIGNAL')
    expect(first.alerts).toHaveLength(0)
    const second=evaluateAttentionLivePaperCycle({previous:before,current:after,config})
    expect(second.disposition).toBe('PRICE_COMPARISON_RESEARCH_ONLY')
    expect(second.alerts[0].code).toBe('PRICE_SWING')
    expect(second.orderCount).toBe(0)
    expect(second.signedTransactionCount).toBe(0)
    expect(second.canNotify).toBe(false)
    expect(second.canTrade).toBe(false)
  })
  it('stale previous or pool switch becomes NO_SIGNAL',()=>{
    const stale=evaluateAttentionLivePaperCycle({
      previous:getSnap('2026-10-23T17:00:00.000Z'),
      current:after,config,
    })
    expect(stale.disposition).toBe('STALE_OR_INCOMPARABLE_NO_SIGNAL')
    expect(stale.alerts).toHaveLength(0)
    expect(()=>evaluateAttentionLivePaperCycle({
      previous:before,current:{...after,mint:pair},config,
    })).toThrow('ATTENTION_CYCLE_CROSS_MINT')
  })
})

const row=(overrides:Partial<ProspectiveAttentionCase>={}):ProspectiveAttentionCase=>({
  caseId:'case-1',mint,pairAddress:pair,
  decisionAt:'2026-10-23T18:00:00.000Z',
  featureAvailableAt:'2026-10-23T17:59:00.000Z',
  entryObservedAt:'2026-10-23T17:58:00.000Z',
  entryPriceUsd:1,entryReceiptId:'receipt:entry:1',
  baselineDecision:'PAPER_ENTER',attentionDecision:'NO_TRADE',
  assumedRoundTripCostBps:200,
  mark:{pairAddress:pair,observedAt:'2026-10-24T19:00:00.000Z',
    availableAt:'2026-10-24T19:01:00.000Z',priceUsd:.8,publicReceiptId:'receipt:mark:1'},
  ...overrides,
})
describe('SHARK-ATTENTION.LIVE-PAPER.10 prospective outcomes',()=>{
  it('compares policy decisions on the same eligible price mark with assumed costs',()=>{
    const r=gradeProspectiveAttentionPaper([row()])
    expect(r.marked).toBe(1)
    expect(r.censored).toBe(0)
    expect(r.coverage).toBe(1)
    expect(r.paired.averageBaselineNetBps).toBe(-2200)
    expect(r.paired.averageAttentionNetBps).toBe(0)
    expect(r.paired.averageDeltaBps).toBe(2200)
    expect(r.independentlyValidated).toBe(false)
    expect(r.observedFillCount).toBe(0)
  })
  it('censors missing, late and mismatched-pair marks rather than backfilling',()=>{
    const r=gradeProspectiveAttentionPaper([
      row({caseId:'missing',mark:null}),
      row({caseId:'wrong-pair',mark:{...row().mark!,pairAddress:otherPair}}),
      row({caseId:'late',mark:{...row().mark!,
        observedAt:'2026-10-26T19:00:00.000Z',availableAt:'2026-10-26T19:01:00.000Z'}}),
    ])
    expect(r.considered).toBe(3)
    expect(r.marked).toBe(0)
    expect(r.censored).toBe(3)
    expect(r.paired.averageDeltaBps).toBeNull()
    expect(r.coverage).toBe(0)
  })
  it('rejects impossible timeline, costs, duplicates and unverified proposed fills',()=>{
    expect(()=>gradeProspectiveAttentionPaper([row({featureAvailableAt:'2026-10-23T18:01:00.000Z'})]))
      .toThrow('ATTENTION_PROSPECTIVE_HINDSIGHT_INVALID')
    expect(()=>gradeProspectiveAttentionPaper([row(),row()]))
      .toThrow('ATTENTION_PROSPECTIVE_CASE_INVALID')
    expect(()=>gradeProspectiveAttentionPaper([row({assumedRoundTripCostBps:-2})]))
      .toThrow('ATTENTION_PROSPECTIVE_CASE_INVALID')
    expect(()=>gradeProspectiveAttentionPaper([row({mark:{...row().mark!,
      availableAt:'2026-10-24T18:30:00.000Z'}})])
      ).toThrow('ATTENTION_PROSPECTIVE_MARK_TIME_INVALID')
  })
})
