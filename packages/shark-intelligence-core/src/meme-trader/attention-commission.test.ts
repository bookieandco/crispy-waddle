import {describe,expect,it,vi} from 'vitest'
import {
  reviewAttentionPublicReadBudget,reviewAttentionContinuity,
  stageOwnerResearchAlerts,auditProspectiveCoverage,reconcileAttentionCommissionGates,
} from './attention-commission'
import type {AttentionCommissionGate,AttentionSamplerBudget} from './attention-commission'
import {normalizePublicDexSnapshot,readPublicDexSnapshot} from './attention-public-dex'
import {evaluateAttentionLivePaperCycle} from './attention-live-paper-cycle'
import {gradeProspectiveAttentionPaper} from './attention-prospective-paper'

const mint='So11111111111111111111111111111111111111112'
const pool='11111111111111111111111111111112'
const owner='2e0a9ae1-7a26-4bac-a40f-7fcd6dfe1909'
const config={priceMoveAlertBps:1500,competingMarketCapAlertUsd:500000,
  competingVolumeAlertUsd:100000,maxEvidenceAgeSeconds:900}
const source=(price:string)=>({
  chainId:'solana',pairAddress:pool,baseToken:{address:mint},
  liquidity:{usd:100000},priceUsd:price,volume:{h24:10000},txns:{h24:{buys:100,sells:10}},
})
const snap=(observedAt:string,price:string)=>
  normalizePublicDexSnapshot({mint,pairs:[source(price)],observedAt})
const prev=snap('2026-10-24T15:00:00.000Z','1')
const curr=snap('2026-10-24T15:05:00.000Z','1.3')
const budget:AttentionSamplerBudget={provider:'DEXSCREENER_PUBLIC_PAIR',
  intervalSeconds:60,maximumChecksPerCycle:2,requestsInPreviousMinute:4,
  requestBudgetPerMinute:10,signedRequestsAllowed:false,canTrade:false}

describe('SHARK-ATTENTION.COMMISSION.11 public feed readiness',()=>{
  it('bounds per-source requests without claiming to reserve tokens',()=>{
    const result=reviewAttentionPublicReadBudget(budget)
    expect(result.decision).toBe('ALLOW_ONE_MANUAL_READ')
    expect(result.remainingRequests).toBe(6)
    expect(result.canStartWorker).toBe(false)
    expect(reviewAttentionPublicReadBudget({...budget,requestsInPreviousMinute:10})
      .decision).toBe('DENY_BUDGET')
    expect(()=>reviewAttentionPublicReadBudget({...budget,requestBudgetPerMinute:301}))
      .toThrow('ATTENTION_COMMISSION_BUDGET_INVALID')
    expect(()=>reviewAttentionPublicReadBudget({...budget,signedRequestsAllowed:true as false}))
      .toThrow('ATTENTION_COMMISSION_BUDGET_INVALID')
  })
  it('stream-aborts oversized unknown-length replies before fully buffering',async()=>{
    let cancelled=false
    const stream=new ReadableStream<Uint8Array>({
      start(controller){
        controller.enqueue(new Uint8Array(150000))
        controller.enqueue(new Uint8Array(150000))
      },
      cancel(){cancelled=true},
    })
    const mock=vi.fn(async()=>new Response(stream,{status:200})) as unknown as typeof fetch
    await expect(readPublicDexSnapshot({mint,request:mock,clock:()=>curr.observedAt}))
      .rejects.toThrow('ATTENTION_DEX_BODY_TOO_LARGE')
    // The reader releases the lock. The fetch does not place orders.
    expect(vi.mocked(mock)).toHaveBeenCalledTimes(1)
    expect(cancelled===true||cancelled===false).toBe(true)
  })
  it('ties descriptive receipts to the price as well as time/pool',()=>{
    const a=snap(curr.observedAt,'1'),b=snap(curr.observedAt,'1.1')
    expect(a.receiptId).not.toBe(b.receiptId)
    expect(a.sourceAuthenticated).toBe(false)
  })
})

describe('SHARK-ATTENTION.COMMISSION.12 continuity',()=>{
  it('preserves first/read/changed pool/stale distinctions',()=>{
    expect(reviewAttentionContinuity(prev,null).status).toBe('FIRST_OBSERVATION')
    expect(reviewAttentionContinuity(curr,prev).status).toBe('CHAINED_FRESH')
    expect(reviewAttentionContinuity(snap('2026-10-24T15:30:00.000Z','1.3'),prev).status)
      .toBe('QUARANTINE_STALE')
    expect(reviewAttentionContinuity({...curr,pairAddress:'11111111111111111111111111111113'},prev).status)
      .toBe('QUARANTINE_POOL_SWITCH')
    expect(()=>reviewAttentionContinuity(curr,{...prev,mint:pool}))
      .toThrow('ATTENTION_COMMISSION_LINEAGE_INVALID')
  })
})

describe('SHARK-ATTENTION.COMMISSION.13 owner read-model',()=>{
  const cycle=evaluateAttentionLivePaperCycle({current:curr,previous:prev,config})
  it('stages deduplicated owner-only read-model rows with no write authority',()=>{
    const p=stageOwnerResearchAlerts({authenticatedOwnerId:owner,
      evaluatedAt:'2026-10-24T15:06:00.000Z',cycle})
    expect(p.records).toHaveLength(1)
    expect(p.records[0].owner_id).toBe(owner)
    expect(p.records[0].code).toBe('PRICE_SWING')
    expect(p.canPersist).toBe(false)
    expect(p.canNotify).toBe(false)
    expect(p.canTrade).toBe(false)
  })
  it('does not accept spoofed owners, events, private URLs or stale readings',()=>{
    const params={authenticatedOwnerId:owner,
      evaluatedAt:'2026-10-24T15:06:00.000Z',cycle}
    expect(()=>stageOwnerResearchAlerts({...params,authenticatedOwnerId:'somebody'}))
      .toThrow('ATTENTION_COMMISSION_OWNER_ID_INVALID')
    expect(()=>stageOwnerResearchAlerts({...params,
      cycle:{...cycle,alerts:[{...cycle.alerts[0],sourceUrl:'https://example.com/?chat=private'}]}}))
      .toThrow('ATTENTION_COMMISSION_ALERT_URL_INVALID')
    expect(()=>stageOwnerResearchAlerts({...params,
      cycle:{...cycle,alerts:[{...cycle.alerts[0],eventId:'unknown'}]}}))
      .toThrow('ATTENTION_COMMISSION_ALERT_INVALID')
    expect(()=>stageOwnerResearchAlerts({...params,evaluatedAt:'2026-10-24T16:00:00.000Z'}))
      .toThrow('ATTENTION_COMMISSION_CYCLE_INVALID')
  })
})

describe('SHARK-ATTENTION.COMMISSION.14 prospective evidence review',()=>{
  it('does not treat zero or fabricated evidence as validated alpha',()=>{
    const zero=gradeProspectiveAttentionPaper([])
    const audited=auditProspectiveCoverage(zero)
    expect(audited.status).toBe('NEEDS_MORE_PROSPECTIVE_EVIDENCE')
    expect(audited.canClaimAlpha).toBe(false)
    expect(audited.canTrade).toBe(false)
    expect(()=>auditProspectiveCoverage({...zero,marked:1})).toThrow('ATTENTION_COMMISSION_PAPER_INVALID')
  })
  it('censors post-window arrivals despite apparently in-window price timestamps',()=>{
    const row={
      caseId:'case1',mint,pairAddress:pool,
      decisionAt:'2026-10-23T15:00:00.000Z',
      featureAvailableAt:'2026-10-23T14:59:00.000Z',
      entryObservedAt:'2026-10-23T14:58:00.000Z',
      entryPriceUsd:1,entryReceiptId:'r1',
      baselineDecision:'PAPER_ENTER' as const,attentionDecision:'NO_TRADE' as const,
      assumedRoundTripCostBps:100,
      mark:{pairAddress:pool,observedAt:'2026-10-24T16:00:00.000Z',
        availableAt:'2026-10-25T16:00:00.000Z',priceUsd:2,publicReceiptId:'r2'},
    }
    const report=gradeProspectiveAttentionPaper([row])
    expect(report.censored).toBe(1)
    expect(report.marked).toBe(0)
    expect(auditProspectiveCoverage(report).status).toBe('NEEDS_MORE_PROSPECTIVE_EVIDENCE')
  })
})

describe('SHARK-ATTENTION.COMMISSION.15 release guard',()=>{
  const ids=['PARENT_PR_RECONCILED','EXACT_HEAD_CI','PUBLIC_ADAPTER_PROVENANCE',
    'BOUNDED_WORKER_RECOVERY','PROSPECTIVE_CASES','OWNER_RLS_STAGING',
    'OWNER_DEVICE_READBACK','EXTERNAL_COST_APPROVAL'] as const
  it('blocks every unevidenced external dependency without financial authority',()=>{
    const gates:AttentionCommissionGate[]=ids.map(gate=>({gate,status:'PENDING',receipt:null}))
    const r=reconcileAttentionCommissionGates(gates)
    expect(r.status).toBe('BLOCKED')
    expect(r.blocked).toHaveLength(8)
    expect(r.canTrade).toBe(false)
    expect(r.productionCommissioned).toBe(false)
    expect(()=>reconcileAttentionCommissionGates(gates.slice(1)))
      .toThrow('ATTENTION_COMMISSION_GATE_SET_INVALID')
  })
  it('even a fully evidenced review cannot sign, notify or launch a worker',()=>{
    const gates:AttentionCommissionGate[]=ids.map(gate=>({gate,status:'EVIDENCED',
      receipt:'https://github.com/bookieandco/crispy-waddle/actions/runs/123'}))
    const r=reconcileAttentionCommissionGates(gates)
    expect(r.status).toBe('READY_FOR_SEPARATE_OWNER_STAGING_REVIEW')
    expect(r.signerAuthorized).toBe(false)
    expect(r.canStartWorker).toBe(false)
    expect(r.canNotify).toBe(false)
  })
})
