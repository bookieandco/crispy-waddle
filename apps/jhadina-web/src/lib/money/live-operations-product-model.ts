import type { LiveOperationsConsoleModel } from "@jhadina/money-core"

export type MoneyApprovalUiState="NOT_REQUESTED"|"PENDING"|"APPROVED"|"REJECTED"|"EXPIRED"
export type MoneyExecutionUiState="NOT_SUBMITTED"|"SUBMITTED"|"PARTIALLY_FILLED"|"FILLED"|"REJECTED"|"CANCELLED"|"UNKNOWN"
export type MoneyLiveOperationsProductModel=Readonly<{
 mode:"MANUAL_CANARY_ONLY"
 provider:string
 accountId:string
 instrumentId:string
 side:"BUY"|"SELL"
 notionalMinor:string
 currency:string
 approvalState:MoneyApprovalUiState
 executionState:MoneyExecutionUiState
 blockReasons:readonly string[]
 approveEnabled:boolean
 executeEnabled:boolean
 emergencyStopEnabled:true
 requiresSeparateApprovalAndExecute:true
 unknownRequiresReconciliation:boolean
 authority:"UI_ONLY"
 canExecute:false
}>
export function buildMoneyLiveOperationsProductModel(input:{core:LiveOperationsConsoleModel;approvalState:MoneyApprovalUiState;executionState:MoneyExecutionUiState}):MoneyLiveOperationsProductModel{const reasons=[...input.core.blockReasons];if(input.approvalState==="REJECTED")reasons.push("APPROVAL_REJECTED");if(input.approvalState==="EXPIRED")reasons.push("APPROVAL_EXPIRED");if(input.executionState==="UNKNOWN")reasons.push("UNKNOWN_REQUIRES_RECONCILIATION");const approveEnabled=input.core.executeEnabled&&input.approvalState==="NOT_REQUESTED"&&input.executionState==="NOT_SUBMITTED";const executeEnabled=input.core.executeEnabled&&input.approvalState==="APPROVED"&&input.executionState==="NOT_SUBMITTED";return Object.freeze({mode:"MANUAL_CANARY_ONLY",provider:input.core.provider,accountId:input.core.accountId,instrumentId:input.core.instrumentId,side:input.core.side,notionalMinor:input.core.notionalMinor,currency:input.core.currency,approvalState:input.approvalState,executionState:input.executionState,blockReasons:Object.freeze([...new Set(reasons)]),approveEnabled,executeEnabled,emergencyStopEnabled:true,requiresSeparateApprovalAndExecute:true,unknownRequiresReconciliation:input.executionState==="UNKNOWN",authority:"UI_ONLY",canExecute:false})}
