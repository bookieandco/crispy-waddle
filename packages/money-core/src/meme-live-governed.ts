import { createHash } from 'node:crypto'
import { assertAutonomousMandateActive, type AutonomousTradingMandate } from './autonomous-trading-contracts.js'
import type { DexExecutionLadderReport } from './dex-four-stage-certification.js'
import type { DexRouterFinalReport } from './dex-router-final.js'
import type { CofferCommissionFinalReport } from './coffer-commission-final.js'
import type { SolanaDexVenueProvider } from './solana-dex-runtime-contracts.js'

export const MEME_LIVE_GOVERNED_VERSION='MEME-LIVE-GOVERNED-v1' as const

export type MemeProviderSoakEvidence=Readonly<{
 soakId:string
 evidenceClass:'REAL_LIVE'|'SYNTHETIC_TEST'
 provider:'solana-dex-router'
 walletConnectionId:string
 startedAt:string
 endedAt:string
 completedRoundTrips:number
 reconciledBroadcasts:number
 unresolvedExecutions:number
 duplicateBroadcasts:number
 unknownExecutions:number
 killSwitchDrillPassed:boolean
 restartRecoveryPassed:boolean
 allPositionsFlatAfterRoundTrips:boolean
 executionCostReconciliationPassed:boolean
 maxObservedSlippageBps:number
 venueCoverage:readonly SolanaDexVenueProvider[]
 providerReceiptIds:readonly string[]
 onchainSignatureIds:readonly string[]
 evidenceIds:readonly string[]
 authority:'SOAK_EVIDENCE_ONLY'
 canAuthorizeTrade:false
}>

export type MemeGovernedLivePolicy=Readonly<{
 minCompletedRoundTrips:number
 minSoakDurationMs:number
 maxObservedSlippageBps:number
 requiredVenueCoverage:readonly SolanaDexVenueProvider[]
 maxMandateOrderNotionalMinor:bigint
 maxMandateDailySubmittedNotionalMinor:bigint
 maxMandateDailyOrders:number
 maxMandateDailyRealizedLossMinor:bigint
 maxMandateGrossExposureMinor:bigint
}>

export type MemeGovernedLiveReport=Readonly<{
 reportId:string
 version:typeof MEME_LIVE_GOVERNED_VERSION
 status:'BLOCKED'|'MEME_GOVERNED_LIVE_ELIGIBLE'
 passed:boolean
 controlledCanaryCertified:boolean
 routerCommissioned:boolean
 cofferCommissioned:boolean
 providerSoakPassed:boolean
 ownerMandateValid:boolean
 blockerCodes:readonly string[]
 evidenceIds:readonly string[]
 mandateId?:string
 walletConnectionId?:string
 requiresExecutionPermit:true
 requiresSharkPreExecutionBinding:true
 requiresMoneyDexGate:true
 killSwitchRequired:true
 unrestrictedLiveAuthorized:false
 authority:'CERTIFICATION_ONLY'
 canExecute:false
}>

export type MemeGovernedExecutionEnvelope=Readonly<{
 envelopeId:string
 certificationReportId:string
 mandateId:string
 userId:string
 strategyId:string
 walletConnectionId:string
 provider:'solana-dex-router'
 expiresAt:string
 maxOrderNotionalMinor:bigint
 maxDailySubmittedNotionalMinor:bigint
 maxDailyOrders:number
 maxDailyRealizedLossMinor:bigint
 maxGrossExposureMinor:bigint
 requiresExecutionPermit:true
 requiresSharkPreExecutionBinding:true
 requiresMoneyDexGate:true
 killSwitchRequired:true
 unrestrictedLiveAuthorized:false
 authority:'GOVERNED_LIVE_ENVELOPE_ONLY'
 canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const unique=(values:readonly string[])=>Object.freeze([...new Set(values)].sort())
const positiveInt=(value:number)=>Number.isInteger(value)&&value>0

function validPolicy(policy:MemeGovernedLivePolicy):void{
 if(!positiveInt(policy.minCompletedRoundTrips)||!positiveInt(policy.minSoakDurationMs))throw new Error('MEME_GOVERNED_SOAK_POLICY_INVALID')
 if(!Number.isInteger(policy.maxObservedSlippageBps)||policy.maxObservedSlippageBps<0||policy.maxObservedSlippageBps>10000)throw new Error('MEME_GOVERNED_SLIPPAGE_POLICY_INVALID')
 if(!policy.requiredVenueCoverage.length||new Set(policy.requiredVenueCoverage).size!==policy.requiredVenueCoverage.length)throw new Error('MEME_GOVERNED_VENUE_POLICY_INVALID')
 if(policy.maxMandateOrderNotionalMinor<=0n||policy.maxMandateDailySubmittedNotionalMinor<=0n||policy.maxMandateDailyRealizedLossMinor<=0n||policy.maxMandateGrossExposureMinor<=0n||!positiveInt(policy.maxMandateDailyOrders))throw new Error('MEME_GOVERNED_LIMIT_POLICY_INVALID')
 if(policy.maxMandateOrderNotionalMinor>policy.maxMandateDailySubmittedNotionalMinor||policy.maxMandateOrderNotionalMinor>policy.maxMandateGrossExposureMinor)throw new Error('MEME_GOVERNED_LIMIT_POLICY_INCOHERENT')
}
function activeMandate(input:{mandate:AutonomousTradingMandate;walletConnectionId:string;strategyId:string;policy:MemeGovernedLivePolicy;now:string}):boolean{
 const {mandate:m,policy}=input
 try{assertAutonomousMandateActive(m,input.now)}catch{return false}
 if(m.provider!=='solana-dex-router'||m.accountId!==input.walletConnectionId||m.allowOpeningShorts)return false
 if(!m.allowedStrategyIds.includes(input.strategyId)||!m.allowedInstrumentPrefixes.some(prefix=>'solana:TOKEN'.startsWith(prefix)||prefix.startsWith('solana:')))return false
 return (
  m.limits.maxOrderNotionalMinor<=policy.maxMandateOrderNotionalMinor&&
  m.limits.maxDailySubmittedNotionalMinor<=policy.maxMandateDailySubmittedNotionalMinor&&
  m.limits.maxDailyOrders<=policy.maxMandateDailyOrders&&
  m.limits.maxDailyRealizedLossMinor<=policy.maxMandateDailyRealizedLossMinor&&
  m.limits.maxGrossExposureMinor<=policy.maxMandateGrossExposureMinor
 )
}

export function certifyMemeGovernedLive(input:{
 ladder:DexExecutionLadderReport
 router:DexRouterFinalReport
 coffer:CofferCommissionFinalReport
 mandate?:AutonomousTradingMandate
 strategyId:string
 soak?:MemeProviderSoakEvidence
 policy:MemeGovernedLivePolicy
 now:string
}):MemeGovernedLiveReport{
 validPolicy(input.policy)
 if(Number.isNaN(Date.parse(input.now))||!input.strategyId.trim())throw new Error('MEME_GOVERNED_INPUT_INVALID')
 const blockers:string[]=[]
 const canary=(
  input.ladder.operationallyCertified===true&&
  input.ladder.controlledLiveCanaryCertified===true&&
  input.ladder.unrestrictedLiveAuthorized===false&&
  input.ladder.reasonCodes.length===0
 )
 if(!canary)blockers.push('MEME_GOVERNED_CONTROLLED_CANARY_REQUIRED')
 const router=(
  input.router.passed===true&&input.router.status==='DEX_ROUTER_COMMISSIONED'&&
  input.router.jupiterPrimaryVerified&&input.router.raydiumDirectVerified&&input.router.meteoraDirectVerified&&
  input.router.unrestrictedLiveAuthorized===false
 )
 if(!router)blockers.push('MEME_GOVERNED_ROUTER_COMMISSION_REQUIRED')
 const coffer=(
  input.coffer.passed===true&&input.coffer.status==='COFFER_COMMISSIONED'&&input.coffer.operationalEvidence===true&&
  input.coffer.settlementFundingVerified===true&&input.coffer.unrestrictedLiveAuthorized===false
 )
 if(!coffer)blockers.push('MEME_GOVERNED_COFFER_COMMISSION_REQUIRED')

 let soakPassed=false
 const soak=input.soak
 if(!soak)blockers.push('MEME_GOVERNED_REAL_SOAK_REQUIRED')
 else{
  const start=Date.parse(soak.startedAt),end=Date.parse(soak.endedAt)
  const requiredVenues=input.policy.requiredVenueCoverage.every(v=>soak.venueCoverage.includes(v))
  soakPassed=(
   soak.evidenceClass==='REAL_LIVE'&&soak.provider==='solana-dex-router'&&soak.walletConnectionId===input.coffer.walletConnectionId&&
   !Number.isNaN(start)&&!Number.isNaN(end)&&end>=start&&end-start>=input.policy.minSoakDurationMs&&
   soak.completedRoundTrips>=input.policy.minCompletedRoundTrips&&
   soak.reconciledBroadcasts>=soak.completedRoundTrips*2&&
   soak.unresolvedExecutions===0&&soak.duplicateBroadcasts===0&&soak.unknownExecutions===0&&
   soak.killSwitchDrillPassed&&soak.restartRecoveryPassed&&soak.allPositionsFlatAfterRoundTrips&&soak.executionCostReconciliationPassed&&
   Number.isInteger(soak.maxObservedSlippageBps)&&soak.maxObservedSlippageBps>=0&&soak.maxObservedSlippageBps<=input.policy.maxObservedSlippageBps&&
   requiredVenues&&soak.providerReceiptIds.length>=soak.completedRoundTrips*2&&soak.onchainSignatureIds.length>=soak.completedRoundTrips*2&&
   soak.evidenceIds.length>0&&soak.authority==='SOAK_EVIDENCE_ONLY'&&soak.canAuthorizeTrade===false
  )
  if(!soakPassed){
   if(soak.evidenceClass!=='REAL_LIVE')blockers.push('MEME_GOVERNED_REAL_SOAK_EVIDENCE_REQUIRED')
   if(!requiredVenues)blockers.push('MEME_GOVERNED_REQUIRED_VENUE_SOAK_MISSING')
   if(soak.unresolvedExecutions||soak.duplicateBroadcasts||soak.unknownExecutions)blockers.push('MEME_GOVERNED_SOAK_EXECUTION_ANOMALY')
   if(soak.maxObservedSlippageBps>input.policy.maxObservedSlippageBps)blockers.push('MEME_GOVERNED_SOAK_SLIPPAGE_EXCEEDED')
   blockers.push('MEME_GOVERNED_SOAK_CRITERIA_NOT_MET')
  }
 }

 let mandateValid=false
 if(!input.mandate)blockers.push('MEME_GOVERNED_OWNER_MANDATE_REQUIRED')
 else{
  mandateValid=activeMandate({mandate:input.mandate,walletConnectionId:input.coffer.walletConnectionId,strategyId:input.strategyId,policy:input.policy,now:input.now})
  if(!mandateValid)blockers.push('MEME_GOVERNED_OWNER_MANDATE_INVALID_OR_EXCESSIVE')
 }
 const blockerCodes=unique(blockers)
 const evidenceIds=unique([
  ...input.ladder.stages.flatMap(x=>x.reasonCodes.length?[]:[x.stageId]),
  ...input.router.evidenceIds,
  ...input.coffer.evidenceIds,
  ...(soak?.evidenceIds??[]),
  ...(input.mandate?.evidenceIds??[]),
 ])
 const passed=blockerCodes.length===0
 return Object.freeze({
  reportId:'meme-governed-live:'+hash({version:MEME_LIVE_GOVERNED_VERSION,ladder:input.ladder.reportId,router:input.router.reportId,coffer:input.coffer.reportId,mandate:input.mandate?.mandateId??null,soak:soak?.soakId??null,policy:input.policy,now:input.now,blockerCodes}),
  version:MEME_LIVE_GOVERNED_VERSION,
  status:passed?'MEME_GOVERNED_LIVE_ELIGIBLE':'BLOCKED',
  passed,
  controlledCanaryCertified:canary,
  routerCommissioned:router,
  cofferCommissioned:coffer,
  providerSoakPassed:soakPassed,
  ownerMandateValid:mandateValid,
  blockerCodes,
  evidenceIds,
  mandateId:input.mandate?.mandateId,
  walletConnectionId:input.coffer.walletConnectionId,
  requiresExecutionPermit:true,
  requiresSharkPreExecutionBinding:true,
  requiresMoneyDexGate:true,
  killSwitchRequired:true,
  unrestrictedLiveAuthorized:false,
  authority:'CERTIFICATION_ONLY',
  canExecute:false,
 })
}

export function assertMemeGovernedLiveEligible(report:MemeGovernedLiveReport):void{
 if(report.version!==MEME_LIVE_GOVERNED_VERSION||report.authority!=='CERTIFICATION_ONLY'||report.canExecute!==false||report.unrestrictedLiveAuthorized!==false)throw new Error('MEME_GOVERNED_AUTHORITY_INVALID')
 if(!report.passed||report.status!=='MEME_GOVERNED_LIVE_ELIGIBLE'||report.blockerCodes.length)throw new Error('MEME_GOVERNED_LIVE_NOT_ELIGIBLE')
}

export function createMemeGovernedExecutionEnvelope(input:{
 report:MemeGovernedLiveReport
 mandate:AutonomousTradingMandate
 strategyId:string
 now:string
}):MemeGovernedExecutionEnvelope{
 assertMemeGovernedLiveEligible(input.report)
 assertAutonomousMandateActive(input.mandate,input.now)
 if(input.report.mandateId!==input.mandate.mandateId||input.report.walletConnectionId!==input.mandate.accountId||!input.mandate.allowedStrategyIds.includes(input.strategyId))throw new Error('MEME_GOVERNED_ENVELOPE_BINDING_MISMATCH')
 return Object.freeze({
  envelopeId:'meme-governed-envelope:'+hash({reportId:input.report.reportId,mandateId:input.mandate.mandateId,strategyId:input.strategyId,now:input.now}),
  certificationReportId:input.report.reportId,
  mandateId:input.mandate.mandateId,
  userId:input.mandate.userId,
  strategyId:input.strategyId,
  walletConnectionId:input.mandate.accountId,
  provider:'solana-dex-router',
  expiresAt:input.mandate.expiresAt,
  maxOrderNotionalMinor:input.mandate.limits.maxOrderNotionalMinor,
  maxDailySubmittedNotionalMinor:input.mandate.limits.maxDailySubmittedNotionalMinor,
  maxDailyOrders:input.mandate.limits.maxDailyOrders,
  maxDailyRealizedLossMinor:input.mandate.limits.maxDailyRealizedLossMinor,
  maxGrossExposureMinor:input.mandate.limits.maxGrossExposureMinor,
  requiresExecutionPermit:true,
  requiresSharkPreExecutionBinding:true,
  requiresMoneyDexGate:true,
  killSwitchRequired:true,
  unrestrictedLiveAuthorized:false,
  authority:'GOVERNED_LIVE_ENVELOPE_ONLY',
  canExecute:false,
 })
}
