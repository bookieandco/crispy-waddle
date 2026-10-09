import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectPurseLiveStorage} from './purse-live-storage-readiness.js'
import {reviewPurseRealCustody} from './purse-live-custody-gate.js'
import {buildPurseLiveMandateProposal} from './purse-live-mandate-proposal.js'
import type {SqlClient} from './postgres-idempotency-store.js'
import type {JhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {CofferTreasurySnapshot} from './coffer-treasury-contracts.js'
import type {PurseLiquiditySnapshot} from './purse-liquidity.js'
import type {CofferAccountantDecision} from './coffer-accountant.js'
import type {PurseRealCustodyReadback} from './purse-live-custody-gate.js'

const now='2026-10-09T16:00:00.000Z'
const charter:JhadinaPurseCharter={
 charterId:'charter:purse:owner:1',charterVersion:'v1',userId:'owner:1',cofferId:'coffer:1',
 reportingCurrency:'USD',autonomyMode:'LIVE_GOVERNED_INTENTS',maxTotalDeployableBps:7000,
 minLiquidReserveMinor:10000n,minEmergencyReserveMinor:5000n,maxSingleOpportunityBps:4000,
 maxCorrelatedExposureBps:5000,maxRebalanceTurnoverBps:5000,
 lanePolicies:[{lane:'STOCK',enabled:true,maxAllocationBps:5000,maxSinglePositionBps:3000,minConfidenceBps:7000}],
 verifiedOwnerPayoutDestinationId:'ownerbank:verified:1',ownerProfitSweepProtected:true,
 charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
 jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-01T00:00:00.000Z',
 evidenceIds:['owner:explicit:charter'],authority:'OWNER_TREASURY_CHARTER',canExecute:false,
}
const treasury:CofferTreasurySnapshot={
 cofferId:charter.cofferId,userId:charter.userId,reportingCurrency:'USD',observedAt:now,
 totalReportingValueMinor:100000n,reservedReportingValueMinor:10000n,deployableReportingValueMinor:90000n,
 assets:[],evidenceIds:['provider:treasury:1'],authority:'TREASURY_ACCOUNTING_EVIDENCE',canMoveMoney:false,
}
const liquidity:PurseLiquiditySnapshot={
 liquiditySnapshotId:'liquidity:1',charterId:charter.charterId,portfolioSnapshotId:'portfolio:1',
 reportingCurrency:'USD',grossLiquidMinor:85000n,unsettledMinor:5000n,accountReservedMinor:5000n,
 charterProtectedReserveMinor:15000n,externalObligationsMinor:0n,availableToAllocateMinor:60000n,
 availableForWithdrawalMinor:5000n,executableExitValueMinor:0n,ownerSweepHoldMinor:0n,
 observedAt:now,evidenceIds:['provider:liquidity:1'],authority:'LIQUIDITY_EVIDENCE',canExecute:false,
}
const accountant:CofferAccountantDecision={
 cofferId:charter.cofferId,survivalState:'ACTIVE',spendableCashMinor:85000n,deployableCashMinor:70000n,
 netRealizedProfitMinor:0n,planningReserveMinor:5000n,sweepableProfitMinor:0n,proposedSweepMinor:0n,
 sweepStatus:'BELOW_THRESHOLD',reasonCodes:[],authority:'ACCOUNTANT_DECISION_ONLY',canMoveMoney:false,
}
const custody:PurseRealCustodyReadback={
 ownerUserId:charter.userId,cofferId:charter.cofferId,provider:'approved-broker',
 custodyAccountId:'broker:live:cash:1',verifiedOwnerDestinationId:charter.verifiedOwnerPayoutDestinationId,
 currency:'USD',settledAvailableMinor:85000n,reservedAtProviderMinor:5000n,observedAt:now,
 sourceEventIds:['provider:balance:1','provider:settlement:1'],providerAccountVerificationId:'owner:account-verify:1',
 transferSettlementReceiptId:'provider:settlement:1',verifier:'broker:readback:system',
 evidenceClass:'REAL_SETTLED_PROVIDER_OBSERVATION',synthetic:false,
 authority:'CUSTODY_READBACK_ONLY',canMoveMoney:false,
}
test('PURSE-LIVE.01 database unavailable or recovery stays blocked and does not certify money',async()=>{
 const down:SqlClient={async query<T>(){throw new Error('57P03: recovery')}}
 const r=await inspectPurseLiveStorage(down)
 assert.equal(r.state,'BLOCKED')
 assert.equal(r.liveTradingEnabled,false)
 assert.equal(r.independentlyRestored,false)
 assert.ok(r.blockers.includes('DATABASE_UNAVAILABLE_OR_QUERY_REJECTED'))
 const healthy:SqlClient={
  async query<T>(){return {rows:[{observed_at:new Date(now),database_name:'ephemeral_test',
   in_recovery:false,read_only:false,tables:{
    money_coffers:true,money_profit_sweep_policies:true,money_autonomous_trading_mandates:true,
    money_funding_rail_admissions:true,money_movement_attempts:true,money_purse_charters:true,
    money_purse_paper_cycles:true,money_purse_paper_leases:true,
   }}] as T[]}}
 }
 const good=await inspectPurseLiveStorage(healthy)
 assert.equal(good.state,'READABLE_BUT_UNCERTIFIED')
 assert.equal(good.independentlyRestored,false)
 assert.equal(good.liveTradingEnabled,false)
})
test('PURSE-LIVE.03 real settled custody is owner/payout bound, net of holds, never transfer authority',()=>{
 const input={charter,treasury,liquidity,accountant,custody,now}
 const r=reviewPurseRealCustody(input)
 assert.equal(r.status,'EVIDENCE_REVIEW_REQUIRED')
 assert.equal(r.maximumReviewableDeployableMinor,60000n)
 assert.equal(r.independentlyCertified,false)
 assert.equal(r.canTrade,false)
 assert.equal(r.canMoveMoney,false)
 assert.equal(reviewPurseRealCustody({...input,custody:null}).status,'BLOCKED')
 const spoof=reviewPurseRealCustody({...input,custody:{...custody,verifiedOwnerDestinationId:'attacker:bank'}})
 assert.ok(spoof.blockers.includes('CUSTODY_OWNER_PAYOUT_BINDING_INVALID'))
 assert.equal(spoof.maximumReviewableDeployableMinor,0n)
 assert.ok(reviewPurseRealCustody({...input,custody:{...custody,synthetic:true}}).blockers.includes('CUSTODY_PROVENANCE_OR_FRESHNESS_MISSING'))
 assert.ok(reviewPurseRealCustody({...input,accountant:{...accountant,survivalState:'HALTED'}}).blockers.includes('COFFER_FLOORS_OR_ACCOUNTANT_BLOCK'))
})
test('PURSE-LIVE.04 prepares an owner-reviewed Action Core proposal but cannot self-authorize orders',()=>{
 const reviewed=reviewPurseRealCustody({charter,treasury,liquidity,accountant,custody,now})
 const input={charter,custody:reviewed,provider:'approved-broker',accountId:'broker:live:cash:1',
  lane:'STOCK' as const,currency:'USD',strategies:['stock-core'],instrumentPrefixes:['SPY','QQQ'],
  limits:{maxOrderNotionalMinor:5000n,maxDailySubmittedNotionalMinor:20000n,maxDailyOrders:3,
   maxDailyRealizedLossMinor:1000n,maxGrossExposureMinor:20000n,maxDrawdownBps:1000,
   maxLeverageBps:10000,minModelConfidenceBps:6000},
  allowOpeningShorts:false,startsAt:'2026-10-09T16:01:00.000Z',
  expiresAt:'2026-10-10T16:00:00.000Z',requestedAt:now}
 const p=buildPurseLiveMandateProposal(input)
 assert.equal(p.approvalReceiptId,null)
 assert.equal(p.action.minModelConfidenceBps,7000)
 assert.equal(p.requiresActionCoreApproval,true)
 assert.equal(p.canActivate,false)
 assert.equal(p.canExecute,false)
 assert.equal(p.canMoveMoney,false)
 assert.throws(()=>buildPurseLiveMandateProposal({...input,limits:{...input.limits,maxOrderNotionalMinor:19000n}}),/EXCEED_OWNER_OR_CUSTODY/)
 assert.throws(()=>buildPurseLiveMandateProposal({...input,charter:{...charter,autonomyMode:'PAPER_AUTONOMOUS'}}),/OWNER_CHARTER_REQUIRED/)
 assert.throws(()=>buildPurseLiveMandateProposal({...input,custody:{...reviewed,status:'BLOCKED'}}),/CUSTODY_REVIEW_REQUIRED/)
 assert.throws(()=>buildPurseLiveMandateProposal({...input,instrumentPrefixes:[]}),/SCOPE_INVALID/)
})
