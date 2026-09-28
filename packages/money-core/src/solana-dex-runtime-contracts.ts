import { createHash } from 'node:crypto'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { MoneyMarketConnectorDescriptor } from './market-connector-contracts.js'
import type { SignerLease, SignerLeasePolicy, SignerRollingObservation } from './signer-lease-contracts.js'

export type DexCanaryLeg='ENTRY'|'EXIT'

export type DexSwapIntent=Readonly<{
 executionId:string
 requestId:string
 runLineageId:string
 userId:string
 strategyId:string
 instrumentId:string
 leg:DexCanaryLeg
 provider:'jupiter-ultra'
 walletConnectionId:string
 signerLeaseId:string
 inputMint:string
 outputMint:string
 inputAmountAtomic:bigint
 minimumOutputAtomic:bigint
 notionalMinor:bigint
 currency:string
 idempotencyKey:string
 informationCutoff:string
 evidenceIds:readonly string[]
 authority:'MONEY_EXECUTION_INTENT'
}>

export type DexManagedOrder=Readonly<{
 provider:'jupiter-ultra'
 requestId:string
 inputMint:string
 outputMint:string
 inputAmountAtomic:bigint
 quotedOutputAtomic:bigint
 unsignedTransactionBase64:string
 takerAddress:string
 evidenceIds:readonly string[]
 authority:'PROVIDER_QUOTE_ONLY'
 canBroadcast:false
}>

export type DexSignedTransaction=Readonly<{
 signerProvider:string
 walletConnectionId:string
 signerLeaseId:string
 signerAddress:string
 primarySignature:string
 signedTransactionBase64:string
 signedTransactionHash:string
 evidenceIds:readonly string[]
 authority:'SIGNER_OUTPUT_ONLY'
 containsPrivateKey:false
 containsRawToken:false
}>

export type DexSimulationReceipt=Readonly<{
 simulationId:string
 signature:string
 passed:boolean
 errorCode?:string
 unitsConsumed?:number
 feeLamports?:bigint
 logs:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'CHAIN_SIMULATION_EVIDENCE'
}>

export type DexProviderExecutionReceipt=Readonly<{
 receiptId:string
 provider:'jupiter-ultra'
 requestId:string
 executionId:string
 state:'ACKNOWLEDGED'|'FAILED'|'UNKNOWN'
 signature?:string
 inputAmountAtomic?:bigint
 outputAmountAtomic?:bigint
 errorCode?:string
 observedAt:string
 evidenceIds:readonly string[]
 authority:'PROVIDER_EXECUTION_EVIDENCE'
}>

export type DexOnchainReceipt=Readonly<{
 signature:string
 found:boolean
 confirmed:boolean
 failed:boolean
 slot?:number
 feeLamports?:bigint
 inputDebitAtomic?:bigint
 outputCreditAtomic?:bigint
 inputPostBalanceAtomic?:bigint
 outputPostBalanceAtomic?:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'ONCHAIN_EVIDENCE'
}>

export type DexLegReconciliation=Readonly<{
 reconciliationId:string
 executionId:string
 leg:DexCanaryLeg
 passed:boolean
 inputAmountAtomic:bigint
 observedInputDebitAtomic:bigint
 minimumOutputAtomic:bigint
 observedOutputCreditAtomic:bigint
 feeLamports:bigint
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 observedAt:string
 authority:'RECONCILIATION_ONLY'
}>

export type DexExecutionAttemptState=
 | 'SIGNED'
 | 'SIMULATED'
 | 'SUBMITTED'
 | 'CONFIRMED'
 | 'RECONCILED'
 | 'FAILED'
 | 'UNKNOWN'

export type DexExecutionAttempt=Readonly<{
 attemptId:string
 executionId:string
 requestId:string
 runLineageId:string
 leg:DexCanaryLeg
 provider:'jupiter-ultra'
 walletConnectionId:string
 signerLeaseId:string
 idempotencyKey:string
 inputMint:string
 outputMint:string
 inputAmountAtomic:bigint
 minimumOutputAtomic:bigint
 signedTransactionHash:string
 primarySignature:string
 providerRequestId:string
 simulationId?:string
 simulatedFeeLamports?:bigint
 providerReceiptId?:string
 state:DexExecutionAttemptState
 errorCode?:string
 startedAt:string
 updatedAt:string
 evidenceIds:readonly string[]
 authority:'EXECUTION_ATTEMPT_ONLY'
}>

export interface DexExecutionAttemptStore{
 put(attempt:DexExecutionAttempt):Promise<void>|void
 get(attemptId:string):Promise<DexExecutionAttempt|undefined>|DexExecutionAttempt|undefined
 getByIdempotencyKey(idempotencyKey:string):Promise<DexExecutionAttempt|undefined>|DexExecutionAttempt|undefined
 update(attemptId:string,patch:Partial<Pick<DexExecutionAttempt,'providerReceiptId'|'simulationId'|'simulatedFeeLamports'|'state'|'errorCode'|'updatedAt'|'evidenceIds'>>):Promise<DexExecutionAttempt>|DexExecutionAttempt
}

export interface ManagedSolanaDexAdapter{
 readonly provider:'jupiter-ultra'
 createOrder(input:{intent:DexSwapIntent;takerAddress:string}):Promise<DexManagedOrder>
 executeSigned(input:{intent:DexSwapIntent;order:DexManagedOrder;signed:DexSignedTransaction;now:string}):Promise<DexProviderExecutionReceipt>
}

export interface CofferSignerAdapter{
 readonly provider:string
 signVersionedTransaction(input:{
  walletConnectionId:string
  signerLeaseId:string
  unsignedTransactionBase64:string
  idempotencyKey:string
  expectedSignerAddress:string
  now:string
 }):Promise<DexSignedTransaction>
}

export interface SolanaChainObserver{
 simulateSignedTransaction(input:{signedTransactionBase64:string;primarySignature:string;now:string}):Promise<DexSimulationReceipt>
 observeSwap(input:{
  signature:string
  walletAddress:string
  inputMint:string
  outputMint:string
  now:string
 }):Promise<DexOnchainReceipt>
}

export type DexCommissioningBoundary=Readonly<{
 connector:MoneyMarketConnectorDescriptor
 wallet:ConnectedWallet
 signerPolicy:SignerLeasePolicy
 signerLease:SignerLease
 signerObservation:SignerRollingObservation
}>

export function hashDexRuntime(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
}

export function assertDexSwapIntent(intent:DexSwapIntent):void{
 for(const [value,code] of [
  [intent.executionId,'DEX_COMMISSION_EXECUTION_ID_REQUIRED'],
  [intent.requestId,'DEX_COMMISSION_REQUEST_ID_REQUIRED'],
  [intent.runLineageId,'DEX_COMMISSION_LINEAGE_REQUIRED'],
  [intent.userId,'DEX_COMMISSION_USER_REQUIRED'],
  [intent.strategyId,'DEX_COMMISSION_STRATEGY_REQUIRED'],
  [intent.instrumentId,'DEX_COMMISSION_INSTRUMENT_REQUIRED'],
  [intent.walletConnectionId,'DEX_COMMISSION_WALLET_REQUIRED'],
  [intent.signerLeaseId,'DEX_COMMISSION_SIGNER_LEASE_REQUIRED'],
  [intent.inputMint,'DEX_COMMISSION_INPUT_MINT_REQUIRED'],
  [intent.outputMint,'DEX_COMMISSION_OUTPUT_MINT_REQUIRED'],
  [intent.currency,'DEX_COMMISSION_CURRENCY_REQUIRED'],
  [intent.idempotencyKey,'DEX_COMMISSION_IDEMPOTENCY_REQUIRED'],
 ] as const) if(!value.trim()) throw new Error(code)
 if(intent.provider!=='jupiter-ultra'||intent.authority!=='MONEY_EXECUTION_INTENT')throw new Error('DEX_COMMISSION_INTENT_AUTHORITY_INVALID')
 if(intent.inputMint===intent.outputMint)throw new Error('DEX_COMMISSION_IDENTICAL_MINTS')
 if(intent.inputAmountAtomic<=0n||intent.minimumOutputAtomic<=0n||intent.notionalMinor<=0n)throw new Error('DEX_COMMISSION_AMOUNT_INVALID')
 if(Number.isNaN(Date.parse(intent.informationCutoff)))throw new Error('DEX_COMMISSION_CUTOFF_INVALID')
 if(!intent.evidenceIds.length)throw new Error('DEX_COMMISSION_EVIDENCE_REQUIRED')
}

export class InMemoryDexExecutionAttemptStore implements DexExecutionAttemptStore{
 private readonly rows=new Map<string,DexExecutionAttempt>()
 private readonly byIdempotency=new Map<string,string>()
 put(attempt:DexExecutionAttempt):void{
  if(this.rows.has(attempt.attemptId)||this.byIdempotency.has(attempt.idempotencyKey))throw new Error('DEX_COMMISSION_ATTEMPT_DUPLICATE')
  this.rows.set(attempt.attemptId,Object.freeze({...attempt,evidenceIds:Object.freeze([...attempt.evidenceIds])}))
  this.byIdempotency.set(attempt.idempotencyKey,attempt.attemptId)
 }
 get(attemptId:string):DexExecutionAttempt|undefined{return this.rows.get(attemptId)}
 getByIdempotencyKey(idempotencyKey:string):DexExecutionAttempt|undefined{
  const id=this.byIdempotency.get(idempotencyKey)
  return id?this.rows.get(id):undefined
 }
 update(attemptId:string,patch:Partial<Pick<DexExecutionAttempt,'providerReceiptId'|'simulationId'|'simulatedFeeLamports'|'state'|'errorCode'|'updatedAt'|'evidenceIds'>>):DexExecutionAttempt{
  const current=this.rows.get(attemptId)
  if(!current)throw new Error('DEX_COMMISSION_ATTEMPT_NOT_FOUND')
  const next=Object.freeze({...current,...patch,evidenceIds:Object.freeze([...(patch.evidenceIds??current.evidenceIds)])})
  this.rows.set(attemptId,next)
  return next
 }
}
