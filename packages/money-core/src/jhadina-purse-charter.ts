import { createHash } from 'node:crypto'
import { MONEY_STRATEGY_LANES, type MoneyStrategyLane } from './money-commissioning-contracts.js'

export type PurseAutonomyMode='ADVISORY'|'PAPER_AUTONOMOUS'|'SHADOW_AUTONOMOUS'|'LIVE_GOVERNED_INTENTS'

export type PurseLanePolicy=Readonly<{
 lane:MoneyStrategyLane
 enabled:boolean
 maxAllocationBps:number
 maxSinglePositionBps:number
 minConfidenceBps:number
}>

export type JhadinaPurseCharter=Readonly<{
 charterId:string
 charterVersion:string
 userId:string
 cofferId:string
 reportingCurrency:string
 autonomyMode:PurseAutonomyMode
 maxTotalDeployableBps:number
 minLiquidReserveMinor:bigint
 minEmergencyReserveMinor:bigint
 maxSingleOpportunityBps:number
 maxCorrelatedExposureBps:number
 maxRebalanceTurnoverBps:number
 lanePolicies:readonly PurseLanePolicy[]
 verifiedOwnerPayoutDestinationId:string
 ownerProfitSweepProtected:true
 charterMutationRequiresOwnerApproval:true
 ownerDestinationMutationRequiresOwnerApproval:true
 jhadinaMayAllocate:true
 jhadinaMayRebalance:true
 effectiveAt:string
 expiresAt?:string
 evidenceIds:readonly string[]
 authority:'OWNER_TREASURY_CHARTER'
 canExecute:false
}>

export type PurseCharterDecisionBoundary=Readonly<{
 charterId:string
 userId:string
 cofferId:string
 autonomyMode:PurseAutonomyMode
 enabledLanes:readonly MoneyStrategyLane[]
 maxTotalDeployableBps:number
 minProtectedReserveMinor:bigint
 ownerPayoutDestinationId:string
 ownerSweepProtected:true
 canChangeOwnCharter:false
 canChangeOwnerDestination:false
 canDisableOwnerSweep:false
 authority:'CHARTER_BOUNDARY_ONLY'
 canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const bps=(n:number,code:string)=>{if(!Number.isInteger(n)||n<0||n>10000)throw new Error(code)}
const nonEmpty=(v:string,code:string)=>{if(!v.trim())throw new Error(code)}
const iso=(v:string|undefined,code:string)=>{if(v!==undefined&&Number.isNaN(Date.parse(v)))throw new Error(code)}

export function assertJhadinaPurseCharter(c:JhadinaPurseCharter,now?:string):void{
 for(const [v,code] of [
  [c.charterId,'PURSE_CHARTER_ID_REQUIRED'],
  [c.charterVersion,'PURSE_CHARTER_VERSION_REQUIRED'],
  [c.userId,'PURSE_CHARTER_USER_REQUIRED'],
  [c.cofferId,'PURSE_CHARTER_COFFER_REQUIRED'],
  [c.reportingCurrency,'PURSE_CHARTER_CURRENCY_REQUIRED'],
  [c.verifiedOwnerPayoutDestinationId,'PURSE_OWNER_PAYOUT_DESTINATION_REQUIRED'],
 ] as const) nonEmpty(v,code)
 if(c.authority!=='OWNER_TREASURY_CHARTER'||c.canExecute!==false)throw new Error('PURSE_CHARTER_AUTHORITY_INVALID')
 if(c.ownerProfitSweepProtected!==true||c.charterMutationRequiresOwnerApproval!==true||c.ownerDestinationMutationRequiresOwnerApproval!==true)throw new Error('PURSE_OWNER_PROTECTION_REQUIRED')
 if(c.jhadinaMayAllocate!==true||c.jhadinaMayRebalance!==true)throw new Error('PURSE_AUTONOMY_FLAGS_REQUIRED')
 bps(c.maxTotalDeployableBps,'PURSE_MAX_DEPLOYABLE_INVALID')
 bps(c.maxSingleOpportunityBps,'PURSE_MAX_OPPORTUNITY_INVALID')
 bps(c.maxCorrelatedExposureBps,'PURSE_MAX_CORRELATION_INVALID')
 bps(c.maxRebalanceTurnoverBps,'PURSE_MAX_TURNOVER_INVALID')
 if(c.minLiquidReserveMinor<0n||c.minEmergencyReserveMinor<0n)throw new Error('PURSE_RESERVE_NEGATIVE')
 if(!c.lanePolicies.length)throw new Error('PURSE_LANE_POLICIES_REQUIRED')
 const seen=new Set<string>()
 for(const p of c.lanePolicies){
  if(!MONEY_STRATEGY_LANES.includes(p.lane))throw new Error('PURSE_LANE_INVALID')
  if(seen.has(p.lane))throw new Error('PURSE_LANE_DUPLICATE')
  seen.add(p.lane)
  bps(p.maxAllocationBps,'PURSE_LANE_ALLOCATION_INVALID')
  bps(p.maxSinglePositionBps,'PURSE_LANE_POSITION_INVALID')
  bps(p.minConfidenceBps,'PURSE_LANE_CONFIDENCE_INVALID')
  if(p.maxSinglePositionBps>p.maxAllocationBps)throw new Error('PURSE_POSITION_EXCEEDS_LANE_CAP')
 }
 iso(c.effectiveAt,'PURSE_EFFECTIVE_TIME_INVALID')
 iso(c.expiresAt,'PURSE_EXPIRY_TIME_INVALID')
 if(c.expiresAt&&c.expiresAt<=c.effectiveAt)throw new Error('PURSE_CHARTER_WINDOW_INVALID')
 if(now){
  iso(now,'PURSE_NOW_INVALID')
  if(now<c.effectiveAt||c.expiresAt&&now>=c.expiresAt)throw new Error('PURSE_CHARTER_INACTIVE')
 }
 if(!c.evidenceIds.length)throw new Error('PURSE_CHARTER_EVIDENCE_REQUIRED')
}

export function buildPurseCharterBoundary(c:JhadinaPurseCharter,now:string):PurseCharterDecisionBoundary{
 assertJhadinaPurseCharter(c,now)
 return Object.freeze({
  charterId:c.charterId,userId:c.userId,cofferId:c.cofferId,autonomyMode:c.autonomyMode,
  enabledLanes:Object.freeze(c.lanePolicies.filter(x=>x.enabled).map(x=>x.lane)),
  maxTotalDeployableBps:c.maxTotalDeployableBps,
  minProtectedReserveMinor:c.minLiquidReserveMinor+c.minEmergencyReserveMinor,
  ownerPayoutDestinationId:c.verifiedOwnerPayoutDestinationId,
  ownerSweepProtected:true,
  canChangeOwnCharter:false,
  canChangeOwnerDestination:false,
  canDisableOwnerSweep:false,
  authority:'CHARTER_BOUNDARY_ONLY',
  canExecute:false,
 })
}

export function fingerprintPurseCharter(c:JhadinaPurseCharter):string{
 assertJhadinaPurseCharter(c)
 return hash(c)
}
