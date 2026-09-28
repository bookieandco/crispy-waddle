import { createHash } from 'node:crypto'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { MoneyMarketConnectorDescriptor } from './market-connector-contracts.js'
import type { SignerLease, SignerLeasePolicy, SignerRollingObservation } from './signer-lease-contracts.js'
import { EDGE_007_REQUIRED_VERSION, EDGE_DECISION_REQUIRED_VERSION, type Edge007IntegrityReceipt, type EdgeDecisionBundleReceipt } from './dex-four-stage-certification.js'

export type DexCanaryLeg='ENTRY'|'EXIT'

export type DexExecutionApprovalBinding=Readonly<{
 sharkAssessmentId:string
 thesisId:string
 edgeDecisionBundleHash:string
 integrityGuardHash:string
 moneyRiskDecisionId:string
 approvedAt:string
 authority:'MONEY_RISK_APPROVAL_BINDING'
 bindingHash:string
}>

export type DexSwapIntent=Readonly<{
 executionId:string
 tradeId:string
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
 approval:DexExecutionApprovalBinding
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

export type DexUnsignedSimulationReceipt=Readonly<{
 simulationId:string
 passed:boolean
 errorCode?:string
 unitsConsumed?:number
 logs:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'CHAIN_PREFLIGHT_EVIDENCE'
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
 simulateUnsignedTransaction(input:{unsignedTransactionBase64:string;now:string}):Promise<DexUnsignedSimulationReceipt>
 simulateSignedTransaction(input:{signedTransactionBase64:string;primarySignature:string;now:string}):Promise<DexSimulationReceipt>
 observeSwap(input:{
  signature:string
  walletAddress:string
  inputMint:string
  outputMint:string
  now:string
 }):Promise<DexOnchainReceipt>
}

export type DexExecutionLifecycleEventType='TX_SIMULATED'|'TX_SIGNED'|'TX_SENT'|'FILLED'

export type DexExecutionLifecycleEvent=Readonly<{
 type:DexExecutionLifecycleEventType
 tradeId:string
 executionId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 leg:DexCanaryLeg
 occurredAt:string
 evidenceIds:readonly string[]
 details:Readonly<Record<string,unknown>>
 authority:'EXECUTION_TELEMETRY_ONLY'
}>

export interface DexExecutionEventSink{
 publish(event:DexExecutionLifecycleEvent):Promise<void>|void
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

function dexApprovalBindingHash(input:Omit<DexExecutionApprovalBinding,'bindingHash'>):string{
 return hashDexRuntime({
  sharkAssessmentId:input.sharkAssessmentId,
  thesisId:input.thesisId,
  edgeDecisionBundleHash:input.edgeDecisionBundleHash,
  integrityGuardHash:input.integrityGuardHash,
  moneyRiskDecisionId:input.moneyRiskDecisionId,
  approvedAt:input.approvedAt,
  authority:input.authority,
 })
}

function createDexExecutionApprovalBinding(input:Omit<DexExecutionApprovalBinding,'bindingHash'>):DexExecutionApprovalBinding{
 return Object.freeze({...input,bindingHash:dexApprovalBindingHash(input)})
}

export function assertDexExecutionApprovalBinding(binding:DexExecutionApprovalBinding):void{
 for(const [value,code] of [
  [binding.sharkAssessmentId,'DEX_APPROVAL_SHARK_ASSESSMENT_REQUIRED'],
  [binding.thesisId,'DEX_APPROVAL_THESIS_REQUIRED'],
  [binding.edgeDecisionBundleHash,'DEX_APPROVAL_EDGE_BUNDLE_REQUIRED'],
  [binding.integrityGuardHash,'DEX_APPROVAL_INTEGRITY_REQUIRED'],
  [binding.moneyRiskDecisionId,'DEX_APPROVAL_MONEY_RISK_REQUIRED'],
  [binding.bindingHash,'DEX_APPROVAL_BINDING_HASH_REQUIRED'],
 ] as const) if(!value.trim())throw new Error(code)
 if(binding.authority!=='MONEY_RISK_APPROVAL_BINDING')throw new Error('DEX_APPROVAL_AUTHORITY_INVALID')
 if(Number.isNaN(Date.parse(binding.approvedAt)))throw new Error('DEX_APPROVAL_TIME_INVALID')
 const expected=dexApprovalBindingHash(binding)
 if(expected!==binding.bindingHash)throw new Error('DEX_APPROVAL_BINDING_HASH_MISMATCH')
}

export type MoneyDexRiskApprovalReceipt=Readonly<{
 riskDecisionId:string
 disposition:'APPROVE'|'BLOCK'
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 evaluatedAt:string
 authority:'MONEY_RISK_DECISION'
 canExecute:false
}>

export type DexGovernanceApprovalPackage=Readonly<{
 sharkAssessmentId:string
 thesisId:string
 edgeDecisionBundle:EdgeDecisionBundleReceipt
 integrityGuard:Edge007IntegrityReceipt
 moneyRisk:MoneyDexRiskApprovalReceipt
 approvedAt:string
}>

function assertEdgeDecisionBundleForExecution(bundle:EdgeDecisionBundleReceipt):void{
 if(bundle.frameworkVersion!==EDGE_DECISION_REQUIRED_VERSION)throw new Error('DEX_APPROVAL_EDGE_VERSION_INVALID')
 if(bundle.authority!=='RESEARCH_AND_RISK_GATE_ONLY'||bundle.canAuthorizeTrade!==false)throw new Error('DEX_APPROVAL_EDGE_AUTHORITY_INVALID')
 if(bundle.disposition!=='PASS'||bundle.reasonCodes.length)throw new Error('DEX_APPROVAL_EDGE_BLOCKED')
 if(!bundle.evidenceIds.length)throw new Error('DEX_APPROVAL_EDGE_EVIDENCE_REQUIRED')
 const required=['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const
 const receipts=new Map(bundle.receipts.map(receipt=>[receipt.gateId,receipt]))
 for(const gateId of required){
  const receipt=receipts.get(gateId)
  if(!receipt)throw new Error('DEX_APPROVAL_'+gateId.replace('-','')+'_RECEIPT_REQUIRED')
  if(receipt.version!==EDGE_DECISION_REQUIRED_VERSION||receipt.authority!=='RESEARCH_AND_RISK_GATE_ONLY'||receipt.canAuthorizeTrade!==false)throw new Error('DEX_APPROVAL_'+gateId.replace('-','')+'_RECEIPT_INVALID')
  if(receipt.disposition!=='PASS'||receipt.reasonCodes.length||!receipt.evidenceIds.length)throw new Error('DEX_APPROVAL_'+gateId.replace('-','')+'_BLOCKED')
 }
}

function assertIntegrityGuardForExecution(receipt:Edge007IntegrityReceipt):void{
 if(receipt.guardVersion!==EDGE_007_REQUIRED_VERSION)throw new Error('DEX_APPROVAL_EDGE007_VERSION_INVALID')
 if(receipt.authority!=='INTEGRITY_VETO_ONLY'||receipt.canAuthorizeTrade!==false||receipt.canAuthorizePromotion!==false)throw new Error('DEX_APPROVAL_EDGE007_AUTHORITY_INVALID')
 if(receipt.disposition!=='PASS'||receipt.reasonCodes.length||!receipt.evidenceIds.length)throw new Error('DEX_APPROVAL_EDGE007_BLOCKED')
}

function assertMoneyRiskApprovalForExecution(receipt:MoneyDexRiskApprovalReceipt):void{
 if(!receipt.riskDecisionId.trim())throw new Error('DEX_APPROVAL_MONEY_RISK_REQUIRED')
 if(receipt.authority!=='MONEY_RISK_DECISION'||receipt.canExecute!==false)throw new Error('DEX_APPROVAL_MONEY_RISK_AUTHORITY_INVALID')
 if(receipt.disposition!=='APPROVE'||receipt.reasonCodes.length)throw new Error('DEX_APPROVAL_MONEY_RISK_BLOCKED')
 if(!receipt.evidenceIds.length)throw new Error('DEX_APPROVAL_MONEY_RISK_EVIDENCE_REQUIRED')
 if(Number.isNaN(Date.parse(receipt.evaluatedAt)))throw new Error('DEX_APPROVAL_MONEY_RISK_TIME_INVALID')
}

export type DexSwapIntentDraft=Omit<DexSwapIntent,'approval'|'authority'>

export function createApprovedDexSwapIntent(input:{
 draft:DexSwapIntentDraft
 governance:DexGovernanceApprovalPackage
}):DexSwapIntent{
 const governance=input.governance
 if(!governance.sharkAssessmentId.trim()||!governance.thesisId.trim())throw new Error('DEX_APPROVAL_SHARK_LINEAGE_REQUIRED')
 if(Number.isNaN(Date.parse(governance.approvedAt)))throw new Error('DEX_APPROVAL_TIME_INVALID')
 assertEdgeDecisionBundleForExecution(governance.edgeDecisionBundle)
 assertIntegrityGuardForExecution(governance.integrityGuard)
 assertMoneyRiskApprovalForExecution(governance.moneyRisk)
 if(governance.moneyRisk.evaluatedAt>governance.approvedAt)throw new Error('DEX_APPROVAL_BEFORE_MONEY_RISK_DECISION')
 const approval=createDexExecutionApprovalBinding({
  sharkAssessmentId:governance.sharkAssessmentId,
  thesisId:governance.thesisId,
  edgeDecisionBundleHash:hashDexRuntime(governance.edgeDecisionBundle),
  integrityGuardHash:hashDexRuntime(governance.integrityGuard),
  moneyRiskDecisionId:governance.moneyRisk.riskDecisionId,
  approvedAt:governance.approvedAt,
  authority:'MONEY_RISK_APPROVAL_BINDING',
 })
 const intent=Object.freeze({
  ...input.draft,
  approval,
  evidenceIds:Object.freeze([...new Set([
   ...input.draft.evidenceIds,
   ...governance.edgeDecisionBundle.evidenceIds,
   ...governance.integrityGuard.evidenceIds,
   ...governance.moneyRisk.evidenceIds,
   'shark-assessment:'+governance.sharkAssessmentId,
   'thesis:'+governance.thesisId,
   'dex-approval:'+approval.bindingHash,
  ])]),
  authority:'MONEY_EXECUTION_INTENT' as const,
 })
 assertDexSwapIntent(intent)
 return intent
}

export function assertDexSwapIntent(intent:DexSwapIntent):void{
 for(const [value,code] of [
  [intent.executionId,'DEX_COMMISSION_EXECUTION_ID_REQUIRED'],
  [intent.tradeId,'DEX_COMMISSION_TRADE_ID_REQUIRED'],
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
 assertDexExecutionApprovalBinding(intent.approval)
 if(intent.approval.approvedAt<intent.informationCutoff)throw new Error('DEX_APPROVAL_BEFORE_INFORMATION_CUTOFF')
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
