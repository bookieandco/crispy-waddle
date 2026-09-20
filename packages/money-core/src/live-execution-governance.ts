import type { ExecutionAttempt,ExecutionAttemptStore } from './execution-attempt.js'
import { buildExecutionOutbox,buildJournalPostingIntents,createExecutionReceipt,reconcileProviderEvent } from './execution-receipt-engine.js'
import type { ExecutionReceipt,ExecutionReconciliationDecision,FinancialOutboxRecord,JournalPostingIntent,ProviderExecutionEvent,ProviderExecutionEventState } from './execution-receipt-contracts.js'
import type { PermitStore } from './execution-permit.js'
import type { ExecutionPlan } from './execution-planning-contracts.js'
import type { LiveExecutionPreflight } from './live-preflight-contracts.js'
import type { PaperExecutionOutcome } from './paper-execution-contracts.js'
import type { ShadowExecutionComparison } from './shadow-market-contracts.js'
import type { BrokerAccountEntitlementStore } from './broker-account-entitlement.js'
import type { LiveTradePermitPackage } from './live-trade-approval-bridge.js'
import { executeManualLiveTrade,type ManualLiveExecutionResult } from './manual-live-broker-executor.js'
import type { ManualLiveBrokerAdapter,ManualLiveExecutionTrigger } from './manual-live-broker-contracts.js'
import { activateLiveKillSwitch,assertCanaryPolicy,assertRiskMetricSnapshot,type CanaryReservation,type LiveCanaryPolicy,type LiveCanaryStateStore,type LiveRiskMetricSnapshot } from './live-canary-contracts.js'

export type CanaryGovernedLiveExecutionResult=Readonly<{execution:ManualLiveExecutionResult;reservation:CanaryReservation;tradingDate:string;authority:'CANARY_GOVERNED_MANUAL_LIVE';autonomous:false}>
export type LiveExecutionTruthProjection=Readonly<{executionId:string;receipt:ExecutionReceipt;reconciliation:ExecutionReconciliationDecision;postingIntents:readonly JournalPostingIntent[];outbox:readonly FinancialOutboxRecord[];terminal:boolean;authority:'EVIDENCE_ONLY'}>
export type ExecutionRealityComparison=Readonly<{comparisonId:string;executionPlanId:string;paperOutcomeId?:string;shadowComparisonIds:readonly string[];providerEventIds:readonly string[];actualTerminalState:ProviderExecutionEventState;actualFillEvents:number;actualUnknown:boolean;paperFillRateBps?:number;shadowAverageAbsPriceDriftBps?:number;authority:'LEARNING_ONLY';canAuthorizeLive:false}>
export type Money050CertificationCase=Readonly<{caseId:string;name:string;passed:boolean;evidenceIds:readonly string[]}>
export type Money050CertificationReport=Readonly<{reportId:string;cases:readonly Money050CertificationCase[];passed:boolean;liveMode:'MANUAL_ONLY';autonomousTradingEnabled:false;authority:'CERTIFICATION_ONLY'}>

const hash=(v:unknown)=>{let h=2166136261;const s=JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
const day=(iso:string)=>{if(Number.isNaN(Date.parse(iso)))throw new Error('MONEY_050_TIME_INVALID');return new Date(iso).toISOString().slice(0,10)}

export async function executeCanaryGovernedLiveTrade(input:{adapter:ManualLiveBrokerAdapter;permitStore:PermitStore;attemptStore:ExecutionAttemptStore;entitlementStore:BrokerAccountEntitlementStore;canaryStore:LiveCanaryStateStore;policy:LiveCanaryPolicy;riskMetrics:LiveRiskMetricSnapshot;permitPackage:LiveTradePermitPackage;preflight:LiveExecutionPreflight;plan:ExecutionPlan;trigger:ManualLiveExecutionTrigger;now:string;attemptIdFactory?:()=>string}):Promise<CanaryGovernedLiveExecutionResult>{
 assertCanaryPolicy(input.policy);assertRiskMetricSnapshot(input.riskMetrics,{provider:input.permitPackage.action.provider,accountId:input.permitPackage.action.accountId!,currency:input.plan.notional.currency,cutoff:input.now})
 const tradingDate=day(input.now);await input.canaryStore.updateRiskMetrics(input.riskMetrics,tradingDate,input.now)
 const reserved=await input.canaryStore.reserve({provider:input.permitPackage.action.provider,accountId:input.permitPackage.action.accountId!,tradingDate,currency:input.plan.notional.currency,notionalMinor:input.plan.notional.minor,side:input.plan.side,policy:input.policy,now:input.now})
 if(!reserved.allowed)throw new Error('MONEY_050_CANARY_BLOCK:'+reserved.reasonCodes.join(','))
 try{const execution=await executeManualLiveTrade({adapter:input.adapter,permitStore:input.permitStore,attemptStore:input.attemptStore,entitlementStore:input.entitlementStore,permitPackage:input.permitPackage,preflight:input.preflight,plan:input.plan,trigger:input.trigger,now:input.now,attemptIdFactory:input.attemptIdFactory});if(execution.state==='UNKNOWN')await input.canaryStore.markUnknown(input.permitPackage.action.provider,input.permitPackage.action.accountId!,tradingDate,execution.attempt.attemptId,input.now);return Object.freeze({execution,reservation:reserved.reservation,tradingDate,authority:'CANARY_GOVERNED_MANUAL_LIVE',autonomous:false})}catch(error){await input.canaryStore.release(reserved.reservation,input.now);throw error}
}

export async function applyLiveExecutionTruth(input:{attempt:ExecutionAttempt;event:ProviderExecutionEvent;priorEvents:readonly ProviderExecutionEvent[];recordedAt:string;canaryStore?:LiveCanaryStateStore;accountId?:string}):Promise<LiveExecutionTruthProjection>{
 const reconciliation=reconcileProviderEvent({attempt:input.attempt,event:input.event,priorEvents:input.priorEvents}),receipt=createExecutionReceipt(input.event,input.recordedAt),postingIntents=buildJournalPostingIntents(input.event),outbox=buildExecutionOutbox(input.event,receipt,input.recordedAt),terminal=['FILLED','REJECTED','CANCELLED'].includes(input.event.state)
 if(input.canaryStore&&input.accountId){const tradingDate=day(input.attempt.startedAt);if(input.event.state==='UNKNOWN')await input.canaryStore.markUnknown(input.attempt.provider,input.accountId,tradingDate,input.attempt.attemptId,input.recordedAt);else if(terminal)await input.canaryStore.resolveUnknown(input.attempt.provider,input.accountId,tradingDate,input.attempt.attemptId,input.recordedAt)}
 return Object.freeze({executionId:input.attempt.attemptId,receipt,reconciliation,postingIntents,outbox,terminal,authority:'EVIDENCE_ONLY'})
}

export function comparePlannedPaperShadowActual(input:{plan:ExecutionPlan;paper?:PaperExecutionOutcome;shadow?:readonly ShadowExecutionComparison[];events:readonly ProviderExecutionEvent[]}):ExecutionRealityComparison{
 if(input.paper&&input.paper.executionPlanId!==input.plan.executionPlanId)throw new Error('MONEY_050_PAPER_PLAN_MISMATCH');const shadow=(input.shadow??[]).filter(x=>x.executionPlanId===input.plan.executionPlanId),events=[...input.events].sort((a,b)=>a.availableAt.localeCompare(b.availableAt)||a.eventId.localeCompare(b.eventId));if(!events.length)throw new Error('MONEY_050_ACTUAL_EVIDENCE_REQUIRED');const last=events.at(-1)!,fillEvents=events.filter(x=>x.state==='FILLED'||x.state==='PARTIALLY_FILLED'),avgShadow=shadow.length?Math.round(shadow.reduce((n,x)=>n+Math.abs(x.priceDriftBps),0)/shadow.length):undefined;return Object.freeze({comparisonId:'money-050-reality:'+hash({plan:input.plan.executionPlanId,paper:input.paper?.outcomeId,shadow:shadow.map(x=>x.comparisonId),events:events.map(x=>x.eventId)}),executionPlanId:input.plan.executionPlanId,paperOutcomeId:input.paper?.outcomeId,shadowComparisonIds:Object.freeze(shadow.map(x=>x.comparisonId).sort()),providerEventIds:Object.freeze(events.map(x=>x.eventId)),actualTerminalState:last.state,actualFillEvents:fillEvents.length,actualUnknown:events.some(x=>x.state==='UNKNOWN'),paperFillRateBps:input.paper?.fillRateBps,shadowAverageAbsPriceDriftBps:avgShadow,authority:'LEARNING_ONLY',canAuthorizeLive:false})
}

export async function activateMoney050KillSwitch(input:{store:LiveCanaryStateStore;permitStore:PermitStore;provider:string;accountId:string;now:string;reason:string}){return activateLiveKillSwitch({...input,tradingDate:day(input.now)})}

export function certifyMoney050(input:{cases:readonly Money050CertificationCase[]}):Money050CertificationReport{const required=['atomic-canary-reservation','max-order-limit','daily-notional-order-limits','daily-loss-limit','gross-exposure-limit','unknown-blocks-next-order','kill-switch-halts-permits','receipt-reconciliation-truth','planned-paper-shadow-actual','manual-only-no-autonomy'],names=new Set(input.cases.filter(x=>x.passed).map(x=>x.name)),passed=required.every(x=>names.has(x))&&input.cases.every(x=>x.passed);return Object.freeze({reportId:'money-050-cert:'+hash({cases:input.cases,required}),cases:Object.freeze([...input.cases]),passed,liveMode:'MANUAL_ONLY',autonomousTradingEnabled:false,authority:'CERTIFICATION_ONLY'})}
