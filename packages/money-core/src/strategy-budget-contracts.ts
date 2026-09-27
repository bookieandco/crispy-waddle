export type StrategyBudgetState='ACTIVE'|'HALTED'|'EXHAUSTED'

export type StrategyBudgetSnapshot=Readonly<{
 budgetId:string
 cofferId:string
 strategyId:string
 lane:string
 currency:string
 allocatedMinor:bigint
 reservedMinor:bigint
 spentMinor:bigint
 hardCapMinor:bigint
 state:StrategyBudgetState
 observedAt:string
 evidenceIds:readonly string[]
 authority:'BUDGET_EVIDENCE'
}>

export type StrategySpendReservation=Readonly<{
 reservationId:string
 budgetId:string
 amountMinor:bigint
 currency:string
 remainingAfterMinor:bigint
 createdAt:string
 expiresAt:string
 authority:'RESERVATION_ONLY'
 canExecute:false
}>

export function remainingStrategyBudget(b:StrategyBudgetSnapshot):bigint{
 if(b.allocatedMinor<0n||b.reservedMinor<0n||b.spentMinor<0n||b.hardCapMinor<0n)throw new Error('MONEY_COMMISSION1_BUDGET_NEGATIVE')
 const effectiveCap=b.allocatedMinor<b.hardCapMinor?b.allocatedMinor:b.hardCapMinor
 const remaining=effectiveCap-b.reservedMinor-b.spentMinor
 return remaining>0n?remaining:0n
}

export function assertStrategyBudgetUsable(b:StrategyBudgetSnapshot){
 if(b.authority!=='BUDGET_EVIDENCE'||!b.evidenceIds.length)throw new Error('MONEY_COMMISSION1_BUDGET_EVIDENCE_REQUIRED')
 if(b.state!=='ACTIVE')throw new Error('MONEY_COMMISSION1_BUDGET_NOT_ACTIVE')
 if(remainingStrategyBudget(b)<=0n)throw new Error('MONEY_COMMISSION1_BUDGET_EXHAUSTED')
}

export function reserveStrategySpend(input:{
 snapshot:StrategyBudgetSnapshot
 reservationId:string
 amountMinor:bigint
 createdAt:string
 expiresAt:string
}):StrategySpendReservation{
 const b=input.snapshot
 assertStrategyBudgetUsable(b)
 if(input.amountMinor<=0n)throw new Error('MONEY_COMMISSION1_RESERVATION_AMOUNT_INVALID')
 if(input.createdAt>=input.expiresAt)throw new Error('MONEY_COMMISSION1_RESERVATION_WINDOW_INVALID')
 const remaining=remainingStrategyBudget(b)
 if(input.amountMinor>remaining)throw new Error('MONEY_COMMISSION1_NO_OVERDRAFT')
 return Object.freeze({
  reservationId:input.reservationId,
  budgetId:b.budgetId,
  amountMinor:input.amountMinor,
  currency:b.currency,
  remainingAfterMinor:remaining-input.amountMinor,
  createdAt:input.createdAt,
  expiresAt:input.expiresAt,
  authority:'RESERVATION_ONLY' as const,
  canExecute:false as const,
 })
}
