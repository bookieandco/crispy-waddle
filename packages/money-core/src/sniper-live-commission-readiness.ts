/** SHARK-SNIPER.LIVE-COMMISSION.47-.50
 * Pure acceptance/approval packet. No connector, wallet or signer methods.
 */
export const REQUIRED_SHADOW_TABLES=Object.freeze([
 'money_shark_shadow_decisions','money_shark_shadow_executions',
 'money_shark_shadow_observations','money_shark_shadow_lessons',
 'money_shark_shadow_memory','money_shark_sniper_intel_archive',
] as const)
export type SniperCommissionEvidence=Readonly<{
 asOf:string
 ownerWalletConnectionId:string
 isolatedCofferWalletConnectionId:string
 ownerAuthenticatedIphoneVerified:boolean
 privatePreviewUnauthorizedUserDenied:boolean
 trustedSignerHostIsolated:boolean
 trustedRpcProofsVerified:boolean
 signerMessageRevalidationPassed:boolean
 atomicSignerPermitReservationPassed:boolean
 signerRevocationDrillPassed:boolean
 crashRecoveryUnknownSettlementDrillPassed:boolean
 signerLiveDisabled:boolean
 canaryBudgetOwnerApprovalRecorded:boolean
 prospectiveHeliusLaunches:number
 independentlyVerifiedLaunches:number
 originalPairQuotePairs:number
 verifiedTwoSidedSellPaths:number
 sampledConfirmedExitSettlements:number
 realSourceLatencyMeasured:boolean
 shadowTablesPresent:readonly string[]
 riskMetricAgeMs?:number
 ownerFundingAuthorizationId?:string
 evidenceIds:readonly string[]
}>
export type SniperLiveCanaryApprovalPacket=Readonly<{
 version:'SHARK-SNIPER.LIVE-COMMISSION.50'
 status:'BLOCKED'|'READY_FOR_SEPARATE_OWNER_REVIEW'
 blockers:readonly string[]
 observedLaunches:number
 independentlyVerifiedLaunches:number
 originalPairQuotePairs:number
 verifiedTwoSidedSellPaths:number
 realConfirmedExits:number
 missingShadowTables:readonly string[]
 proposedTotalCapMinor?:bigint
 proposedOrderCapMinor?:bigint
 proposedDailyLossStopMinor?:bigint
 ownerWalletConnectionId:string;cofferWalletConnectionId:string
 moneyMovement:'DISABLED'
 canSign:false;canSubmit:false;canFund:false;canTrade:false
 canCreditPurse:false
 ownerLiveApprovalRequired:true
 authority:'APPROVAL_PACKET_ONLY'
}>
const goodInteger=(n:number)=>Number.isSafeInteger(n)&&n>=0
const requireTest=(yes:boolean,name:string,reasons:string[])=>{
 if(!yes)reasons.push(name)
}
/** Counts must be prospective market observations; not test fixtures or
 * selective profitable samples. Never assume 0.6s from coarse timestamps. */
export function prepareSniperMainnetCanaryApproval(input:{
 evidence:SniperCommissionEvidence
 proposed?:Readonly<{
  totalMinor:bigint;orderMinor:bigint;dailyLossStopMinor:bigint
 }>
}):SniperLiveCanaryApprovalPacket{
 const e=input.evidence,reasons:string[]=[]
 if(!Number.isFinite(Date.parse(e.asOf))||
    [e.prospectiveHeliusLaunches,e.independentlyVerifiedLaunches,
     e.originalPairQuotePairs,e.verifiedTwoSidedSellPaths,
     e.sampledConfirmedExitSettlements].some(n=>!goodInteger(n))||
    e.riskMetricAgeMs!==undefined&&(!goodInteger(e.riskMetricAgeMs))) {
  throw Error('SNIPER_CANARY_PACKET_EVIDENCE_INVALID')
 }
 requireTest(e.ownerWalletConnectionId.trim().length>0&&
  e.isolatedCofferWalletConnectionId.trim().length>0&&
  e.ownerWalletConnectionId!==e.isolatedCofferWalletConnectionId,
  'OWNER_COFFFER_WALLET_ISOLATION_UNVERIFIED',reasons)
 requireTest(e.ownerAuthenticatedIphoneVerified,'IPHONE_OWNER_SESSION_UNVERIFIED',reasons)
 requireTest(e.privatePreviewUnauthorizedUserDenied,'PREVIEW_ACCESS_DENIAL_UNVERIFIED',reasons)
 requireTest(e.trustedSignerHostIsolated,'TRUSTED_SIGNER_NOT_COMMISSIONED',reasons)
 requireTest(e.trustedRpcProofsVerified,'TRUSTED_SOLANA_RPC_NOT_CERTIFIED',reasons)
 requireTest(e.signerMessageRevalidationPassed,'SIGNER_BYTES_NOT_REATTESTED',reasons)
 requireTest(e.atomicSignerPermitReservationPassed,'DISTRIBUTED_ATOMIC_SIGNER_GATE_UNCERTIFIED',reasons)
 requireTest(e.signerRevocationDrillPassed,'SIGNER_REVOCATION_DRILL_MISSING',reasons)
 requireTest(e.crashRecoveryUnknownSettlementDrillPassed,'UNKNOWN_SETTLEMENT_RESTART_UNCERTIFIED',reasons)
 requireTest(e.signerLiveDisabled,'LIVE_SIGNING_NOT_DISABLED_DURING_ACCEPTANCE',reasons)
 requireTest(e.canaryBudgetOwnerApprovalRecorded,'OWNER_CANARY_BUDGET_APPROVAL_MISSING',reasons)
 requireTest(e.evidenceIds.length>0&&e.evidenceIds.every(x=>x.trim().length>0),
  'PROSPECTIVE_EVIDENCE_IDS_REQUIRED',reasons)
 requireTest(e.prospectiveHeliusLaunches>=100&&
  e.independentlyVerifiedLaunches>=100&&
  e.independentlyVerifiedLaunches<=e.prospectiveHeliusLaunches,
  'PROSPECTIVE_CHAIN_COHORT_UNVERIFIED',reasons)
 requireTest(e.originalPairQuotePairs>0&&e.verifiedTwoSidedSellPaths>0&&
  e.sampledConfirmedExitSettlements>0,
  'REAL_ROUTE_AND_EXIT_EVIDENCE_MISSING',reasons)
 requireTest(e.realSourceLatencyMeasured,'SOURCE_TO_EXIT_LATENCY_NOT_MEASURED',reasons)
 requireTest(e.riskMetricAgeMs!==undefined&&e.riskMetricAgeMs<=5000,
  'COFFER_RISK_METRIC_STALE',reasons)
 const missing=REQUIRED_SHADOW_TABLES.filter(name=>!e.shadowTablesPresent.includes(name))
 if(missing.length)reasons.push('CANONICAL_SHADOW_OR_SNIPER_ARCHIVE_MISSING')
 const p=input.proposed
 if(!p||p.totalMinor<=0n||p.orderMinor<=0n||p.dailyLossStopMinor<=0n||
   p.orderMinor>p.totalMinor||p.dailyLossStopMinor>p.totalMinor)
  reasons.push('EXPLICIT_BOUNDED_CAP_PROPOSAL_REQUIRED')
 // An approval packet never creates an approval or grants value movement.
 requireTest(!!e.ownerFundingAuthorizationId?.trim(),'EXPLICIT_FUNDING_APPROVAL_NOT_RECEIVED',reasons)
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-COMMISSION.50',
  status:reasons.length?'BLOCKED':'READY_FOR_SEPARATE_OWNER_REVIEW',
  blockers:Object.freeze(reasons),
  observedLaunches:e.prospectiveHeliusLaunches,
  independentlyVerifiedLaunches:e.independentlyVerifiedLaunches,
  originalPairQuotePairs:e.originalPairQuotePairs,
  verifiedTwoSidedSellPaths:e.verifiedTwoSidedSellPaths,
  realConfirmedExits:e.sampledConfirmedExitSettlements,
  missingShadowTables:Object.freeze(missing),
  ...(p?{proposedTotalCapMinor:p.totalMinor,proposedOrderCapMinor:p.orderMinor,
   proposedDailyLossStopMinor:p.dailyLossStopMinor}:{}),
  ownerWalletConnectionId:e.ownerWalletConnectionId,
  cofferWalletConnectionId:e.isolatedCofferWalletConnectionId,
  moneyMovement:'DISABLED',canSign:false,canSubmit:false,canFund:false,
  canTrade:false,canCreditPurse:false,ownerLiveApprovalRequired:true,
  authority:'APPROVAL_PACKET_ONLY',
 })
}
