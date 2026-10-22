import {describe,expect,it} from 'vitest'
import {
  reconcileSharkFilterBranches,auditSharkReadOnlyHost,assessRugMechanism,
  summarizeSharkPaperCohort,auditSharkLatency,finalizeSharkFilterAcceptance,
} from '../shark-filter-acceptance-15-20'
import {measureSharkFilterLatency} from '../shark-filter-execution-research'

describe('SHARK-FILTER.ACCEPT.15–.20 — bounded evidence only',()=>{
  it('.15 preserves diverged and overlapping PRs for selective recovery',()=>{
    const x=reconcileSharkFilterBranches({canonicalChangedPaths:['src/index.ts'],
      branches:[{pr:1410,branch:'old',baseSha:'abc',headSha:'def',ahead:14,behind:86,
        overlappingPaths:['src/index.ts']},
        {pr:1455,branch:'new',baseSha:'abc',headSha:'xyz',ahead:1,behind:0,
          overlappingPaths:[]}]})
    expect(x[0]?.admission).toBe('PRESERVE_PENDING_REBASE')
    expect(x[1]?.admission).toBe('REVIEW_CLEAN_INTEGRATION')
  })
  it('.16 denies missing real host, alerts and encrypted restore evidence',()=>{
    const out=auditSharkReadOnlyHost()
    expect(out.disposition).toBe('UNCOMMISSIONED')
    expect(out.canDeploy).toBe(false)
    expect(out.blockers).toContain('persistent-ledger-not-verified')
  })
  it('.17 keeps one-source suspicions UNKNOWN rather than confirmed rugs',()=>{
    const item={mint:'mint1',mechanism:'LIQUIDITY_REMOVAL' as const,
      confirmations:['event-1'],independentSourceGroups:['rpc-a'],
      observedAt:'2026-10-20T20:00:00Z',availableAt:'2026-10-20T20:01:00Z'}
    expect(assessRugMechanism(item).mechanism).toBe('UNKNOWN')
    const evidence=assessRugMechanism({...item,independentSourceGroups:['rpc-a','rpc-b']})
    expect(evidence.status).toBe('MECHANISM_EVIDENCED')
    expect(evidence.canLabelConfirmedRug).toBe(false)
  })
  it('.18 never scores price-only snapshots as executed profitable trades',()=>{
    const result=summarizeSharkPaperCohort({canaries:[],priceMarks:[],routeReviews:[]})
    expect(result.moneyCoreFilled).toBe(0)
    expect(result.realizedProfitVerified).toBe(false)
    expect(result.cannotClaimWinRate).toBe(true)
  })
  it('.19 distinguishes event-to-screen time from certified fills',()=>{
    const latency=measureSharkFilterLatency({traceId:'real-receipts',origin:'REAL_PROVIDER_RECEIPTS',
      evidenceIds:['e1'],occurredAt:{
        eventVisible:'2026-10-20T20:00:00.000Z',
        screened:'2026-10-20T20:00:00.616Z',
      }})
    const result=auditSharkLatency([latency])
    expect(result.eventToScreenMedianMs).toBe(616)
    expect(result.certifiedEndToEndCount).toBe(0)
    expect(result.endToEndLatencyCertified).toBe(false)
  })
  it('.20 rejects green CI as proof of operational commissioning',()=>{
    const result=finalizeSharkFilterAcceptance({
      exactHeadCiPassed:true,branchesReconciled:false,
      readOnlyHost:auditSharkReadOnlyHost(),
      independentlyVerifiedFees:false,independentSellability:false,
      prospectiveHoldoutLabeled:false,independentMoneyCoreReview:false,
    })
    expect(result.status).toBe('EXTERNAL_ACCEPTANCE_BLOCKED')
    expect(result.signingAllowed).toBe(false)
    expect(result.spendingAllowed).toBe(false)
    expect(result.liveTradingAllowed).toBe(false)
    expect(result.missing).toContain('stale-pr-reconciliation-pending')
  })
})
