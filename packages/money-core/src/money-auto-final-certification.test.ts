import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createMoneyActionCoreAuthority } from './action-core-authority-bridge.js'
import { createBrokerAccountEntitlement, InMemoryBrokerAccountEntitlementStore } from './broker-account-entitlement.js'
import type { ExecutionAttempt, ExecutionAttemptOutcome, ExecutionAttemptStore } from './execution-attempt.js'
import type { ExecutionPermit, PermitStore } from './execution-permit.js'
import type { ExecutionPlan } from './execution-planning-contracts.js'
import type { LiveExecutionPreflight } from './live-preflight-contracts.js'
import { InMemoryLiveCanaryStateStore } from './live-canary-store.js'
import type { LiveCanaryPolicy, LiveRiskMetricSnapshot } from './live-canary-contracts.js'
import type { ManualLiveBrokerAdapter } from './manual-live-broker-contracts.js'
import { assertManualTrigger } from './manual-live-broker-contracts.js'
import {
  createAutonomousMandateActivationRequest,
  createAutonomousTradingMandate,
  InMemoryAutonomousTradingMandateStore,
  type AutonomousRiskSnapshot,
  type AutonomousTradeIntent,
  type AutonomousCertificationCase,
} from './autonomous-trading-contracts.js'
import {
  buildAutonomousTradeActionRequest,
  certifyMoneyAuto,
  evaluateAutonomousRisk,
  executeAutonomousLiveTrade,
  issueAutonomousTradePermitPackage,
} from './autonomous-trading-engine.js'
import {
  assertLearningCannotMutateMandate,
  assessStrategyForAutonomousReview,
  calibrateAutonomousStrategy,
  learnFromPaperStrategy,
} from './autonomous-strategy-learning.js'
import type { PaperStrategyResult } from './paper-strategy-result.js'

const t={
  request:'2026-09-21T20:00:00Z',
  mandateAuthorized:'2026-09-21T20:00:01Z',
  start:'2026-09-21T20:00:01Z',
  childRequest:'2026-09-21T20:01:00Z',
  childAuthorized:'2026-09-21T20:01:01Z',
  execute:'2026-09-21T20:01:02Z',
  permitExpiry:'2026-09-21T20:02:00Z',
  expiry:'2026-09-21T22:00:00Z',
  authorityExpiry:'2026-09-21T23:00:00Z',
}

const activation=()=>createAutonomousMandateActivationRequest({
  actionId:'activate-auto-1',userId:'user-1',approvalReceiptId:'approval-auto-1',requestedAt:t.request,
  action:{
    capability:'money.autonomous.mandate.activate',provider:'broker-x',accountId:'acct-1',currency:'USD',mode:'LIVE_AUTONOMOUS',
    allowedInstrumentPrefixes:['stock:','forex:','meme:solana:'],allowedStrategyIds:['stock-momentum','fx-macro','shark-scalp'],
    maxOrderNotionalMinor:'10000',maxDailySubmittedNotionalMinor:'50000',maxDailyOrders:5,maxDailyRealizedLossMinor:'5000',maxGrossExposureMinor:'30000',
    maxDrawdownBps:1000,maxLeverageBps:15000,minModelConfidenceBps:6500,allowOpeningShorts:false,startsAt:t.start,expiresAt:t.expiry,
  },
})
const mandate=()=>{
  const request=activation()
  const authority=createMoneyActionCoreAuthority(request,{authorityId:'authority-mandate-1',decision:'approval_required',policyVersion:'auto-policy-v1',policyHash:'auto-policy-h1',authorizedAt:t.mandateAuthorized,expiresAt:t.authorityExpiry})
  return createAutonomousTradingMandate({mandateId:'mandate-1',request,authority,evidenceIds:['user-approval:approval-auto-1'],activatedAt:t.mandateAuthorized})
}
const intent=(overrides:Partial<AutonomousTradeIntent>={}):AutonomousTradeIntent=>Object.freeze({
  intentId:'intent-1',mandateId:'mandate-1',strategyId:'stock-momentum',instrumentId:'stock:AAPL',side:'BUY',opensShort:false,
  notionalMinor:5000n,currency:'USD',limitPriceMinor:20000n,modelConfidenceBps:8000,opportunityId:'opp-1',allocationDecisionId:'alloc-1',
  executionPlanId:'plan-1',preflightId:'preflight-1',evidenceIds:Object.freeze(['model:1','market:1']),decidedAt:t.childRequest,authority:'INTELLIGENCE_ONLY',canExecute:false,...overrides,
})
const riskSnapshot=(overrides:Partial<AutonomousRiskSnapshot>={}):AutonomousRiskSnapshot=>Object.freeze({
  snapshotId:'risk-snapshot-1',provider:'broker-x',accountId:'acct-1',currency:'USD',grossExposureMinor:5000n,realizedPnlMinor:0n,
  drawdownBps:100,leverageBps:10000,unresolvedExecutions:0,observedAt:t.childRequest,availableAt:t.childRequest,evidenceIds:Object.freeze(['risk:1']),authority:'EVIDENCE_ONLY',...overrides,
})
const plan:ExecutionPlan=Object.freeze({
  executionPlanId:'plan-1',rebalanceIntentId:'rebalance-1',portfolioPlanId:'portfolio-1',instrumentId:'stock:AAPL',side:'BUY',
  notional:{minor:5000n,currency:'USD'},urgency:'NORMAL',routeId:'route-1',marketSnapshotId:'market-1',
  slices:Object.freeze([{sliceId:'slice-1',sequence:1,notional:{minor:5000n,currency:'USD'},instruction:'MARKETABLE_LIMIT',limitPriceMinor:20000n,earliestAt:t.childRequest,expiresAt:t.expiry,idempotencyKey:'slice-idem',authority:'NONE'}]),
  maxSpreadBps:100,maxParticipationBps:1000,informationCutoff:t.childRequest,expiresAt:t.expiry,inputHash:'plan-input',provenanceHash:'plan-prov',authority:'ANALYSIS_ONLY',requiresHumanApproval:true,
})
const preflight:LiveExecutionPreflight=Object.freeze({
  preflightId:'preflight-1',executionPlanId:'plan-1',provider:'broker-x',accountId:'acct-1',status:'PASS_FOR_HUMAN_APPROVAL',reasonCodes:Object.freeze([]),
  accountCapabilitySnapshotId:'account-snap',routeSnapshotId:'route-1',marketSnapshotId:'market-1',shadowCertificationReportId:'shadow-cert',
  checkedAt:t.childRequest,expiresAt:t.expiry,inputHash:'preflight-input',provenanceHash:'preflight-prov',authority:'PREFLIGHT_ONLY',requiresHumanApproval:true,canSubmitOrders:false,canAuthorizeLive:false,
})
const entitlement=createBrokerAccountEntitlement({entitlementId:'entitlement-1',userId:'user-1',provider:'broker-x',accountId:'acct-1',capabilities:['money.trade.submit'],createdAt:t.request,expiresAt:t.authorityExpiry,evidenceIds:['broker-auth']})

class MemoryPermitStore implements PermitStore{
  rows=new Map<string,ExecutionPermit>()
  issue(p:ExecutionPermit){this.rows.set(p.permitId,p)}
  get(id:string){return this.rows.get(id)}
  consume(id:string,nonce:string){const p=this.rows.get(id);if(!p||p.state!=='ISSUED'||p.nonce!==nonce)return false;this.rows.set(id,Object.freeze({...p,state:'CONSUMED'}));return true}
  revoke(id:string){const p=this.rows.get(id);if(p?.state==='ISSUED')this.rows.set(id,Object.freeze({...p,state:'REVOKED'}))}
  haltAll(){for(const [id,p] of this.rows)if(p.state==='ISSUED')this.rows.set(id,Object.freeze({...p,state:'HALTED'}))}
}
class MemoryAttemptStore implements ExecutionAttemptStore{
  rows=new Map<string,ExecutionAttempt>()
  start(a:ExecutionAttempt){this.rows.set(a.attemptId,a)}
  complete(id:string,o:ExecutionAttemptOutcome,at?:string){const a=this.rows.get(id);if(!a)throw new Error('missing attempt');this.rows.set(id,Object.freeze({...a,...o,completedAt:at??a.completedAt}))}
  resolve(id:string,o:ExecutionAttemptOutcome,at?:string){this.complete(id,o,at)}
  get(id:string){return this.rows.get(id)}
}

test('AUTO.1 mandate requires explicit Action Core approval and cannot authorize a trade itself',()=>{
  const m=mandate()
  assert.equal(m.approvalReceiptId,'approval-auto-1');assert.equal(m.authority,'USER_APPROVED_MANDATE');assert.equal(m.canAuthorizeTrade,false)
  assert.throws(()=>createAutonomousMandateActivationRequest({...({actionId:'x',userId:'u',approvalReceiptId:'',requestedAt:t.request,action:activation().action})}),/EXPLICIT_APPROVAL_REQUIRED/)
})

test('AUTO.2 durable mandate lifecycle expires and revokes independently of model state',()=>{
  const store=new InMemoryAutonomousTradingMandateStore(),m=mandate();store.put(m);assert.equal(store.findActive({userId:'user-1',provider:'broker-x',accountId:'acct-1',now:t.execute})?.mandateId,m.mandateId)
  store.revoke(m.mandateId,t.execute);assert.equal(store.findActive({userId:'user-1',provider:'broker-x',accountId:'acct-1',now:t.execute}),undefined)
})

test('AUTO.3 risk governor enforces allowlists and every hard model-independent limit',()=>{
  const m=mandate(),good=intent()
  assert.equal(evaluateAutonomousRisk({mandate:m,intent:good,snapshot:riskSnapshot(),now:t.childAuthorized}).allowed,true)
  const cases:[AutonomousTradeIntent,AutonomousRiskSnapshot,string][]=[
    [intent({strategyId:'rogue'}),riskSnapshot(),'STRATEGY_NOT_ALLOWED'],
    [intent({instrumentId:'crypto:BTC'}),riskSnapshot(),'INSTRUMENT_NOT_ALLOWED'],
    [intent({notionalMinor:15000n}),riskSnapshot(),'ORDER_NOTIONAL_LIMIT'],
    [intent({opensShort:true,side:'SELL'}),riskSnapshot(),'OPENING_SHORT_NOT_ALLOWED'],
    [intent({modelConfidenceBps:4000}),riskSnapshot(),'MODEL_CONFIDENCE_BELOW_FLOOR'],
    [good,riskSnapshot({drawdownBps:2000}),'DRAWDOWN_LIMIT'],
    [good,riskSnapshot({leverageBps:20000}),'LEVERAGE_LIMIT'],
    [good,riskSnapshot({realizedPnlMinor:-6000n}),'DAILY_REALIZED_LOSS_LIMIT'],
    [good,riskSnapshot({grossExposureMinor:29000n}),'GROSS_EXPOSURE_LIMIT'],
    [good,riskSnapshot({unresolvedExecutions:1}),'UNRESOLVED_EXECUTION_BLOCK'],
  ]
  for(const [i,s,code] of cases)assert.ok(evaluateAutonomousRisk({mandate:m,intent:i,snapshot:s,now:t.childAuthorized}).reasonCodes.includes(code))
})

test('AUTO.4 paper learning spans domains but promotion remains review-only and cannot mutate mandate',()=>{
  const paper=(returnBps:number,id:string):PaperStrategyResult=>Object.freeze({
    strategyResultId:id,paperRunId:'run-'+id,currency:'USD',startingValue:{minor:10000n,currency:'USD'},endingValue:{minor:BigInt(10000+returnBps),currency:'USD'},
    realizedPnl:{minor:BigInt(returnBps),currency:'USD'},unrealizedPnl:{minor:0n,currency:'USD'},totalPnl:{minor:BigInt(returnBps),currency:'USD'},returnBps,
    feesPaid:{minor:10n,currency:'USD'},aggregateFillRateBps:9000,weightedSlippageBps:10,executionOutcomeIds:['eo-'+id],executionPlanIds:['ep-'+id],terminalState:'CLOSED',
    startedAt:t.request,endedAt:t.childRequest,evidenceIds:['fill-'+id],stateHash:'state-'+id,authority:'LEARNING_ONLY',
  })
  for(const domain of ['STOCK','FOREX','MEME','SPORTS_BETTING'] as const){const records=Array.from({length:4},(_,n)=>learnFromPaperStrategy({domain,strategyId:'s-'+domain,scenarioId:'scenario-'+n,result:paper(300+n*10,domain+n)}));const c=calibrateAutonomousStrategy({domain,strategyId:'s-'+domain,records,calibratedAt:t.childAuthorized,minimumSamples:4});const p=assessStrategyForAutonomousReview({calibration:c,minSamples:4,minMeanReturnBps:0,minFillRateBps:7000,maxDownsideRateBps:6000,maxAbsSlippageBps:100});assert.equal(c.authority,'LEARNING_ONLY');assert.equal(p.status,'ELIGIBLE_FOR_AUTONOMOUS_REVIEW');assert.equal(p.authority,'REVIEW_ONLY');assert.equal(p.canAuthorizeLive,false)}
  assert.throws(()=>assertLearningCannotMutateMandate('MANDATE_LIMITS'),/CANNOT_MUTATE_HARD_LIMITS/)
})

test('AUTO.5 child trade authority remains Action Core bound and permit is single use',async()=>{
  const m=mandate(),i=intent(),risk=evaluateAutonomousRisk({mandate:m,intent:i,snapshot:riskSnapshot(),now:t.childAuthorized})
  const request=buildAutonomousTradeActionRequest({actionId:'trade-1',mandate:m,intent:i,requestedAt:t.childRequest})
  const authority=createMoneyActionCoreAuthority(request,{authorityId:'authority-child-1',decision:'allow',policyVersion:m.policyVersion,policyHash:m.policyHash,authorizedAt:t.childAuthorized,expiresAt:t.expiry})
  const permits=new MemoryPermitStore()
  const pkg=await issueAutonomousTradePermitPackage({permitStore:permits,request,authority,mandate:m,intent:i,risk,plan,preflight,entitlement,authorizedAt:t.childAuthorized,permitExpiresAt:t.permitExpiry,permitId:'permit-auto-1',nonce:'nonce-auto-1'})
  assert.equal(pkg.permit.binding.approvalId,m.approvalReceiptId);assert.equal(pkg.action.mandateId,m.mandateId);assert.equal(pkg.action.strategyId,i.strategyId)
  assert.equal(permits.get('permit-auto-1')?.state,'ISSUED')
})

test('AUTO.6 autonomous executor submits without forging an interactive human trigger while preserving broker entitlement and canary gates',async()=>{
  const m=mandate(),i=intent(),risk=evaluateAutonomousRisk({mandate:m,intent:i,snapshot:riskSnapshot(),now:t.childAuthorized})
  const request=buildAutonomousTradeActionRequest({actionId:'trade-exec-1',mandate:m,intent:i,requestedAt:t.childRequest})
  const authority=createMoneyActionCoreAuthority(request,{authorityId:'authority-child-exec',decision:'allow',policyVersion:m.policyVersion,policyHash:m.policyHash,authorizedAt:t.childAuthorized,expiresAt:t.expiry})
  const permits=new MemoryPermitStore(),attempts=new MemoryAttemptStore(),entitlements=new InMemoryBrokerAccountEntitlementStore();entitlements.put(entitlement)
  const pkg=await issueAutonomousTradePermitPackage({permitStore:permits,request,authority,mandate:m,intent:i,risk,plan,preflight,entitlement,authorizedAt:t.childAuthorized,permitExpiresAt:t.permitExpiry,permitId:'permit-exec',nonce:'nonce-exec'})
  const canary=new InMemoryLiveCanaryStateStore()
  const metric:LiveRiskMetricSnapshot={snapshotId:'live-risk-1',provider:'broker-x',accountId:'acct-1',currency:'USD',grossExposureMinor:5000n,realizedPnlMinor:0n,observedAt:t.childRequest,availableAt:t.childRequest,evidenceIds:['live-risk'],authority:'EVIDENCE_ONLY'}
  canary.updateRiskMetrics(metric,'2026-09-21',t.execute)
  const policy:LiveCanaryPolicy={policyId:'auto-canary',currency:'USD',maxOrderNotionalMinor:10000n,maxDailySubmittedNotionalMinor:50000n,maxDailyOrders:5,maxDailyRealizedLossMinor:5000n,maxGrossExposureMinor:30000n,maxOpenUnknownExecutions:0,maxRiskMetricAgeSeconds:300,authority:'RISK_POLICY_ONLY'}
  let executionMode=''
  const adapter:ManualLiveBrokerAdapter={provider:'broker-x',environment:'LIVE',async submitOrder(context){executionMode=context.executionMode;assert.equal(context.executionMode,'AUTONOMOUS');if(context.executionMode==='AUTONOMOUS')assert.equal(context.mandateId,m.mandateId);return{providerReference:'provider-1',providerEventId:'event-1',state:'ACKNOWLEDGED',occurredAt:t.execute,observedAt:t.execute,receivedAt:t.execute,availableAt:t.execute,evidenceIds:['provider:ack']}}}
  const result=await executeAutonomousLiveTrade({adapter,permitStore:permits,attemptStore:attempts,entitlementStore:entitlements,canaryStore:canary,canaryPolicy:policy,mandate:m,package:pkg,plan,now:t.execute,commandId:'auto-command-1',attemptIdFactory:()=> 'attempt-auto-1'})
  assert.equal(executionMode,'AUTONOMOUS');assert.equal(result.state,'SUBMITTED');assert.equal(permits.get('permit-exec')?.state,'CONSUMED')
  await assert.rejects(()=>executeAutonomousLiveTrade({adapter,permitStore:permits,attemptStore:attempts,entitlementStore:entitlements,canaryStore:canary,canaryPolicy:policy,mandate:m,package:pkg,plan,now:t.execute,commandId:'auto-command-replay',attemptIdFactory:()=> 'attempt-auto-2'}),/Permit is not executable|Permit replay|EXECUTION_PERMIT/)
})

test('AUTO.7 manual mode remains semantically separate and rejects autonomous trigger substitution',()=>{
  assert.throws(()=>assertManualTrigger({triggerId:'x',kind:'EXPLICIT_HUMAN_EXECUTE',userId:'user-1',approvalReceiptId:'approval-auto-1',confirmedAt:t.execute,source:'AUTONOMOUS_MODEL' as never},{userId:'user-1',approvalReceiptId:'approval-auto-1',notBefore:t.childRequest,notAfter:t.expiry}),/AUTONOMOUS_TRIGGER_FORBIDDEN/)
})

test('AUTO.8 durable mandate schema is service-role-only and model-unwritable',()=>{
  const migration=readFileSync(fileURLToPath(new URL('../migrations/014_autonomous_trading_mandates.sql',import.meta.url)),'utf8')
  assert.match(migration,/REVOKE ALL ON money_autonomous_trading_mandates FROM authenticated/)
  assert.match(migration,/GRANT SELECT, INSERT, UPDATE, DELETE ON money_autonomous_trading_mandates TO service_role/)
  assert.match(migration,/FORCE ROW LEVEL SECURITY/)
  assert.match(migration,/approval_receipt_id TEXT NOT NULL/)
})

test('MONEY-AUTO.FINAL certification requires all autonomous safety invariants',()=>{
  const names=['explicit-mandate-approval','action-core-child-authority','mandate-expiry-revocation','instrument-strategy-allowlists','order-daily-loss-exposure-limits','drawdown-leverage-confidence-veto','opening-short-policy','paper-shadow-promotion-is-review-only','single-use-child-permit','provider-account-entitlement','unknown-execution-block','kill-switch-halts-permits','manual-mode-preserved','model-cannot-mutate-hard-limits','cross-domain-learning-no-authority']
  const cases:AutonomousCertificationCase[]=names.map(name=>({name,passed:true,evidenceIds:['test:'+name]}))
  const report=certifyMoneyAuto({cases});assert.equal(report.passed,true);assert.equal(report.autonomousTradingEnabled,true);assert.equal(report.hardRiskLimitsMutableByModel,false)
  assert.equal(certifyMoneyAuto({cases:cases.filter(c=>c.name!=='single-use-child-permit')}).passed,false)
})
