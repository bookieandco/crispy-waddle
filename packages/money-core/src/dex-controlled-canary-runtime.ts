import type { ExecutionPermit, PermitVerificationContext, PermitStore, ExecutionAction } from './execution-permit.js'
import { consumeExecutionPermit, verifyExecutionPermit } from './execution-permit.js'
import { assertConnectorMayExecute } from './market-connector-contracts.js'
import { assertSignerLeaseMayPrepare } from './signer-lease-contracts.js'
import type { CanaryReservation, LiveCanaryPolicy, LiveCanaryStateStore } from './live-canary-contracts.js'
import { assertSharkPreExecutionBinding, type SharkPreExecutionMaterial } from './shark-preexec-binding.js'
import {
 assertMoneyDexGatePassed,
 evaluateMoneyDexGate,
 type MoneyDexGateContext,
 type MoneyDexGatePolicy,
 type MoneyDexGateReceipt,
} from './money-dex-gate.js'
import {
 assertDexSwapIntent,
 hashDexRuntime,
 type CofferSignerAdapter,
 type DexCommissioningBoundary,
 type DexExecutionAttempt,
 type DexExecutionAttemptStore,
 type DexLegReconciliation,
 type DexManagedOrder,
 type DexOnchainReceipt,
 type DexProviderExecutionReceipt,
 type DexSignedTransaction,
 type DexSimulationReceipt,
 type DexSwapIntent,
 type ManagedSolanaDexAdapter,
 type SolanaChainObserver,
} from './solana-dex-runtime-contracts.js'

export type DexCanarySubmitResult=Readonly<{
 attempt:DexExecutionAttempt
 order:DexManagedOrder
 preflight:MoneyDexGateReceipt
 signed:DexSignedTransaction
 simulation:DexSimulationReceipt
 providerReceipt:DexProviderExecutionReceipt
 reservation:CanaryReservation
 authority:'EXECUTION_RESULT_ONLY'
}>

export type DexCanaryReconcileResult=Readonly<{
 attempt:DexExecutionAttempt
 onchain:DexOnchainReceipt
 reconciliation?:DexLegReconciliation
 recoveredExisting:boolean
 authority:'RECONCILIATION_RESULT_ONLY'
}>

export type DexRestartRecoveryProof=Readonly<{
 proofId:string
 attemptId:string
 executionId:string
 previousRuntimeId:string
 recoveryRuntimeId:string
 signature:string
 recoveredState:'RECONCILED'
 observedAt:string
 evidenceIds:readonly string[]
 authority:'RECOVERY_EVIDENCE_ONLY'
}>

export function dexExecutionAction(intent:DexSwapIntent):ExecutionAction{
 return Object.freeze({
  actionId:intent.executionId,
  userId:intent.userId,
  capability:'money.trade.submit',
  provider:intent.provider,
  accountId:intent.walletConnectionId,
  instrumentId:intent.instrumentId,
  side:intent.leg==='ENTRY'?'BUY':'SELL',
  strategyId:intent.strategyId,
  amount:intent.notionalMinor.toString(),
  currency:intent.currency,
 })
}

function assertBoundary(input:{
 intent:DexSwapIntent
 boundary:DexCommissioningBoundary
 adapter:ManagedSolanaDexAdapter
 now:string
}):void{
 const {intent,boundary,adapter,now}=input
 assertDexSwapIntent(intent)
 const {connector,wallet,signerPolicy,signerLease,signerObservation}=boundary
 assertConnectorMayExecute(connector)
 if(connector.lane!=='DEX'||connector.admission!=='CONTROLLED_CANARY')throw new Error('DEX_COMMISSION_CONTROLLED_CANARY_ADMISSION_REQUIRED')
 if(connector.provider!==adapter.provider||connector.provider!==intent.provider)throw new Error('DEX_COMMISSION_PROVIDER_BINDING_MISMATCH')
 if(!connector.credentialRef?.trim()||!connector.evidenceIds.length)throw new Error('DEX_COMMISSION_PROVIDER_CREDENTIAL_REFERENCE_REQUIRED')
 if(wallet.connectionId!==intent.walletConnectionId||wallet.userId!==intent.userId||wallet.network!=='SOLANA'||wallet.mode!=='COFFER_EXECUTION_WALLET')throw new Error('DEX_COMMISSION_COFFER_WALLET_BINDING_REQUIRED')
 if(wallet.canSign!==false||wallet.authority!=='CONNECTION_ONLY'||!wallet.evidenceIds.length)throw new Error('DEX_COMMISSION_WALLET_METADATA_INVALID')
 if(signerLease.leaseId!==intent.signerLeaseId)throw new Error('DEX_COMMISSION_SIGNER_LEASE_BINDING_MISMATCH')
 if(!signerPolicy.allowedAssets.includes(intent.inputMint)||!signerPolicy.allowedAssets.includes(intent.outputMint))throw new Error('DEX_COMMISSION_SIGNER_MINT_BLOCKED')
 assertSignerLeaseMayPrepare({
  policy:signerPolicy,
  lease:signerLease,
  observation:signerObservation,
  intent:{amountMinor:intent.notionalMinor,assetId:intent.inputMint,destinationAddress:wallet.address,now},
 })
}

function reconcile(input:{
 intent:DexSwapIntent
 attempt:DexExecutionAttempt
 onchain:DexOnchainReceipt
 now:string
}):DexLegReconciliation{
 const {intent,onchain,now}=input
 const reasons:string[]=[]
 const debit=onchain.inputDebitAtomic??0n
 const credit=onchain.outputCreditAtomic??0n
 const fee=onchain.feeLamports??0n
 const attempt=input.attempt
 if(!onchain.found||!onchain.confirmed)reasons.push('DEX_ONCHAIN_CONFIRMATION_REQUIRED')
 if(onchain.failed)reasons.push('DEX_ONCHAIN_EXECUTION_FAILED')
 if(debit!==intent.inputAmountAtomic)reasons.push('DEX_INPUT_DEBIT_MISMATCH')
 if(credit<intent.minimumOutputAtomic)reasons.push('DEX_MINIMUM_OUTPUT_NOT_MET')
 if(fee<0n)reasons.push('DEX_FEE_INVALID')
 if(attempt.simulatedFeeLamports===undefined)reasons.push('DEX_SIMULATED_FEE_REQUIRED')
 else if(attempt.simulatedFeeLamports!==fee)reasons.push('DEX_FEE_MISMATCH')
 return Object.freeze({
  reconciliationId:'dex:reconcile:'+hashDexRuntime({executionId:intent.executionId,signature:onchain.signature,debit:debit.toString(),credit:credit.toString(),fee:fee.toString()}),
  executionId:intent.executionId,
  leg:intent.leg,
  passed:reasons.length===0,
  inputAmountAtomic:intent.inputAmountAtomic,
  observedInputDebitAtomic:debit,
  minimumOutputAtomic:intent.minimumOutputAtomic,
  observedOutputCreditAtomic:credit,
  feeLamports:fee,
  reasonCodes:Object.freeze(reasons),
  evidenceIds:Object.freeze([...new Set([...intent.evidenceIds,...onchain.evidenceIds])]),
  observedAt:now,
  authority:'RECONCILIATION_ONLY' as const,
 })
}

export async function submitControlledDexCanaryLeg(input:{
 intent:DexSwapIntent
 preExecutionMaterial:SharkPreExecutionMaterial
 dexGatePolicy:MoneyDexGatePolicy
 dexGateContext:MoneyDexGateContext
 boundary:DexCommissioningBoundary
 adapter:ManagedSolanaDexAdapter
 signer:CofferSignerAdapter
 chain:SolanaChainObserver
 attemptStore:DexExecutionAttemptStore
 permitStore:PermitStore
 permit:ExecutionPermit
 permitContext:Omit<PermitVerificationContext,'action'>
 canaryStore:LiveCanaryStateStore
 canaryPolicy:LiveCanaryPolicy
 tradingDate:string
 attemptId:string
 now:string
}):Promise<DexCanarySubmitResult>{
 const {
  intent,preExecutionMaterial,dexGatePolicy,dexGateContext,boundary,adapter,signer,chain,attemptStore,permitStore,
  permit,permitContext,canaryStore,canaryPolicy,tradingDate,attemptId,now,
 }=input
 assertBoundary({intent,boundary,adapter,now})
 if(dexGateContext.now!==now)throw new Error('MONEY_DEX_GATE_RUNTIME_TIME_MISMATCH')
 assertSharkPreExecutionBinding({binding:intent.preExecution,material:preExecutionMaterial,informationCutoff:intent.informationCutoff})
 const existing=await attemptStore.getByIdempotencyKey(intent.idempotencyKey)
 if(existing)throw new Error('DEX_COMMISSION_DUPLICATE_EXECUTION_BLOCKED')
 const action=dexExecutionAction(intent)
 verifyExecutionPermit(permit,{...permitContext,action,now})
 const order=await adapter.createOrder({intent,takerAddress:boundary.wallet.address})
 if(order.requestId.trim()===''||order.inputMint!==intent.inputMint||order.outputMint!==intent.outputMint||order.inputAmountAtomic!==intent.inputAmountAtomic||order.takerAddress!==boundary.wallet.address)throw new Error('DEX_COMMISSION_ORDER_BINDING_MISMATCH')
 if(adapter.provider!=='solana-dex-router'&&order.provider!==adapter.provider)throw new Error('DEX_COMMISSION_ORDER_PROVIDER_MISMATCH')
 if(order.quotedOutputAtomic<intent.minimumOutputAtomic)throw new Error('DEX_COMMISSION_QUOTE_BELOW_MINIMUM')
 const simulation=await chain.simulateUnsignedTransaction({unsignedTransactionBase64:order.unsignedTransactionBase64,now})
 if(simulation.simulationMode!=='UNSIGNED_PRE_SIGN'||!simulation.passed)throw new Error('DEX_COMMISSION_PREFLIGHT_SIMULATION_FAILED')
 if(simulation.feeLamports===undefined)throw new Error('DEX_COMMISSION_PREFLIGHT_FEE_REQUIRED')
 const preflight=evaluateMoneyDexGate({
  intent,
  order,
  policy:dexGatePolicy,
  context:{...dexGateContext,estimatedFeeLamports:simulation.feeLamports},
 })
 assertMoneyDexGatePassed(preflight)

 // No signer call is reachable until SHARK/EDGE binding, unsigned simulation, and Money preflight all pass.
 const signed=await signer.signVersionedTransaction({
  walletConnectionId:intent.walletConnectionId,
  signerLeaseId:intent.signerLeaseId,
  unsignedTransactionBase64:order.unsignedTransactionBase64,
  idempotencyKey:intent.idempotencyKey,
  expectedSignerAddress:boundary.wallet.address,
  now,
 })
 if(signed.walletConnectionId!==intent.walletConnectionId||signed.signerLeaseId!==intent.signerLeaseId||signed.signerAddress!==boundary.wallet.address||signed.containsPrivateKey!==false||signed.containsRawToken!==false)throw new Error('DEX_COMMISSION_SIGNER_OUTPUT_INVALID')
 let attempt:DexExecutionAttempt=Object.freeze({
  attemptId,
  executionId:intent.executionId,
  requestId:intent.requestId,
  runLineageId:intent.runLineageId,
  leg:intent.leg,
  provider:order.provider,
  requestProvider:intent.provider,
  walletConnectionId:intent.walletConnectionId,
  signerLeaseId:intent.signerLeaseId,
  idempotencyKey:intent.idempotencyKey,
  inputMint:intent.inputMint,
  outputMint:intent.outputMint,
  inputAmountAtomic:intent.inputAmountAtomic,
  minimumOutputAtomic:intent.minimumOutputAtomic,
  signedTransactionHash:signed.signedTransactionHash,
  primarySignature:signed.primarySignature,
  providerRequestId:order.requestId,
  preExecutionBindingHash:intent.preExecution.bindingHash,
  moneyDexGateId:preflight.gateId,
  simulationId:simulation.simulationId,
  simulatedFeeLamports:simulation.feeLamports,
  state:'SIMULATED',
  startedAt:now,
  updatedAt:now,
  evidenceIds:Object.freeze([...new Set([
   ...intent.evidenceIds,
   ...intent.preExecution.evidenceIds,
   intent.preExecution.bindingHash,
   ...order.evidenceIds,
   ...simulation.evidenceIds,
   ...preflight.evidenceIds,
   preflight.gateId,
   ...signed.evidenceIds,
  ])]),
  authority:'EXECUTION_ATTEMPT_ONLY' as const,
 })
 await attemptStore.put(attempt)
 const reserved=await canaryStore.reserve({
  provider:intent.provider,
  accountId:intent.walletConnectionId,
  tradingDate,
  currency:intent.currency,
  notionalMinor:intent.notionalMinor,
  side:intent.leg==='ENTRY'?'BUY':'SELL',
  policy:canaryPolicy,
  now,
 })
 if(!reserved.allowed){
  await attemptStore.update(attemptId,{state:'FAILED',errorCode:'DEX_CANARY_RISK_BLOCK:'+reserved.reasonCodes.join(','),updatedAt:now})
  throw new Error('DEX_COMMISSION_CANARY_RISK_BLOCKED:'+reserved.reasonCodes.join(','))
 }
 try{
  await consumeExecutionPermit(permitStore,permit.permitId,permit.nonce)
 }catch(error){
  await canaryStore.release(reserved.reservation,now)
  await attemptStore.update(attemptId,{state:'FAILED',errorCode:'DEX_EXECUTION_PERMIT_CONSUME_FAILED',updatedAt:now})
  throw error
 }
 let providerReceipt:DexProviderExecutionReceipt
 try{
  providerReceipt=await adapter.executeSigned({intent,order,signed,now})
 }catch{
  await canaryStore.markUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  await attemptStore.update(attemptId,{state:'UNKNOWN',errorCode:'DEX_PROVIDER_RESULT_AMBIGUOUS',updatedAt:now})
  throw new Error('DEX_COMMISSION_PROVIDER_RESULT_AMBIGUOUS')
 }
 if(providerReceipt.provider!==order.provider||providerReceipt.requestId!==order.requestId||providerReceipt.executionId!==intent.executionId){
  await canaryStore.markUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  await attemptStore.update(attemptId,{providerReceiptId:providerReceipt.receiptId,state:'UNKNOWN',errorCode:'DEX_PROVIDER_RECEIPT_BINDING_MISMATCH',updatedAt:now,evidenceIds:[...attempt.evidenceIds,...providerReceipt.evidenceIds]})
  throw new Error('DEX_COMMISSION_PROVIDER_RECEIPT_BINDING_MISMATCH')
 }
 if(providerReceipt.signature&&providerReceipt.signature!==signed.primarySignature){
  await canaryStore.markUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  await attemptStore.update(attemptId,{providerReceiptId:providerReceipt.receiptId,state:'UNKNOWN',errorCode:'DEX_PROVIDER_SIGNATURE_MISMATCH',updatedAt:now,evidenceIds:[...attempt.evidenceIds,...providerReceipt.evidenceIds]})
  throw new Error('DEX_COMMISSION_PROVIDER_SIGNATURE_MISMATCH')
 }
 if(providerReceipt.state==='FAILED'&&!providerReceipt.signature){
  await canaryStore.release(reserved.reservation,now)
  await attemptStore.update(attemptId,{providerReceiptId:providerReceipt.receiptId,state:'FAILED',errorCode:providerReceipt.errorCode??'DEX_PROVIDER_REJECTED',updatedAt:now,evidenceIds:[...attempt.evidenceIds,...providerReceipt.evidenceIds]})
  throw new Error('DEX_COMMISSION_PROVIDER_REJECTED')
 }
 if(!providerReceipt.signature){
  await canaryStore.markUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  await attemptStore.update(attemptId,{providerReceiptId:providerReceipt.receiptId,state:'UNKNOWN',errorCode:'DEX_PROVIDER_SIGNATURE_REQUIRED',updatedAt:now,evidenceIds:[...attempt.evidenceIds,...providerReceipt.evidenceIds]})
  throw new Error('DEX_COMMISSION_PROVIDER_SIGNATURE_REQUIRED')
 }
 attempt=await attemptStore.update(attemptId,{providerReceiptId:providerReceipt.receiptId,state:'SUBMITTED',updatedAt:now,evidenceIds:[...attempt.evidenceIds,...providerReceipt.evidenceIds]})
 return Object.freeze({attempt,order,preflight,signed,simulation,providerReceipt,reservation:reserved.reservation,authority:'EXECUTION_RESULT_ONLY' as const})
}

export async function reconcileDexCanaryLeg(input:{
 intent:DexSwapIntent
 boundary:DexCommissioningBoundary
 chain:SolanaChainObserver
 attemptStore:DexExecutionAttemptStore
 canaryStore:LiveCanaryStateStore
 tradingDate:string
 attemptId:string
 now:string
}):Promise<DexCanaryReconcileResult>{
 const {intent,boundary,chain,attemptStore,canaryStore,tradingDate,attemptId,now}=input
 const current=await attemptStore.get(attemptId)
 if(!current||current.executionId!==intent.executionId||current.idempotencyKey!==intent.idempotencyKey)throw new Error('DEX_COMMISSION_RECOVERY_ATTEMPT_BINDING_MISMATCH')
 if(!['SUBMITTED','UNKNOWN','CONFIRMED','RECONCILED'].includes(current.state))throw new Error('DEX_COMMISSION_RECOVERY_STATE_INVALID')
 const recoveredExisting=true
 const onchain=await chain.observeSwap({
  signature:current.primarySignature,
  walletAddress:boundary.wallet.address,
  inputMint:current.inputMint,
  outputMint:current.outputMint,
  now,
 })
 if(!onchain.found||!onchain.confirmed){
  await canaryStore.markUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  const attempt=await attemptStore.update(attemptId,{state:'UNKNOWN',errorCode:'DEX_CHAIN_CONFIRMATION_PENDING',updatedAt:now,evidenceIds:[...current.evidenceIds,...onchain.evidenceIds]})
  return Object.freeze({attempt,onchain,recoveredExisting,authority:'RECONCILIATION_RESULT_ONLY' as const})
 }
 if(onchain.failed){
  await canaryStore.resolveUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  const attempt=await attemptStore.update(attemptId,{state:'FAILED',errorCode:'DEX_CHAIN_EXECUTION_FAILED',updatedAt:now,evidenceIds:[...current.evidenceIds,...onchain.evidenceIds]})
  return Object.freeze({attempt,onchain,recoveredExisting,authority:'RECONCILIATION_RESULT_ONLY' as const})
 }
 const confirmedAttempt=current.state==='RECONCILED'
  ? current
  : await attemptStore.update(attemptId,{state:'CONFIRMED',errorCode:undefined,updatedAt:now,evidenceIds:[...current.evidenceIds,...onchain.evidenceIds]})
 const reconciliation=reconcile({intent,attempt:confirmedAttempt,onchain,now})
 if(!reconciliation.passed){
  await canaryStore.resolveUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
  const attempt=await attemptStore.update(attemptId,{state:'FAILED',errorCode:'DEX_RECONCILIATION_FAILED:'+reconciliation.reasonCodes.join(','),updatedAt:now,evidenceIds:[...current.evidenceIds,...reconciliation.evidenceIds]})
  return Object.freeze({attempt,onchain,reconciliation,recoveredExisting,authority:'RECONCILIATION_RESULT_ONLY' as const})
 }
 await canaryStore.resolveUnknown(intent.provider,intent.walletConnectionId,tradingDate,intent.executionId,now)
 const attempt=current.state==='RECONCILED'
  ? current
  : await attemptStore.update(attemptId,{state:'RECONCILED',errorCode:undefined,updatedAt:now,evidenceIds:[...current.evidenceIds,...reconciliation.evidenceIds]})
 return Object.freeze({attempt,onchain,reconciliation,recoveredExisting,authority:'RECONCILIATION_RESULT_ONLY' as const})
}

export async function proveDexRestartRecovery(input:{
 intent:DexSwapIntent
 boundary:DexCommissioningBoundary
 chain:SolanaChainObserver
 attemptStore:DexExecutionAttemptStore
 canaryStore:LiveCanaryStateStore
 tradingDate:string
 attemptId:string
 previousRuntimeId:string
 recoveryRuntimeId:string
 now:string
}):Promise<DexRestartRecoveryProof>{
 if(!input.previousRuntimeId.trim()||!input.recoveryRuntimeId.trim()||input.previousRuntimeId===input.recoveryRuntimeId)throw new Error('DEX_COMMISSION_DISTINCT_RUNTIME_IDS_REQUIRED')
 const result=await reconcileDexCanaryLeg(input)
 if(result.attempt.state!=='RECONCILED'||!result.reconciliation?.passed)throw new Error('DEX_COMMISSION_RESTART_RECOVERY_NOT_PROVEN')
 return Object.freeze({
  proofId:'dex:restart-recovery:'+hashDexRuntime({attemptId:input.attemptId,previousRuntimeId:input.previousRuntimeId,recoveryRuntimeId:input.recoveryRuntimeId,signature:result.attempt.primarySignature}),
  attemptId:result.attempt.attemptId,
  executionId:result.attempt.executionId,
  previousRuntimeId:input.previousRuntimeId,
  recoveryRuntimeId:input.recoveryRuntimeId,
  signature:result.attempt.primarySignature,
  recoveredState:'RECONCILED' as const,
  observedAt:input.now,
  evidenceIds:Object.freeze([...result.attempt.evidenceIds]),
  authority:'RECOVERY_EVIDENCE_ONLY' as const,
 })
}
