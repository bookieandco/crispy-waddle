import {createHash} from 'node:crypto'
import type {SqlClient} from './postgres-idempotency-store.js'
import {assertDexSwapIntent,hashDexRuntime,type DexSwapIntent,
 type DexManagedOrder} from './solana-dex-runtime-contracts.js'
import {sha256UnsignedTransaction} from './sniper-transaction-byte-audit.js'
import type {SniperSignerReview} from './sniper-signer-certification.js'
import type {ExecutionPermit,PermitVerificationContext} from './execution-permit.js'
import {verifyExecutionPermit} from './execution-permit.js'
import {dexExecutionAction} from './dex-controlled-canary-runtime.js'

/** 51–55: private operator, durable PRE-SIGN HOLD ONLY.
 * No method here calls a signer, consumes a permit, or broadcasts.
 */
export type SniperPreSignReceipt=Readonly<{
 admitted:boolean;reasonCodes:readonly string[];presignId?:string
 unsignedTransactionHash:string
 signerNeverInvoked:true;moneyPermitNotConsumed:true
 canSign:false;canBroadcast:false;canTrade:false;canRetry:false
 authority:'PRESIGN_DURABILITY_EVIDENCE_ONLY'
}>
export type SniperPreSignState='PRESIGN_HELD'|'SIGNING_UNKNOWN'|
 'SETTLEMENT_UNKNOWN'|'RECONCILED_OBSERVED'|'REVOKED_HOLD'
export type SniperRecoveryDisposition=Readonly<{
 status:'NO_RECORD_MANUAL_CHECK'|'UNSIGNED_HOLD'|
  'UNKNOWN_FREEZE_AND_RECONCILE'|'OBSERVED_ONLY'|'REVOKED_NO_RETRY'
 requiresHumanReconciliation:boolean
 canRetry:false;canSign:false;canBroadcast:false
 authority:'PRESIGN_RECOVERY_REVIEW_ONLY'
}>
const valid=(x:string)=>x.trim().length>0&&x.length<257
type StageRow={admitted:boolean;reason:string;presign_id:string|null}
type StateRow={state:SniperPreSignState;unsigned_transaction_hash:string;
 wallet_connection_id:string;idempotency_key:string;permit_id:string;
 signer_lease_id:string}
export class PostgresSniperPreSignGate{
 constructor(private readonly database:SqlClient){}
 async stage(input:{
  intent:DexSwapIntent;order:DexManagedOrder
  researchHoldId:string;signerReview:SniperSignerReview
  permit:ExecutionPermit
  permitContext:Omit<PermitVerificationContext,'action'|'now'>
  at:string
 }):Promise<SniperPreSignReceipt>{
  const {intent:i,order:o,signerReview:r}=input
  assertDexSwapIntent(i)
  if(!valid(input.researchHoldId)||!Number.isFinite(Date.parse(input.at))||
    r.disposition!=='RESEARCH_OBSERVATION_MATCHED'||
    r.authority!=='SIGNER_RESEARCH_ONLY'||r.reasonCodes.length||
    r.canSign!==false||r.canSubmit!==false||r.canRetry!==false||
    i.leg!=='ENTRY'||o.authority!=='PROVIDER_QUOTE_ONLY'||
    o.canBroadcast!==false||o.provider!==i.provider||
    o.takerAddress.trim().length<32||
    o.inputMint!==i.inputMint||o.outputMint!==i.outputMint||
    o.inputAmountAtomic!==i.inputAmountAtomic){
   throw Error('SNIPER_PRESIGN_CANDIDATE_NOT_CERTIFIED')
  }
  const hash=sha256UnsignedTransaction(o.unsignedTransactionBase64)
  if(r.transactionSha256!==hash)throw Error('SNIPER_PRESIGN_MESSAGE_HASH_MISMATCH')
  verifyExecutionPermit(input.permit,{
   ...input.permitContext,action:dexExecutionAction(i),now:input.at,
  })
  // Stable ID binds original decision, lease and exact unsigned bytes.
  const id='sniper-presign:'+createHash('sha256')
    .update(JSON.stringify({
     executionId:i.executionId,leaseId:i.signerLeaseId,
     idempotencyKey:i.idempotencyKey,hash,
    })).digest('hex')
  const q=await this.database.query<StageRow>(
   `select admitted,reason,presign_id
    from public.money_sniper_signer_stage_presign(
      $1::text,$2::text,$3::text,$4::text,$5::text,
      $6::text,$7::text,$8::text,$9::text,$10::text
    )`,
   [id,input.researchHoldId,i.walletConnectionId,i.userId,i.executionId,
    i.idempotencyKey,input.permit.permitId,i.signerLeaseId,
    hashDexRuntime(i),hash],
  )
  if(q.rows.length!==1||typeof q.rows[0]?.admitted!=='boolean'||
    typeof q.rows[0]?.reason!=='string')throw Error('SNIPER_PRESIGN_DB_RESPONSE_INVALID')
  const row=q.rows[0]
  if((row.admitted&&(row.reason!=='UNSIGNED_HOLD_ONLY'||row.presign_id!==id))||
    (!row.admitted&&row.presign_id!==null))
   throw Error('SNIPER_PRESIGN_DB_RESULT_NOT_BOUND')
  return Object.freeze({
   admitted:row.admitted,reasonCodes:Object.freeze([row.reason]),
   ...(row.admitted?{presignId:id}:{}),
   unsignedTransactionHash:hash,
   signerNeverInvoked:true,moneyPermitNotConsumed:true,
   canSign:false,canBroadcast:false,canTrade:false,canRetry:false,
   authority:'PRESIGN_DURABILITY_EVIDENCE_ONLY',
  })
 }
 /** Read-only classification; NO method transitions an uncertain order
  * back to a signable state or releases capital. */
 async inspect(input:{
  presignId:string;walletConnectionId:string;idempotencyKey:string
 }):Promise<SniperRecoveryDisposition>{
  if(!valid(input.presignId)||!valid(input.walletConnectionId)||
     !valid(input.idempotencyKey))throw Error('SNIPER_PRESIGN_INSPECTION_INVALID')
  const q=await this.database.query<StateRow>(
   `select state,unsigned_transaction_hash,wallet_connection_id,
      idempotency_key,permit_id,signer_lease_id
    from public.money_sniper_signer_presign_intents
    where presign_id=$1 and wallet_connection_id=$2 and idempotency_key=$3
    limit 1`,
   [input.presignId,input.walletConnectionId,input.idempotencyKey],
  )
  if(q.rows.length>1)throw Error('SNIPER_PRESIGN_DB_CONFLICT')
  const row=q.rows[0]
  if(!row)return Object.freeze({
   status:'NO_RECORD_MANUAL_CHECK',requiresHumanReconciliation:true,
   canRetry:false,canSign:false,canBroadcast:false,
   authority:'PRESIGN_RECOVERY_REVIEW_ONLY',
  })
  if(row.wallet_connection_id!==input.walletConnectionId||
    row.idempotency_key!==input.idempotencyKey||
    !valid(row.signer_lease_id)||!valid(row.permit_id)||
    !/^[a-f0-9]{64}$/.test(row.unsigned_transaction_hash))
   throw Error('SNIPER_PRESIGN_RECOVERY_ROW_INVALID')
  const states:Record<SniperPreSignState,SniperRecoveryDisposition['status']>={
   PRESIGN_HELD:'UNSIGNED_HOLD',
   SIGNING_UNKNOWN:'UNKNOWN_FREEZE_AND_RECONCILE',
   SETTLEMENT_UNKNOWN:'UNKNOWN_FREEZE_AND_RECONCILE',
   RECONCILED_OBSERVED:'OBSERVED_ONLY',
   REVOKED_HOLD:'REVOKED_NO_RETRY',
  }
  if(!Object.prototype.hasOwnProperty.call(states,row.state))
   throw Error('SNIPER_PRESIGN_RECOVERY_STATE_INVALID')
  const status=states[row.state]
  return Object.freeze({
   status,requiresHumanReconciliation:status!=='OBSERVED_ONLY',
   canRetry:false,canSign:false,canBroadcast:false,
   authority:'PRESIGN_RECOVERY_REVIEW_ONLY',
  })
 }
}
