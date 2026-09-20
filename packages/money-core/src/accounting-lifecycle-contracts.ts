import type{ExactMoney}from'./canonical-financial-state.js'
export type OrderState='PROPOSED'|'AUTHORIZED'|'SUBMITTED'|'ACKNOWLEDGED'|'PARTIALLY_FILLED'|'FILLED'|'REJECTED'|'CANCEL_REQUESTED'|'CANCELLED'|'EXPIRED'|'EXTERNALLY_CANCELLED'|'BROKER_ERROR'|'UNKNOWN'
export interface Fill{fillId:string;orderId:string;instrumentId:string;quantity:string;price:ExactMoney;executedAt:string;providerExecutionId:string;feeIds:readonly string[];evidenceRefs:readonly string[]}
export type SettlementState='EXPECTED'|'PENDING'|'SETTLED'|'FAILED'|'DISPUTED'|'UNKNOWN'
export interface Settlement{settlementId:string;orderId:string;fillIds:readonly string[];status:SettlementState;expectedAt:string;actualAt?:string;evidenceRefs:readonly string[]}
export interface FinancialCost{costId:string;type:string;amount:ExactMoney;incurredAt:string;evidenceRefs:readonly string[]}
export function assertFill(f:Fill){if(!f.fillId||!f.orderId||!f.providerExecutionId||!f.evidenceRefs.length)throw new Error('MONEY_FILL_UNPROVEN')}
