import {describe,expect,it,vi} from 'vitest'
import {normalizePublicDexPairs,readPublicDexPair,runPublicFilterCanary,
  type PublicDexPair,type PublicFilterCanary,type VerifiedStageReceipt}
  from '../shark-filter-live-public'
import {sealLiveFilterProspectiveCase,observeLiveFilterPriceMark} from '../shark-filter-live-paper'
import {reviewLiveFilterPaperRoute} from '../shark-filter-live-route-review'
import {assessLiveFilterAcceptance} from '../shark-filter-live-acceptance'
import {composeScreenedSharkCandidate} from '../screened-shark-candidate'
import type {MemeTradeAssessment} from '../assessment'
import type {SharkFilterAcceptanceEvidence} from '../shark-filter-release-gate'

const mint='A'.repeat(44),pairId='B'.repeat(44),quoteMint='C'.repeat(44)
const received='2026-10-21T19:01:00Z',cutoff='2026-10-21T19:02:00Z'
const payload=[{
  chainId:'solana',dexId:'pumpswap',pairAddress:pairId,
  baseToken:{address:mint,name:'Test',symbol:'T'},quoteToken:{address:quoteMint,name:'Quote',symbol:'Q'},
  priceUsd:'0.20',marketCap:20000,liquidity:{usd:100000},volume:{h1:2000},
  pairCreatedAt:Date.parse('2026-10-21T18:51:00Z'),
  info:{socials:[{platform:'x',handle:'example'}],websites:[]},
}]
const stage:VerifiedStageReceipt={
  mint,pairAddress:pairId,stage:'NEW_PAIR',observedAt:'2026-10-21T19:00:00Z',
  availableAt:'2026-10-21T19:00:30Z',
  evidenceIds:['canonical-pump-lifecycle'],verifiedByCanonicalLifecycle:true,
}
const snapshot={
  chainId:'solana' as const,mint,terminal:'experiment-terminal',
  metricName:'GLOBAL_FEES_PAID' as const,
  metricDefinition:'Source-defined aggregate, unverified',
  currency:'SOL' as const,amount:0.5,
  observedAt:'2026-10-21T19:00:59Z',availableAt:'2026-10-21T19:00:59Z',
  evidenceId:'terminal-fees',providerVersion:'v1',
}
const read=()=>normalizePublicDexPairs({
  payload,mint,pairAddress:pairId,receivedAt:received,localReceiptId:'dex-receipt-1',
})
const canary=()=>runPublicFilterCanary({
  read:read(),stage,presetId:'VIDEO1_NEW_PAIR_SOL_V1',
  feeSnapshot:snapshot,informationCutoff:cutoff,
})
const future=(price:number,pairAddress=pairId,at='2026-10-22T20:01:00Z'):PublicDexPair=>
  ({...read().pair!,pairAddress,priceUsd:price,receivedAt:at,localReceiptId:'dex-receipt-next'})
const study=()=>sealLiveFilterProspectiveCase({
  caseId:'case-1',canary:canary(),sealedAt:'2026-10-21T19:01:05Z',
})
const candidate=()=>{
  const a={
    assessmentId:'assessment-1',assessedAt:'2026-10-21T19:01:10Z',
    token:{chainId:'solana',tokenAddress:mint},evidenceIds:['canonical-risk-receipt'],
    rugProtection:{disposition:'ALLOW_CANDIDATE'},
    rugSelfProtection:{action:'ALLOW_PAPER_STUDY',missingCriticalCoverage:[]},
    riskAssessment:{band:'candidate'},
  } as unknown as MemeTradeAssessment
  return composeScreenedSharkCandidate({
    screen:canary().screen!,assessment:a,
    assessmentAvailableAt:'2026-10-21T19:01:11Z',informationCutoff:cutoff,
  })
}
const route=(id:string,amount:number,at:string)=>({
  quoteId:id,tokenMint:mint,source:'READ_ONLY_DEX_ROUTE_QUOTE' as const,
  notionalBasis:'GROSS_BEFORE_MODELED_COSTS' as const,
  observedAt:at,availableAt:at,evidenceIds:[id],
  notionalUsd:amount,liquidityAvailable:true,sellable:true,
  networkFeeUsd:.05,priorityFeeUsd:.1,jitoTipUsd:.1,swapFeeUsd:.2,
  slippageUsd:.2,priceImpactUsd:.2,tokenTaxUsd:.05,
})
const coverage={
  quoteProvider:'independent-experimental-readonly-quote',
  entryEvidenceId:'route-entry',exitEvidenceId:'route-exit',
  entryPairAddress:pairId,exitPairAddress:pairId,
  allFeeFamiliesChecked:true,taxAndTransferExtensionChecked:true,
  routeSellabilityIndependentlyVerified:true,
}
const paper=()=>reviewLiveFilterPaperRoute({
  study:study(),candidate:candidate(),coverage,
  entry:route('route-entry',100,'2026-10-21T19:01:06Z'),
  exit:route('route-exit',130,'2026-10-22T20:01:00Z'),
  evaluatedAt:'2026-10-22T20:03:00Z',
})
const release:SharkFilterAcceptanceEvidence={
  repositoryHead:'sha',evaluatedHead:'sha',githubCIPassed:false,
  independentFeeDefinitionVerified:false,providerReadOnlyCanaryVerified:false,
  independentlySourcedSafetyChecksVerified:false,historicalReplayPassed:false,
  heldOutProspectiveLabelsPresent:false,missedRunnerAuditPassed:false,
  quoteSellabilityProven:false,exitCostCoverageVerified:false,
  actualEndToEndLatencyObserved:false,persistentHostRecoveryTestPassed:false,
  privateAlertDeliveryVerified:false,moneyCoreReviewCompleted:false,
  evidenceIds:['source-acceptance'],
}

describe('SHARK-FILTER.LIVE.10 read-only pair identity and provenance',()=>{
  it('parses the documented Solana token-pairs shape without inventing fees or stage',()=>{
    const r=read()
    expect(r.status).toBe('PAIR_OBSERVED')
    expect(r.pair?.mint).toBe(mint)
    expect(r.pair?.pairAddress).toBe(pairId)
    expect(r.pair?.hourlyVolumeUsd).toBe(2000)
    expect(r.pair?.providerIndependentlyAttested).toBe(false)
    expect(r.missing).toContain('terminal-global-fees-not-in-source')
    expect(r.canAuthorizeTrade).toBe(false)
  })
  it('fails closed on wrong original pair, wrong token and duplicate pool',()=>{
    expect(normalizePublicDexPairs({payload,mint,pairAddress:'D'.repeat(44),
      receivedAt:received,localReceiptId:'r'}).status).toBe('NO_PAIR')
    expect(()=>normalizePublicDexPairs({payload:[{...payload[0],baseToken:{address:quoteMint},
      quoteToken:{address:'D'.repeat(44)}}],mint,pairAddress:pairId,
      receivedAt:received,localReceiptId:'r'})).toThrow('token_binding')
    expect(()=>normalizePublicDexPairs({payload:[...payload,...payload],mint,
      pairAddress:pairId,receivedAt:received,localReceiptId:'r'})).toThrow('duplicate_pair')
  })
})

describe('SHARK-FILTER.LIVE.11 actual read-only GET boundary',()=>{
  it('has a fixed provider URL, GET only, redirect refusal and no secrets',async()=>{
    const fetcher=vi.fn(async(_url:string,_init:RequestInit)=>({
      ok:true,status:200,text:async()=>JSON.stringify(payload),
    }))
    const response=await readPublicDexPair({mint,pairAddress:pairId,
      receivedAt:received,localReceiptId:'dex-receipt-1',fetcher})
    expect(response.status).toBe('PAIR_OBSERVED')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url,init]=fetcher.mock.calls[0]!
    expect(url).toBe('https://api.dexscreener.com/token-pairs/v1/solana/'+mint)
    expect(init.method).toBe('GET')
    expect(init.redirect).toBe('error')
    expect(init.headers).toEqual({Accept:'application/json'})
  })
  it('returns unavailable on transport failure and refuses unverified stages',async()=>{
    const fetcher=vi.fn(async()=>{throw Error('provider-offline')})
    const r=await readPublicDexPair({mint,pairAddress:pairId,
      receivedAt:received,localReceiptId:'dex-receipt-1',fetcher})
    expect(r.status).toBe('SOURCE_UNAVAILABLE')
    const c=runPublicFilterCanary({read:read(),presetId:'VIDEO1_NEW_PAIR_SOL_V1',
      informationCutoff:cutoff})
    expect(c.status).toBe('STAGE_UNVERIFIED')
    expect(c.screen).toBeUndefined()
    expect(c.canBroadcast).toBe(false)
    expect(runPublicFilterCanary({read:read(),stage,presetId:'VIDEO1_NEW_PAIR_SOL_V1',
      informationCutoff:cutoff}).screen?.disposition).toBe('REVIEW')
    expect(canary().screen?.disposition).toBe('MATCH')
    expect(canary().prospectivePaperEntry).toBe(false)
  })
})

describe('SHARK-FILTER.LIVE.12 prospectively pinned 24h marks',()=>{
  it('marks original pair price movement without turning it into P&L or a fill',()=>{
    const s=study()
    expect(s.tradingAllowed).toBe(false)
    const result=observeLiveFilterPriceMark({
      study:s,followup:future(.4),evaluatedAt:'2026-10-22T20:03:00Z',
    })
    expect(result.status).toBe('PRICE_ONLY_UNVERIFIED')
    expect(result.returnFraction).toBeCloseTo(1)
    expect(result.sellableReturnProven).toBe(false)
    expect(result.moneyCorePaperFill).toBe(false)
    expect(result.realTrade).toBe(false)
  })
  it('censors missing/wrong-pair/too-late and refuses backdated sealing',()=>{
    const s=study()
    expect(observeLiveFilterPriceMark({study:s,evaluatedAt:'2026-10-21T21:00:00Z'}).status)
      .toBe('OPEN_AWAITING_WINDOW')
    expect(observeLiveFilterPriceMark({study:s,followup:future(.4,'D'.repeat(44)),
      evaluatedAt:'2026-10-22T20:03:00Z'}).status).toBe('CENSORED_MISSING_OR_WRONG_PAIR')
    expect(observeLiveFilterPriceMark({study:s,followup:future(.4,pairId,'2026-10-23T03:01:00Z'),
      evaluatedAt:'2026-10-23T03:02:00Z'}).status).toBe('CENSORED_MISSING_OR_WRONG_PAIR')
    expect(()=>sealLiveFilterProspectiveCase({caseId:'late',canary:canary(),
      sealedAt:'2026-10-21T19:04:00Z'})).toThrow('prospectively_sealed')
  })
})

describe('SHARK-FILTER.LIVE.13 safety-first two-sided route quote review',()=>{
  it('requires original pair and verified cost coverage for indicative shadow only',()=>{
    const result=paper()
    expect(result.status).toBe('READ_ONLY_SHADOW_ESTIMATE')
    expect(result.shadow.state).toBe('INDICATIVE_ONLY')
    expect(result.moneyCorePaperFill).toBe(false)
    expect(result.realFill).toBe(false)
    expect(result.signerPermitted).toBe(false)
    const bad=reviewLiveFilterPaperRoute({
      study:study(),candidate:candidate(),coverage:{...coverage,exitPairAddress:'D'.repeat(44)},
      entry:route('route-entry',100,'2026-10-21T19:01:06Z'),
      exit:{...route('route-exit',130,'2026-10-22T20:01:00Z'),sellable:false},
      evaluatedAt:'2026-10-22T20:03:00Z',
    })
    expect(bad.status).toBe('NO_FILL_OR_UNVERIFIED')
    expect(bad.reasons).toContain('original-pair-route-provenance-incomplete')
    expect(bad.reasons).toContain('exit_route_not_sellable')
    expect(bad.shadow.indicativeNetUsd).toBeUndefined()
  })
})

describe('SHARK-FILTER.LIVE.14 evidence-based commissioning readiness',()=>{
  it('blocks source-only canary from being rebranded as production trading',()=>{
    const acceptance=assessLiveFilterAcceptance({
      canaries:[canary()],marks:[observeLiveFilterPriceMark({
        study:study(),followup:future(.4),evaluatedAt:'2026-10-22T20:03:00Z',
      })],shadowReviews:[paper()],external:release,
    })
    expect(acceptance.status).toBe('INCOMPLETE_SOURCE_ACCEPTANCE')
    expect(acceptance.canDeploy).toBe(false)
    expect(acceptance.canTrade).toBe(false)
    expect(acceptance.canSpend).toBe(false)
    expect(acceptance.realOrders).toBe(0)
    expect(acceptance.certifiedMoneyPaperFills).toBe(0)
    expect(acceptance.blockers).toContain('real-read-only-source-not-commissioned')
  })
})
