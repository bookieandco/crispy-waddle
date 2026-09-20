import type{ExactMoney}from'./canonical-financial-state.js'
export type OrderState='PROPOSED'|'AUTHORIZED'|'SUBMITTED'|'ACKNOWLEDGED'|'PARTIALLY_FILLED'|'FILLED'|'REJECTED'|'CANCEL_REQUESTED'|'CANCELLED'|'EXPIRED'|'EXTERNALLY_CANCELLED'|'BROKER_ERROR'|'UNKNOWN'
export interface Fill{fillId:string;orderId:string;instrumentId:string;quantity:string;price:ExactMoney;executedAt:string;providerExecutionId:string;feeIds:readonly string[];evidenceRefs:readonly string[]}
export type SettlementState='EXPECTED'|'PENDING'|'SETTLED'|'FAILED'|'DISPUTED'|'UNKNOWN'
export interface Settlement{settlementId:string;orderId:string;fillIds:readonly string[];status:SettlementState;expectedAt:string;actualAt?:string;evidenceRefs:readonly string[]}
export interface FinancialCost{costId:string;type:string;amount:ExactMoney;incurredAt:string;evidenceRefs:readonly string[]}
export function assertFill(f:Fill){if(!f.fillId||!f.orderId||!f.providerExecutionId||!f.evidenceRefs.length)throw new Error('MONEY_FILL_UNPROVEN')}

export function createFill(f:Fill):Fill{assertFill(f);return Object.freeze({...f,feeIds:Object.freeze([...f.feeIds]),evidenceRefs:Object.freeze([...f.evidenceRefs])})}
export function assertSettlement(s:Settlement){if(!s.settlementId||!s.orderId||!s.fillIds.length||!s.evidenceRefs.length)throw new Error('MONEY_SETTLEMENT_UNPROVEN');if(s.status==='SETTLED'&&!s.actualAt)throw new Error('MONEY_SETTLEMENT_ACTUAL_TIME_REQUIRED')}
export function createSettlement(s:Settlement):Settlement{assertSettlement(s);return Object.freeze({...s,fillIds:Object.freeze([...s.fillIds]),evidenceRefs:Object.freeze([...s.evidenceRefs])})}
export function assertFinancialCost(c:FinancialCost){if(!c.costId||!c.type||!c.evidenceRefs.length)throw new Error('MONEY_FINANCIAL_COST_UNPROVEN');if(!c.amount.currency)throw new Error('MONEY_FINANCIAL_COST_CURRENCY_REQUIRED')}
