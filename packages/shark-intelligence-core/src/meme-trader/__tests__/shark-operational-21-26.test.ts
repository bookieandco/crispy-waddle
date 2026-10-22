import {describe,it,expect} from 'vitest'
import {
 reconcileOperationalPRs,evaluateOperationalDiscovery,reviewOperationalRisk,
 auditOperationalPaper,evaluateOperationalSpeed,evaluateOperationalAcceptance,
} from '../shark-operational-21-26'
import {measureSharkFilterLatency} from '../shark-filter-execution-research'
describe('SHARK-OPERATIONAL.21-.26 owner-only coordinated acceptance',()=>{
 it('.21 isolates diverged drafts without auto-merging',()=>{
  const r=reconcileOperationalPRs({
   mainChangedPaths:['packages/shark-intelligence-core/src/meme-trader/index.ts'],
   prs:[{number:1388,ahead:78,behind:201,headSha:'old',scope:'ALPHA',
    changedPaths:['packages/shark-intelligence-core/src/meme-trader/index.ts']}],
  })
  expect(r.pendingPRs).toEqual([1388])
  expect(r.collisions).toHaveLength(1)
  expect(r.safeToMergeMain).toBe(false)
 })
 it('.22 never estimates an event timestamp from polling',()=>{
  const r=evaluateOperationalDiscovery({source:'PUBLIC_POLL',mint:'mint',
   pairAddress:'pool',providerAvailableAt:'2026-10-21T04:00:00Z',
   locallyIngestedAt:'2026-10-21T04:00:00.616Z',sourceEvidenceId:'rpc1',
   protocolVerified:true,chainEvidenceIndependentlyVerified:true})
  expect(r.eventToIngestMs).toBeUndefined()
  expect(r.missing).toContain('event-time-unavailable-in-public-poll')
  expect(r.canTrade).toBe(false)
  expect(()=>evaluateOperationalDiscovery({source:'SOLANA_EVENT_STREAM',
   mint:'mint',pairAddress:'pool',eventAt:'2026-10-21T04:03:00Z',
   providerAvailableAt:'2026-10-21T04:00:00Z',
   locallyIngestedAt:'2026-10-21T04:01:00Z',sourceEvidenceId:'e',
   protocolVerified:true,chainEvidenceIndependentlyVerified:true})).toThrow('EVENT_ORDER')
 })
 it('.23 never labels a token safe from one risk source',()=>{
  expect(reviewOperationalRisk({mint:'mint',labels:['liquidity-removal'],
   evidenceIds:['e1'],independentSources:['rpc'],sellabilityReviewed:false,
   tokenControlReviewed:true,liquidityReviewed:true,actorClustersReviewed:true,
   observedAt:'2026-10-21T04:00:00Z',availableAt:'2026-10-21T04:01:00Z'
  }).status).toBe('INSUFFICIENT_COVERAGE')
  expect(reviewOperationalRisk().canDeclareSafe).toBe(false)
 })
 it('.24 reports empty paper evidence without a fabricated win',()=>{
  const r=auditOperationalPaper({canaries:[],marks:[],routes:[]})
  expect(r.decisions).toBe(0)
  expect(r.netExecutedPnlVerified).toBe(false)
  expect(r.fillClaimAllowed).toBe(false)
 })
 it('.25 keeps fast screen timestamps distinct from trading fills',()=>{
  const trace=measureSharkFilterLatency({traceId:'test',origin:'REAL_PROVIDER_RECEIPTS',
   occurredAt:{eventVisible:'2026-10-21T04:00:00.000Z',
    screened:'2026-10-21T04:00:00.616Z'},evidenceIds:['event-evidence']})
  const speed=evaluateOperationalSpeed([trace])
  expect(speed.sourceToScreenP95Ms).toBe(616)
  expect(speed.actualCompleteFillCount).toBe(0)
  expect(speed.canClaimSubsecondExecution).toBe(false)
 })
 it('.26 blocks owner capital even if source CI is green',()=>{
  const gate=evaluateOperationalAcceptance({
   exactHeadCiPassed:true,reconciledPRs:false,verifiedTerminalFees:false,
   independentlyVerifiedSellability:false,prospectiveHoldoutLabeled:false,
   moneyCoreIndependentReview:false,phoneReadbackVerified:false,
  })
  expect(gate.status).toBe('BLOCKED_PENDING_REAL_ACCEPTANCE')
  expect(gate.trade).toBe(false)
  expect(gate.sign).toBe(false)
  expect(gate.spend).toBe(false)
  expect(gate.deploy).toBe(false)
 })
})
