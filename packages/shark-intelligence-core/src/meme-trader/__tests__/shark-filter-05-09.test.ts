import {describe,expect,it} from 'vitest'
import {adaptTerminalFeeSnapshot,attachDeclaredTerminalFee,summarizeChainFeeReceipts} from '../shark-fee-evidence'
import {evaluateSharkDiscoveryScreen} from '../stage-aware-discovery-screen'
import {composeScreenedSharkCandidate} from '../screened-shark-candidate'
import {scoreProspectiveFilterHoldout} from '../shark-filter-holdout'
import {estimateSharkShadowRoundTrip,measureSharkFilterLatency} from '../shark-filter-execution-research'
import {evaluateSharkFilterReviewGate,type SharkFilterAcceptanceEvidence} from '../shark-filter-release-gate'
import type {MemeTradeAssessment} from '../assessment'

const cutoff='2026-10-21T19:02:00Z'
const observation={
  chainId:'solana' as const,mint:'mintX',protocol:'pump',stage:'NEW_PAIR' as const,
  observedAt:'2026-10-21T19:00:00Z',availableAt:'2026-10-21T19:01:00Z',evaluatedAsOf:cutoff,
  volumeUsd:1500,socialLinksCount:1,evidenceIds:['mint-source'],
}
const fee={
  chainId:'solana' as const,mint:'mintX',terminal:'Axion',metricName:'GLOBAL_FEES_PAID' as const,
  metricDefinition:'Terminal-defined cumulative global fees within selected venue scope',
  currency:'SOL' as const,amount:.5,observedAt:'2026-10-21T19:01:00Z',
  availableAt:'2026-10-21T19:01:00Z',evidenceId:'terminal-fee',providerVersion:'axion-v1',
}
const screened=()=>evaluateSharkDiscoveryScreen(
  attachDeclaredTerminalFee(observation,adaptTerminalFeeSnapshot({mint:'mintX',
    snapshot:fee,cutoff:'2026-10-21T19:01:05Z'})),
  'VIDEO1_NEW_PAIR_SOL_V1',
)
const assessment=(overrides:Record<string,unknown>={})=>({
  token:{chainId:'solana',tokenAddress:'mintX'},
  assessmentId:'assessment-1',assessedAt:'2026-10-21T19:01:10Z',
  evidenceIds:['rug-proof'],
  rugProtection:{disposition:'ALLOW_CANDIDATE'},
  rugSelfProtection:{action:'ALLOW_PAPER_STUDY',missingCriticalCoverage:[]},
  riskAssessment:{band:'candidate'},
  ...overrides,
} as unknown as MemeTradeAssessment)

describe('SHARK-FILTER.05 fee-source receipts',()=>{
  it('keeps terminal fee definitions unverified and enforces provenance',()=>{
    const adapted=adaptTerminalFeeSnapshot({mint:'mintX',snapshot:fee,cutoff:'2026-10-21T19:01:05Z'})
    expect(adapted.status).toBe('DECLARED_UNVERIFIED')
    expect(adapted.canValidateRug).toBe(false)
    expect(screened().disposition).toBe('MATCH')
    expect(attachDeclaredTerminalFee(observation,adapted).evidenceIds).toContain('terminal-fee')
    expect(adaptTerminalFeeSnapshot({mint:'mintX',snapshot:{...fee,metricDefinition:''},cutoff})).toMatchObject({status:'UNAVAILABLE'})
    expect(()=>adaptTerminalFeeSnapshot({mint:'mintX',snapshot:fee,cutoff:'2026-10-21T18:00:00Z'})).toThrow('lookahead')
    expect(adaptTerminalFeeSnapshot({mint:'mintX',snapshot:fee,cutoff,maxAgeMs:5000}).status).toBe('UNAVAILABLE')
  })
  it('keeps chain RPC fee totals distinct and deduplicates signatures',()=>{
    const tx={signature:'sig',slot:1,feeLamports:5000,evidenceId:'tx1',rpcProvider:'public-rpc',
      observedAt:'2026-10-21T19:00:00Z',availableAt:'2026-10-21T19:01:00Z'}
    const result=summarizeChainFeeReceipts({receipts:[tx],cutoff})
    expect(result.networkFeesSol).toBe(.000005)
    expect(result.comparableToTerminalGlobalFees).toBe(false)
    expect(()=>summarizeChainFeeReceipts({receipts:[tx,tx],cutoff})).toThrow('duplicate_signature')
  })
})

describe('SHARK-FILTER.06 canonical research composition',()=>{
  it('requires full independent protection and never creates Money authority',()=>{
    const s=screened()
    const approved=composeScreenedSharkCandidate({screen:s,assessment:assessment(),
      informationCutoff:cutoff,assessmentAvailableAt:'2026-10-21T19:01:20Z'})
    expect(approved.disposition).toBe('WATCH_RESEARCH_ONLY')
    expect(approved.canAuthorizeTrade).toBe(false)
    expect(approved.canCallSigner).toBe(false)
    const blocked=composeScreenedSharkCandidate({screen:s,
      assessment:assessment({rugProtection:{disposition:'BLOCK'}}),
      informationCutoff:cutoff,assessmentAvailableAt:'2026-10-21T19:01:20Z'})
    expect(blocked.disposition).toBe('BLOCKED')
    const review=composeScreenedSharkCandidate({screen:s,informationCutoff:cutoff})
    expect(review.disposition).toBe('REVIEW')
    expect(()=>composeScreenedSharkCandidate({screen:s,assessment:assessment({
      token:{chainId:'solana',tokenAddress:'other'},
    }),informationCutoff:cutoff,assessmentAvailableAt:'2026-10-21T19:01:20Z'})).toThrow('mint_mismatch')
  })
})

describe('SHARK-FILTER.07 prospective holdout discipline',()=>{
  it('counts verified rug outcomes, false rejections and missed runners without imputing unknowns',()=>{
    const matched=screened()
    const failed=evaluateSharkDiscoveryScreen({...attachDeclaredTerminalFee(
      observation,adaptTerminalFeeSnapshot({mint:'mintX',snapshot:fee,cutoff:'2026-10-21T19:01:05Z'}),
    ),volumeUsd:5},'VIDEO1_NEW_PAIR_SOL_V1')
    const base={cohort:'HOLDOUT' as const,decisionAt:'2026-10-21T19:02:00Z',informationCutoff:cutoff}
    const later={observedAt:'2026-10-21T20:00:00Z',availableAt:'2026-10-21T20:01:00Z',
      evidenceIds:['outcome-a'],independentlyVerified:true}
    const r=scoreProspectiveFilterHoldout({
      presetId:'VIDEO1_NEW_PAIR_SOL_V1',splitFrozenAt:'2026-10-20T00:00:00Z',
      evaluatedAt:'2026-10-21T21:00:00Z',
      cases:[
        {...base,caseId:'1',mint:'mintX',originalPairId:'pair-a',screen:matched,
          outcome:{...later,rug:'CONFIRMED_RUG',runner:'VERIFIED_NOT_RUNNER'}},
        {...base,caseId:'2',mint:'mintY',originalPairId:'pair-b',screen:{...failed,mint:'mintY'},
          outcome:{...later,rug:'CONFIRMED_NON_RUG',runner:'VERIFIED_SELLABLE_RUNNER'}},
        {...base,caseId:'3',mint:'mintZ',originalPairId:'pair-c',screen:{...matched,mint:'mintZ'}},
      ],
    })
    expect(r.total).toBe(3)
    expect(r.missedRug).toBe(1)
    expect(r.missedVerifiedRunners).toBe(1)
    expect(r.falselyRejectedNonRug).toBe(1)
    expect(r.rugRejectionRecall).toBe(0)
    expect(r.unknownRug).toBe(1)
    expect(r.evidenceStatus).toBe('PARTIAL_HOLDOUT_LABELS')
    expect(r.canAuthorizeTrade).toBe(false)
  })
  it('refuses development contamination, duplicate assets, and unsealed chronology',()=>{
    const v={caseId:'1',mint:'mintX',originalPairId:'pairA',cohort:'HOLDOUT' as const,
      decisionAt:cutoff,informationCutoff:cutoff,screen:screened()}
    const input={cases:[v],presetId:'VIDEO1_NEW_PAIR_SOL_V1' as const,
      splitFrozenAt:'2026-10-20T00:00:00Z',evaluatedAt:'2026-10-21T21:00:00Z'}
    expect(()=>scoreProspectiveFilterHoldout({...input,cases:[v,v]})).toThrow('duplicate_case')
    expect(()=>scoreProspectiveFilterHoldout({...input,cases:[{...v,cohort:'DEVELOPMENT'}]})).toThrow('development_leak')
    expect(()=>scoreProspectiveFilterHoldout({...input,splitFrozenAt:'2026-10-22T00:00:00Z'})).toThrow('split_future')
  })
})

describe('SHARK-FILTER.08 end-to-end latency and shadow costs',()=>{
  it('does not mislabel subsecond detection as executable latency',()=>{
    const partial=measureSharkFilterLatency({
      traceId:'one-shot',origin:'REAL_PROVIDER_RECEIPTS',
      occurredAt:{eventVisible:'2026-10-21T19:00:00.000Z',screened:'2026-10-21T19:00:00.616Z'},
      evidenceIds:['timer'],
    })
    expect(partial.eventToScreenMs).toBe(616)
    expect(partial.eventToLandingMs).toBeUndefined()
    expect(partial.endToEndConfirmed).toBe(false)
    expect(()=>measureSharkFilterLatency({traceId:'bad',origin:'SYNTHETIC_FIXTURE',
      occurredAt:{eventVisible:cutoff,screened:'2026-10-21T18:00:00Z'},evidenceIds:['bad']}))
      .toThrow('out_of_order')
  })
  it('models entry, exit, tips, priority, price impact, taxes without inventing fills',()=>{
    const q={quoteId:'entry',tokenMint:'mintX',source:'READ_ONLY_DEX_ROUTE_QUOTE' as const,
      observedAt:'2026-10-21T19:02:01Z',availableAt:'2026-10-21T19:02:02Z',
      evidenceIds:['quote-a'],notionalUsd:100,liquidityAvailable:true,sellable:true,
      networkFeeUsd:.05,priorityFeeUsd:.10,jitoTipUsd:.15,swapFeeUsd:.2,
      slippageUsd:.3,priceImpactUsd:.4,tokenTaxUsd:.1}
    const exit={...q,quoteId:'exit',notionalUsd:130,
      observedAt:'2026-10-21T19:30:00Z',availableAt:'2026-10-21T19:30:01Z',evidenceIds:['quote-b']}
    const result=estimateSharkShadowRoundTrip({mint:'mintX',decisionAt:cutoff,
      evaluatedAt:'2026-10-21T19:31:00Z',entry:q,exit})
    expect(result.state).toBe('INDICATIVE_ONLY')
    expect(result.grossDeltaUsd).toBe(30)
    expect(result.indicativeNetUsd).toBeCloseTo(27.4,8)
    expect(result.canAuthorizeTrade).toBe(false)
    expect(estimateSharkShadowRoundTrip({mint:'mintX',decisionAt:cutoff,
      evaluatedAt:'2026-10-21T19:31:00Z',entry:q,exit:{...exit,sellable:false}}).state).toBe('NO_FILL')
    expect(estimateSharkShadowRoundTrip({mint:'mintX',decisionAt:cutoff,
      evaluatedAt:'2026-10-21T19:31:00Z',entry:q}).indicativeNetUsd).toBeUndefined()
  })
})

describe('SHARK-FILTER.09 release review gate',()=>{
  it('requires external evidence even when all source-level code is implemented',()=>{
    const base:SharkFilterAcceptanceEvidence={
      repositoryHead:'sha',evaluatedHead:'sha',githubCIPassed:true,
      independentFeeDefinitionVerified:false,providerReadOnlyCanaryVerified:false,
      independentlySourcedSafetyChecksVerified:false,historicalReplayPassed:false,
      heldOutProspectiveLabelsPresent:false,missedRunnerAuditPassed:false,
      quoteSellabilityProven:false,exitCostCoverageVerified:false,
      actualEndToEndLatencyObserved:false,persistentHostRecoveryTestPassed:false,
      privateAlertDeliveryVerified:false,moneyCoreReviewCompleted:false,evidenceIds:['ci'],
    }
    const blocked=evaluateSharkFilterReviewGate(base)
    expect(blocked.disposition).toBe('BLOCKED_EVIDENCE')
    expect(blocked.blockers).toContain('fee-metric-definition-unverified')
    const all={...base,independentFeeDefinitionVerified:true,providerReadOnlyCanaryVerified:true,
      independentlySourcedSafetyChecksVerified:true,historicalReplayPassed:true,
      heldOutProspectiveLabelsPresent:true,missedRunnerAuditPassed:true,
      quoteSellabilityProven:true,exitCostCoverageVerified:true,
      actualEndToEndLatencyObserved:true,persistentHostRecoveryTestPassed:true,
      privateAlertDeliveryVerified:true,moneyCoreReviewCompleted:true}
    const reviewed=evaluateSharkFilterReviewGate(all)
    expect(reviewed.disposition).toBe('ELIGIBLE_FOR_OWNER_REVIEW')
    expect(reviewed.activated).toBe(false)
    expect(reviewed.signerPermitted).toBe(false)
    expect(evaluateSharkFilterReviewGate({...all,evaluatedHead:'wrong'}).disposition)
      .toBe('BLOCKED_EVIDENCE')
  })
})
