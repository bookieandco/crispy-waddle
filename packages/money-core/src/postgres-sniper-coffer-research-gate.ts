import {createHash} from 'node:crypto'
import type {SqlClient} from './postgres-idempotency-store.js'
import {assertDexSwapIntent,hashDexRuntime,type DexSwapIntent} from './solana-dex-runtime-contracts.js'
import {dexExecutionAction} from './dex-controlled-canary-runtime.js'
import {verifyExecutionPermit,type ExecutionPermit,
 type PermitVerificationContext} from './execution-permit.js'

/** LIVE-COMMISSION.46: Research-only adapter. Not a signer, not a permit
 * consumer, not a trading authorization. Requires privileged, private PG. */
export type DistributedResearchAdmission=Readonly<{
 admitted:boolean;reasonCodes:readonly string[];researchHoldId?:string
 canSign:false;canSubmit:false;canBroadcast:false;canCreditPurse:false
 authority:'DISTRIBUTED_RESEARCH_HOLD_ONLY'
}>
type Row={admitted:boolean;reason:string;research_hold_id:string|null}
export class PostgresSniperCofferResearchGate{
 constructor(private readonly client:SqlClient){}
 async requestResearchHold(input:{
  intent:DexSwapIntent;permit:ExecutionPermit
  context:Omit<PermitVerificationContext,'action'|'now'>
  expectedResearchPolicyHash:string;expectedCanaryVersion:number
  observedAt:string
 }):Promise<DistributedResearchAdmission>{
  const {intent:i,permit}=input
  assertDexSwapIntent(i)
  if(i.leg!=='ENTRY'||!input.expectedResearchPolicyHash.trim()||
     !Number.isSafeInteger(input.expectedCanaryVersion)||
     input.expectedCanaryVersion<0||
     !Number.isFinite(Date.parse(input.observedAt))){
   throw Error('SNIPER_DISTRIBUTED_RESEARCH_INPUT_INVALID')
  }
  // Operator-owned ActionRequest and Action Core provenance, not browser input.
  verifyExecutionPermit(permit,{
   ...input.context,action:dexExecutionAction(i),now:input.observedAt,
  })
  const digest=createHash('sha256')
    .update([i.walletConnectionId,i.executionId,i.idempotencyKey].join('|'))
    .digest('hex')
  const holdId='sniper-research:'+digest
  const rows=await this.client.query<Row>(
   `select admitted,reason,research_hold_id
    from public.money_sniper_coffer_hold_research(
      $1::text,$2::text,$3::text,$4::text,$5::text,$6::text,
      $7::text,$8::text,$9::bigint,$10::text,$11::integer,$12::timestamptz
    )`,
   [holdId,i.walletConnectionId,i.userId,i.idempotencyKey,
    i.executionId,permit.permitId,permit.binding.actionFingerprint,
    hashDexRuntime(i),i.notionalMinor.toString(),
    input.expectedResearchPolicyHash,input.expectedCanaryVersion,input.observedAt],
  )
  if(rows.rows.length!==1||typeof rows.rows[0]?.admitted!=='boolean'||
     typeof rows.rows[0]?.reason!=='string')
   throw Error('SNIPER_DISTRIBUTED_RESEARCH_DB_RESPONSE_INVALID')
  const row=rows.rows[0]
  if(row.admitted&&(row.reason!=='RESEARCH_ONLY_NO_SIGN_AUTHORITY'||
     row.research_hold_id!==holdId))
   throw Error('SNIPER_DISTRIBUTED_RESEARCH_DB_BINDING_MISMATCH')
  if(!row.admitted&&row.research_hold_id!==null)
   throw Error('SNIPER_DISTRIBUTED_RESEARCH_UNEXPECTED_HOLD')
  return Object.freeze({
   admitted:row.admitted,reasonCodes:Object.freeze([row.reason]),
   ...(row.admitted?{researchHoldId:holdId}:{}),
   canSign:false,canSubmit:false,canBroadcast:false,canCreditPurse:false,
   authority:'DISTRIBUTED_RESEARCH_HOLD_ONLY',
  })
 }
}
