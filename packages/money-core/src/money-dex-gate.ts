import { hashDexRuntime,type DexManagedOrder,type DexSwapIntent } from './solana-dex-runtime-contracts.js'

export const MONEY_DEX_GATE_VERSION='MONEY-DEX-GATE-v1' as const

export type MoneyDexGatePolicy=Readonly<{
 maxQuoteAgeMs:number
 maxSlippageBps:number
 maxPriceImpactBps:number
 minSolFeeReserveLamports:bigint
 maxConsecutiveLosses:number
}>

export type DexTokenContractAdmission=Readonly<{
 inputMint:string
 outputMint:string
 inputTokenAdmitted:boolean
 outputTokenAdmitted:boolean
 contractAdmitted:boolean
 evidenceIds:readonly string[]
 authority:'TOKEN_CONTRACT_ADMISSION_ONLY'
 canAuthorizeTrade:false
}>

export type MoneyDexGateContext=Readonly<{
 now:string
 walletSolBalanceLamports:bigint
 estimatedFeeLamports:bigint
 solSpendLamports:bigint
 consecutiveLosses:number
 admission:DexTokenContractAdmission
 evidenceIds:readonly string[]
}>

export type MoneyDexGateReceipt=Readonly<{
 gateId:string
 version:typeof MONEY_DEX_GATE_VERSION
 executionId:string
 requestId:string
 quoteProvider:DexManagedOrder['provider']
 quoteAgeMs:number
 requestedSlippageBps:number
 impliedSlippageBps:number
 priceImpactBps:number
 walletSolBalanceLamports:bigint
 estimatedFeeLamports:bigint
 solSpendLamports:bigint
 postTradeFeeReserveLamports:bigint
 consecutiveLosses:number
 passed:boolean
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 evaluatedAt:string
 authority:'MONEY_PREFLIGHT_VETO_ONLY'
 canAuthorizeTrade:false
}>

function integer(value:number,min:number,max:number,code:string):void{
 if(!Number.isInteger(value)||value<min||value>max)throw new Error(code)
}
function iso(value:string,code:string):number{
 const n=Date.parse(value)
 if(!value.trim()||Number.isNaN(n))throw new Error(code)
 return n
}
function validatePolicy(policy:MoneyDexGatePolicy):void{
 integer(policy.maxQuoteAgeMs,1,3_600_000,'MONEY_DEX_GATE_QUOTE_AGE_POLICY_INVALID')
 integer(policy.maxSlippageBps,0,10_000,'MONEY_DEX_GATE_SLIPPAGE_POLICY_INVALID')
 integer(policy.maxPriceImpactBps,0,10_000,'MONEY_DEX_GATE_PRICE_IMPACT_POLICY_INVALID')
 if(policy.minSolFeeReserveLamports<0n)throw new Error('MONEY_DEX_GATE_FEE_RESERVE_POLICY_INVALID')
 integer(policy.maxConsecutiveLosses,1,10_000,'MONEY_DEX_GATE_LOSS_POLICY_INVALID')
}

function impliedSlippageBps(order:DexManagedOrder,intent:DexSwapIntent):number{
 if(intent.minimumOutputAtomic>=order.quotedOutputAtomic)return 0
 const loss=order.quotedOutputAtomic-intent.minimumOutputAtomic
 return Number((loss*10_000n+order.quotedOutputAtomic-1n)/order.quotedOutputAtomic)
}

export function evaluateMoneyDexGate(input:{
 intent:DexSwapIntent
 order:DexManagedOrder
 policy:MoneyDexGatePolicy
 context:MoneyDexGateContext
}):MoneyDexGateReceipt{
 const {intent,order,policy,context}=input
 validatePolicy(policy)
 const now=iso(context.now,'MONEY_DEX_GATE_NOW_INVALID')
 const quoteAt=iso(order.quoteObservedAt,'MONEY_DEX_GATE_QUOTE_TIME_INVALID')
 if(context.walletSolBalanceLamports<0n||context.estimatedFeeLamports<0n||context.solSpendLamports<0n)throw new Error('MONEY_DEX_GATE_BALANCE_INPUT_INVALID')
 integer(context.consecutiveLosses,0,1_000_000,'MONEY_DEX_GATE_LOSS_COUNT_INVALID')
 if(context.admission.authority!=='TOKEN_CONTRACT_ADMISSION_ONLY'||context.admission.canAuthorizeTrade!==false)throw new Error('MONEY_DEX_GATE_ADMISSION_AUTHORITY_INVALID')
 if(context.admission.inputMint!==intent.inputMint||context.admission.outputMint!==intent.outputMint)throw new Error('MONEY_DEX_GATE_ADMISSION_MINT_MISMATCH')
 if(!context.admission.evidenceIds.length)throw new Error('MONEY_DEX_GATE_ADMISSION_EVIDENCE_REQUIRED')
 if(!context.evidenceIds.length)throw new Error('MONEY_DEX_GATE_CONTEXT_EVIDENCE_REQUIRED')

 const reasons:string[]=[]
 const quoteAgeMs=now-quoteAt
 if(quoteAgeMs<0)reasons.push('MONEY_DEX_GATE_QUOTE_FROM_FUTURE')
 if(quoteAgeMs>policy.maxQuoteAgeMs)reasons.push('MONEY_DEX_GATE_STALE_QUOTE')
 if(order.quotedOutputAtomic<intent.minimumOutputAtomic)reasons.push('MONEY_DEX_GATE_MINIMUM_OUTPUT_UNSATISFIED')
 const implied=impliedSlippageBps(order,intent)
 if(intent.requestedSlippageBps>policy.maxSlippageBps||implied>policy.maxSlippageBps)reasons.push('MONEY_DEX_GATE_SLIPPAGE_CEILING')
 if(order.priceImpactBps>policy.maxPriceImpactBps)reasons.push('MONEY_DEX_GATE_PRICE_IMPACT_CEILING')
 const required=context.estimatedFeeLamports+context.solSpendLamports
 const reserve=context.walletSolBalanceLamports>=required?context.walletSolBalanceLamports-required:-1n
 if(reserve<policy.minSolFeeReserveLamports)reasons.push('MONEY_DEX_GATE_SOL_FEE_RESERVE')
 if(context.consecutiveLosses>=policy.maxConsecutiveLosses)reasons.push('MONEY_DEX_GATE_CONSECUTIVE_LOSS_HALT')
 if(!context.admission.inputTokenAdmitted)reasons.push('MONEY_DEX_GATE_INPUT_TOKEN_NOT_ADMITTED')
 if(!context.admission.outputTokenAdmitted)reasons.push('MONEY_DEX_GATE_OUTPUT_TOKEN_NOT_ADMITTED')
 if(!context.admission.contractAdmitted)reasons.push('MONEY_DEX_GATE_CONTRACT_NOT_ADMITTED')
 const reasonCodes=Object.freeze([...new Set(reasons)])
 const evidenceIds=Object.freeze([...new Set([...intent.evidenceIds,...order.evidenceIds,...context.admission.evidenceIds,...context.evidenceIds])].sort())
 const stable={
  version:MONEY_DEX_GATE_VERSION,executionId:intent.executionId,requestId:order.requestId,quoteProvider:order.provider,quoteAgeMs,
  requestedSlippageBps:intent.requestedSlippageBps,impliedSlippageBps:implied,priceImpactBps:order.priceImpactBps,
  walletSolBalanceLamports:context.walletSolBalanceLamports,estimatedFeeLamports:context.estimatedFeeLamports,solSpendLamports:context.solSpendLamports,
  postTradeFeeReserveLamports:reserve,consecutiveLosses:context.consecutiveLosses,reasonCodes,evidenceIds,evaluatedAt:context.now,
 }
 return Object.freeze({
  gateId:'money:dex-gate:'+hashDexRuntime(stable),
  ...stable,
  passed:reasonCodes.length===0,
  authority:'MONEY_PREFLIGHT_VETO_ONLY' as const,
  canAuthorizeTrade:false as const,
 })
}

export function assertMoneyDexGatePassed(receipt:MoneyDexGateReceipt):void{
 if(receipt.version!==MONEY_DEX_GATE_VERSION||receipt.authority!=='MONEY_PREFLIGHT_VETO_ONLY'||receipt.canAuthorizeTrade!==false)throw new Error('MONEY_DEX_GATE_RECEIPT_INVALID')
 if(!receipt.passed||receipt.reasonCodes.length)throw new Error('MONEY_DEX_GATE_BLOCKED:'+receipt.reasonCodes.join(','))
}
