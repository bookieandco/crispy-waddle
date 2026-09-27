export type CofferSurvivalState='ACTIVE'|'DEFENSIVE'|'SURVIVAL'|'HALTED'|'RECAPITALIZATION_REQUIRED'

export type CofferPolicy=Readonly<{
 policyId:string
 currency:string
 principalCapitalMinor:bigint
 hardStopFloorMinor:bigint
 survivalFloorMinor:bigint
 defensiveFloorMinor:bigint
 maxDeployableBps:number
 profitSweepThresholdMinor:bigint
 profitRetainMinor:bigint
 planningReserveBps:number
 autoSweepEnabled:boolean
 verifiedOwnerDestinationId?:string
 standingSweepMandateId?:string
 authority:'OWNER_POLICY'
}>

export type CofferAccountingSnapshot=Readonly<{
 cofferId:string
 currency:string
 settledCashMinor:bigint
 unsettledCashMinor:bigint
 reservedCashMinor:bigint
 realizedGrossProfitMinor:bigint
 realizedCostsMinor:bigint
 priorSweptProfitMinor:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'ACCOUNTING_EVIDENCE'
}>

export type CofferAccountantDecision=Readonly<{
 cofferId:string
 survivalState:CofferSurvivalState
 spendableCashMinor:bigint
 deployableCashMinor:bigint
 netRealizedProfitMinor:bigint
 planningReserveMinor:bigint
 sweepableProfitMinor:bigint
 proposedSweepMinor:bigint
 sweepStatus:'DISABLED'|'BELOW_THRESHOLD'|'BLOCKED_FOR_SURVIVAL'|'DESTINATION_REQUIRED'|'MANDATE_REQUIRED'|'READY_FOR_GOVERNED_EXECUTION'
 destinationId?:string
 standingSweepMandateId?:string
 reasonCodes:readonly string[]
 authority:'ACCOUNTANT_DECISION_ONLY'
 canMoveMoney:false
}>

const max=(a:bigint,b:bigint)=>a>b?a:b
const min=(a:bigint,b:bigint)=>a<b?a:b

export function assertCofferPolicy(p:CofferPolicy){
 if(p.authority!=='OWNER_POLICY'||!p.policyId||!p.currency)throw new Error('MONEY_LIVE1_COFFER_POLICY_INVALID')
 const xs=[p.principalCapitalMinor,p.hardStopFloorMinor,p.survivalFloorMinor,p.defensiveFloorMinor,p.profitSweepThresholdMinor,p.profitRetainMinor]
 if(xs.some(x=>x<0n))throw new Error('MONEY_LIVE1_COFFER_POLICY_NEGATIVE')
 if(!(p.hardStopFloorMinor<=p.survivalFloorMinor&&p.survivalFloorMinor<=p.defensiveFloorMinor))throw new Error('MONEY_LIVE1_COFFER_FLOORS_INVALID')
 if(!Number.isInteger(p.maxDeployableBps)||p.maxDeployableBps<0||p.maxDeployableBps>10000)throw new Error('MONEY_LIVE1_DEPLOYABLE_BPS_INVALID')
 if(!Number.isInteger(p.planningReserveBps)||p.planningReserveBps<0||p.planningReserveBps>10000)throw new Error('MONEY_LIVE1_PLANNING_RESERVE_BPS_INVALID')
 if(p.autoSweepEnabled&&p.profitSweepThresholdMinor<=0n)throw new Error('MONEY_LIVE1_SWEEP_THRESHOLD_REQUIRED')
}

export function deriveCofferSurvivalState(spendableCashMinor:bigint,p:CofferPolicy):CofferSurvivalState{
 assertCofferPolicy(p)
 if(spendableCashMinor<=0n)return 'RECAPITALIZATION_REQUIRED'
 if(spendableCashMinor<=p.hardStopFloorMinor)return 'HALTED'
 if(spendableCashMinor<=p.survivalFloorMinor)return 'SURVIVAL'
 if(spendableCashMinor<=p.defensiveFloorMinor)return 'DEFENSIVE'
 return 'ACTIVE'
}

export function buildCofferAccountantDecision(input:{policy:CofferPolicy;snapshot:CofferAccountingSnapshot}):CofferAccountantDecision{
 const {policy:p,snapshot:s}=input
 assertCofferPolicy(p)
 if(s.authority!=='ACCOUNTING_EVIDENCE'||!s.evidenceIds.length)throw new Error('MONEY_LIVE1_ACCOUNTING_EVIDENCE_REQUIRED')
 if(s.currency!==p.currency)throw new Error('MONEY_LIVE1_COFFER_CURRENCY_MISMATCH')
 if([s.settledCashMinor,s.unsettledCashMinor,s.reservedCashMinor,s.realizedCostsMinor,s.priorSweptProfitMinor].some(x=>x<0n))throw new Error('MONEY_LIVE1_ACCOUNTING_NEGATIVE')
 const spendable=max(0n,s.settledCashMinor-s.reservedCashMinor)
 const survivalState=deriveCofferSurvivalState(spendable,p)
 const deployableBase=max(0n,spendable-p.defensiveFloorMinor)
 const deployable=deployableBase*BigInt(p.maxDeployableBps)/10000n
 const netRealized=max(0n,s.realizedGrossProfitMinor-s.realizedCostsMinor)
 const planningReserve=netRealized*BigInt(p.planningReserveBps)/10000n
 const afterPriorSweeps=max(0n,netRealized-planningReserve-s.priorSweptProfitMinor)
 const profitAfterRetain=max(0n,afterPriorSweeps-p.profitRetainMinor)
 const capitalAboveDefensive=max(0n,spendable-p.defensiveFloorMinor)
 const sweepable=min(profitAfterRetain,capitalAboveDefensive)
 const reasons:string[]=[]
 let proposed=0n
 let sweepStatus:CofferAccountantDecision['sweepStatus']='DISABLED'
 if(!p.autoSweepEnabled){reasons.push('AUTO_SWEEP_DISABLED')}
 else if(survivalState!=='ACTIVE'){sweepStatus='BLOCKED_FOR_SURVIVAL';reasons.push('COFFER_SURVIVAL_PRIORITY')}
 else if(sweepable<p.profitSweepThresholdMinor){sweepStatus='BELOW_THRESHOLD';reasons.push('PROFIT_THRESHOLD_NOT_REACHED')}
 else if(!p.verifiedOwnerDestinationId){sweepStatus='DESTINATION_REQUIRED';reasons.push('VERIFIED_OWNER_DESTINATION_REQUIRED')}
 else if(!p.standingSweepMandateId){sweepStatus='MANDATE_REQUIRED';reasons.push('STANDING_SWEEP_MANDATE_REQUIRED')}
 else{sweepStatus='READY_FOR_GOVERNED_EXECUTION';proposed=sweepable;reasons.push('REALIZED_SETTLED_PROFIT_THRESHOLD_REACHED')}
 return Object.freeze({cofferId:s.cofferId,survivalState,spendableCashMinor:spendable,deployableCashMinor:deployable,netRealizedProfitMinor:netRealized,planningReserveMinor:planningReserve,sweepableProfitMinor:sweepable,proposedSweepMinor:proposed,sweepStatus,destinationId:p.verifiedOwnerDestinationId,standingSweepMandateId:p.standingSweepMandateId,reasonCodes:Object.freeze(reasons),authority:'ACCOUNTANT_DECISION_ONLY' as const,canMoveMoney:false as const})
}
