import type { SqlClient } from './postgres-idempotency-store.js'
import type {
 DexExecutionAttempt,
 DexExecutionAttemptState,
 DexExecutionAttemptStore,
} from './solana-dex-runtime-contracts.js'
import type { DexExecutionStageEvidence, DexLiveCanaryVerificationReceipt } from './dex-four-stage-certification.js'
import { dexLiveCanaryEvidenceHash } from './dex-four-stage-certification.js'

type AttemptRow=Readonly<{
 attempt_id:string
 execution_id:string
 request_id:string
 run_lineage_id:string
 leg:'ENTRY'|'EXIT'
 provider:'jupiter-ultra'
 wallet_connection_id:string
 signer_lease_id:string
 idempotency_key:string
 input_mint:string
 output_mint:string
 input_amount_atomic:string|number|bigint
 minimum_output_atomic:string|number|bigint
 signed_transaction_hash:string
 primary_signature:string
 provider_request_id:string
 simulation_id:string|null
 simulated_fee_lamports:string|number|bigint|null
 provider_receipt_id:string|null
 state:DexExecutionAttemptState
 error_code:string|null
 evidence_ids:string[]
 started_at:string|Date
 updated_at:string|Date
}>

type StageRow=Readonly<{
 stage_id:string
 run_lineage_id:string
 strategy_id:string
 instrument_id:string
 wallet_connection_id:string
 entry_execution_id:string
 exit_execution_id:string
 stage_evidence_hash:string
 provider_receipt_ids:string[]
 onchain_signature_ids:string[]
 capital_bounded:boolean
 kill_switch_proven:boolean
 restart_recovery_proven:boolean
 sellability_proven:boolean
 position_flat_after_exit:boolean
 execution_cost_reconciled:boolean
 evidence_ids:string[]
 observed_at:string|Date
}>

type VerificationRow=Readonly<{
 verification_id:string
 stage_id:string
 run_lineage_id:string
 wallet_connection_id:string
 entry_execution_id:string
 exit_execution_id:string
 stage_evidence_hash:string
 provider_receipt_ids:string[]
 onchain_signature_ids:string[]
 provider_evidence_verified:boolean
 onchain_evidence_verified:boolean
 source:'COMMISSIONED_DEX_RUNTIME'
 authority:'RUNTIME_EVIDENCE_ONLY'
 verified_at:string|Date
}>

function safe(value:string,code:string):string{
 if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))throw new Error(code)
 return value
}
function iso(value:string|Date):string{return value instanceof Date?value.toISOString():new Date(value).toISOString()}

function mapAttempt(row:AttemptRow):DexExecutionAttempt{
 return Object.freeze({
  attemptId:row.attempt_id,
  executionId:row.execution_id,
  requestId:row.request_id,
  runLineageId:row.run_lineage_id,
  leg:row.leg,
  provider:row.provider,
  walletConnectionId:row.wallet_connection_id,
  signerLeaseId:row.signer_lease_id,
  idempotencyKey:row.idempotency_key,
  inputMint:row.input_mint,
  outputMint:row.output_mint,
  inputAmountAtomic:BigInt(row.input_amount_atomic),
  minimumOutputAtomic:BigInt(row.minimum_output_atomic),
  signedTransactionHash:row.signed_transaction_hash,
  primarySignature:row.primary_signature,
  providerRequestId:row.provider_request_id,
  simulationId:row.simulation_id??undefined,
  simulatedFeeLamports:row.simulated_fee_lamports==null?undefined:BigInt(row.simulated_fee_lamports),
  providerReceiptId:row.provider_receipt_id??undefined,
  state:row.state,
  errorCode:row.error_code??undefined,
  startedAt:iso(row.started_at),
  updatedAt:iso(row.updated_at),
  evidenceIds:Object.freeze(row.evidence_ids??[]),
  authority:'EXECUTION_ATTEMPT_ONLY' as const,
 })
}

function transitionAllowed(from:DexExecutionAttemptState,to:DexExecutionAttemptState):boolean{
 if(from===to)return true
 const allowed:Record<DexExecutionAttemptState,readonly DexExecutionAttemptState[]>={
  SIGNED:['SIMULATED','FAILED'],
  SIMULATED:['SUBMITTED','UNKNOWN','FAILED'],
  SUBMITTED:['CONFIRMED','UNKNOWN','FAILED'],
  CONFIRMED:['RECONCILED','FAILED','UNKNOWN'],
  UNKNOWN:['CONFIRMED','FAILED'],
  RECONCILED:[],
  FAILED:[],
 }
 return allowed[from].includes(to)
}

export class PostgresDexExecutionAttemptStore implements DexExecutionAttemptStore{
 private readonly table:string
 constructor(private readonly client:SqlClient,tableName='money_dex_execution_attempts'){
  this.table=safe(tableName,'DEX_COMMISSION_ATTEMPT_TABLE_INVALID')
 }
 async put(attempt:DexExecutionAttempt):Promise<void>{
  if(attempt.authority!=='EXECUTION_ATTEMPT_ONLY')throw new Error('DEX_COMMISSION_ATTEMPT_AUTHORITY_INVALID')
  const result=await this.client.query(
   `INSERT INTO ${this.table}(
     attempt_id,execution_id,request_id,run_lineage_id,leg,provider,wallet_connection_id,signer_lease_id,
     idempotency_key,input_mint,output_mint,input_amount_atomic,minimum_output_atomic,signed_transaction_hash,
     primary_signature,provider_request_id,simulation_id,simulated_fee_lamports,provider_receipt_id,state,
     error_code,evidence_ids,started_at,updated_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
    ON CONFLICT DO NOTHING RETURNING attempt_id`,
   [
    attempt.attemptId,attempt.executionId,attempt.requestId,attempt.runLineageId,attempt.leg,attempt.provider,
    attempt.walletConnectionId,attempt.signerLeaseId,attempt.idempotencyKey,attempt.inputMint,attempt.outputMint,
    attempt.inputAmountAtomic.toString(),attempt.minimumOutputAtomic.toString(),attempt.signedTransactionHash,
    attempt.primarySignature,attempt.providerRequestId,attempt.simulationId??null,attempt.simulatedFeeLamports?.toString()??null,
    attempt.providerReceiptId??null,attempt.state,attempt.errorCode??null,[...attempt.evidenceIds],attempt.startedAt,attempt.updatedAt,
   ],
  )
  if((result.rowCount??result.rows.length)!==1)throw new Error('DEX_COMMISSION_ATTEMPT_DUPLICATE')
 }
 async get(attemptId:string):Promise<DexExecutionAttempt|undefined>{
  const result=await this.client.query<AttemptRow>(
   `SELECT * FROM ${this.table} WHERE attempt_id=$1 LIMIT 1`,
   [attemptId],
  )
  return result.rows[0]?mapAttempt(result.rows[0]):undefined
 }
 async getByIdempotencyKey(idempotencyKey:string):Promise<DexExecutionAttempt|undefined>{
  const result=await this.client.query<AttemptRow>(
   `SELECT * FROM ${this.table} WHERE idempotency_key=$1 LIMIT 1`,
   [idempotencyKey],
  )
  return result.rows[0]?mapAttempt(result.rows[0]):undefined
 }
 async update(
  attemptId:string,
  patch:Partial<Pick<DexExecutionAttempt,'providerReceiptId'|'simulationId'|'simulatedFeeLamports'|'state'|'errorCode'|'updatedAt'|'evidenceIds'>>,
 ):Promise<DexExecutionAttempt>{
  const current=await this.get(attemptId)
  if(!current)throw new Error('DEX_COMMISSION_ATTEMPT_NOT_FOUND')
  const nextState=patch.state??current.state
  if(!transitionAllowed(current.state,nextState))throw new Error('DEX_COMMISSION_ATTEMPT_STATE_REGRESSION')
  const updatedAt=patch.updatedAt??current.updatedAt
  const evidenceIds=Object.freeze([...(patch.evidenceIds??current.evidenceIds)])
  const result=await this.client.query<AttemptRow>(
   `UPDATE ${this.table}
    SET provider_receipt_id=$3,
        simulation_id=$4,
        simulated_fee_lamports=$5,
        state=$6,
        error_code=$7,
        evidence_ids=$8,
        updated_at=$9
    WHERE attempt_id=$1 AND state=$2
    RETURNING *`,
   [
    attemptId,current.state,patch.providerReceiptId??current.providerReceiptId??null,
    patch.simulationId??current.simulationId??null,
    patch.simulatedFeeLamports?.toString()??current.simulatedFeeLamports?.toString()??null,
    nextState,patch.errorCode??null,[...evidenceIds],updatedAt,
   ],
  )
  if(!result.rows[0])throw new Error('DEX_COMMISSION_ATTEMPT_CONCURRENT_UPDATE')
  return mapAttempt(result.rows[0])
 }
}

export class PostgresDexCertificationEvidenceStore{
 private readonly stageTable:string
 private readonly verificationTable:string
 constructor(
  private readonly client:SqlClient,
  stageTable='money_dex_stage4_evidence',
  verificationTable='money_dex_runtime_verifications',
 ){
  this.stageTable=safe(stageTable,'DEX_COMMISSION_STAGE_TABLE_INVALID')
  this.verificationTable=safe(verificationTable,'DEX_COMMISSION_VERIFICATION_TABLE_INVALID')
 }
 async putStage(evidence:DexExecutionStageEvidence):Promise<void>{
  if(evidence.stage!=='CONTROLLED_LIVE_CANARY')throw new Error('DEX_COMMISSION_STAGE4_REQUIRED')
  if(!evidence.walletConnectionId||!evidence.entryExecutionId||!evidence.exitExecutionId)throw new Error('DEX_COMMISSION_STAGE4_BINDING_REQUIRED')
  const result=await this.client.query(
   `INSERT INTO ${this.stageTable}(
     stage_id,run_lineage_id,strategy_id,instrument_id,wallet_connection_id,entry_execution_id,exit_execution_id,
     stage_evidence_hash,provider_receipt_ids,onchain_signature_ids,capital_bounded,kill_switch_proven,
     restart_recovery_proven,sellability_proven,position_flat_after_exit,execution_cost_reconciled,evidence_ids,observed_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT DO NOTHING RETURNING stage_id`,
   [
    evidence.stageId,evidence.runLineageId,evidence.strategyId,evidence.instrumentId,evidence.walletConnectionId,
    evidence.entryExecutionId,evidence.exitExecutionId,dexLiveCanaryEvidenceHash(evidence),
    [...evidence.providerReceiptIds],[...evidence.onchainSignatureIds],evidence.capitalBounded,evidence.killSwitchProven,
    evidence.restartRecoveryProven,evidence.sellabilityProven,evidence.positionFlatAfterExit,evidence.executionCostReconciled,
    [...evidence.evidenceIds],evidence.endedAt,
   ],
  )
  if((result.rowCount??result.rows.length)!==1)throw new Error('DEX_COMMISSION_STAGE4_EXISTS')
 }
 async putVerification(receipt:DexLiveCanaryVerificationReceipt):Promise<void>{
  if(receipt.source!=='COMMISSIONED_DEX_RUNTIME'||receipt.authority!=='RUNTIME_EVIDENCE_ONLY')throw new Error('DEX_COMMISSION_VERIFICATION_AUTHORITY_INVALID')
  const result=await this.client.query(
   `INSERT INTO ${this.verificationTable}(
     verification_id,stage_id,run_lineage_id,wallet_connection_id,entry_execution_id,exit_execution_id,
     stage_evidence_hash,provider_receipt_ids,onchain_signature_ids,provider_evidence_verified,onchain_evidence_verified,
     source,authority,verified_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT DO NOTHING RETURNING verification_id`,
   [
    receipt.verificationId,receipt.stageId,receipt.runLineageId,receipt.walletConnectionId,receipt.entryExecutionId,
    receipt.exitExecutionId,receipt.stageEvidenceHash,[...receipt.providerReceiptIds],[...receipt.onchainSignatureIds],
    receipt.providerEvidenceVerified,receipt.onchainEvidenceVerified,receipt.source,receipt.authority,receipt.verifiedAt,
   ],
  )
  if((result.rowCount??result.rows.length)!==1)throw new Error('DEX_COMMISSION_VERIFICATION_EXISTS')
 }
 async getStage(stageId:string):Promise<Readonly<{
  stageId:string
  stageEvidenceHash:string
  providerReceiptIds:readonly string[]
  onchainSignatureIds:readonly string[]
  observedAt:string
 }> | undefined>{
  const result=await this.client.query<StageRow>(`SELECT * FROM ${this.stageTable} WHERE stage_id=$1 LIMIT 1`,[stageId])
  const row=result.rows[0]
  return row?Object.freeze({
   stageId:row.stage_id,
   stageEvidenceHash:row.stage_evidence_hash,
   providerReceiptIds:Object.freeze(row.provider_receipt_ids??[]),
   onchainSignatureIds:Object.freeze(row.onchain_signature_ids??[]),
   observedAt:iso(row.observed_at),
  }):undefined
 }
 async getVerification(verificationId:string):Promise<DexLiveCanaryVerificationReceipt|undefined>{
  const result=await this.client.query<VerificationRow>(`SELECT * FROM ${this.verificationTable} WHERE verification_id=$1 LIMIT 1`,[verificationId])
  const row=result.rows[0]
  return row?Object.freeze({
   verificationId:row.verification_id,
   stageId:row.stage_id,
   runLineageId:row.run_lineage_id,
   walletConnectionId:row.wallet_connection_id,
   entryExecutionId:row.entry_execution_id,
   exitExecutionId:row.exit_execution_id,
   stageEvidenceHash:row.stage_evidence_hash,
   verifiedAt:iso(row.verified_at),
   providerReceiptIds:Object.freeze(row.provider_receipt_ids??[]),
   onchainSignatureIds:Object.freeze(row.onchain_signature_ids??[]),
   providerEvidenceVerified:row.provider_evidence_verified as true,
   onchainEvidenceVerified:row.onchain_evidence_verified as true,
   source:row.source,
   authority:row.authority,
  }):undefined
 }
}
