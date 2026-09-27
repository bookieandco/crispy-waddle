export const MONEY_STRATEGY_LANES=['MEME','CRYPTO','SPORTS','STOCK','FOREX','PREDICTION','METALS'] as const
export type MoneyStrategyLane=typeof MONEY_STRATEGY_LANES[number]

export type MoneyStrategyCommissioning=Readonly<{
 lane:MoneyStrategyLane
 allocatedMinor:bigint
 hardCapMinor:bigint
}>

export type MoneyOwnerCommissioning=Readonly<{
 currency:string
 principalCapitalMinor:bigint
 hardStopFloorMinor:bigint
 survivalFloorMinor:bigint
 defensiveFloorMinor:bigint
 maxDeployableBps:number
 profitSweepThresholdMinor:bigint
 profitRetainMinor:bigint
 planningReserveBps:number
 profitSweepEnabled:boolean
 strategies:readonly MoneyStrategyCommissioning[]
 authority:'OWNER_CONFIGURATION'
 canFund:false
 canTrade:false
}>

export type MoneyCommissioningValidation=Readonly<{
 totalAllocatedMinor:bigint
 unallocatedMinor:bigint
 authority:'VALIDATION_ONLY'
}>

export function validateMoneyOwnerCommissioning(x:MoneyOwnerCommissioning):MoneyCommissioningValidation{
 if(x.authority!=='OWNER_CONFIGURATION'||x.canFund!==false||x.canTrade!==false)throw new Error('MONEY_COMMISSION2_AUTHORITY_INVALID')
 if(!/^[A-Z]{3,8}$/.test(x.currency))throw new Error('MONEY_COMMISSION2_CURRENCY_INVALID')
 const amounts=[x.principalCapitalMinor,x.hardStopFloorMinor,x.survivalFloorMinor,x.defensiveFloorMinor,x.profitSweepThresholdMinor,x.profitRetainMinor]
 if(amounts.some(v=>v<0n))throw new Error('MONEY_COMMISSION2_AMOUNT_NEGATIVE')
 if(x.principalCapitalMinor<=0n)throw new Error('MONEY_COMMISSION2_PRINCIPAL_REQUIRED')
 if(!(x.hardStopFloorMinor<=x.survivalFloorMinor&&x.survivalFloorMinor<=x.defensiveFloorMinor&&x.defensiveFloorMinor<=x.principalCapitalMinor))throw new Error('MONEY_COMMISSION2_FLOORS_INVALID')
 if(!Number.isInteger(x.maxDeployableBps)||x.maxDeployableBps<0||x.maxDeployableBps>10000)throw new Error('MONEY_COMMISSION2_DEPLOYABLE_BPS_INVALID')
 if(!Number.isInteger(x.planningReserveBps)||x.planningReserveBps<0||x.planningReserveBps>10000)throw new Error('MONEY_COMMISSION2_RESERVE_BPS_INVALID')
 if(x.profitSweepEnabled&&x.profitSweepThresholdMinor<=0n)throw new Error('MONEY_COMMISSION2_SWEEP_THRESHOLD_REQUIRED')
 if(x.profitRetainMinor>x.principalCapitalMinor)throw new Error('MONEY_COMMISSION2_RETAIN_EXCEEDS_PRINCIPAL')
 const seen=new Set<MoneyStrategyLane>()
 let total=0n
 for(const s of x.strategies){
  if(!MONEY_STRATEGY_LANES.includes(s.lane))throw new Error('MONEY_COMMISSION2_STRATEGY_LANE_INVALID')
  if(seen.has(s.lane))throw new Error('MONEY_COMMISSION2_STRATEGY_DUPLICATE')
  seen.add(s.lane)
  if(s.allocatedMinor<0n||s.hardCapMinor<0n)throw new Error('MONEY_COMMISSION2_STRATEGY_AMOUNT_NEGATIVE')
  if(s.hardCapMinor>s.allocatedMinor)throw new Error('MONEY_COMMISSION2_STRATEGY_CAP_EXCEEDS_ALLOCATION')
  total+=s.allocatedMinor
 }
 if(total>x.principalCapitalMinor)throw new Error('MONEY_COMMISSION2_ALLOCATIONS_EXCEED_PRINCIPAL')
 return Object.freeze({totalAllocatedMinor:total,unallocatedMinor:x.principalCapitalMinor-total,authority:'VALIDATION_ONLY' as const})
}
