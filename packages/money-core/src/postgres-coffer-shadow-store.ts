import type { SqlClient } from './postgres-idempotency-store.js'
import type { CofferShadowRun,CofferShadowStore } from './coffer-shadow-final.js'
import type { DexRouteDecision,DexRouteAttempt } from './dex-route-router.js'
import type { DexRouteGateDecision,DexRouteQuote } from './dex-route-gate.js'
import type { DexExecutionStageEvidence,DexStageCertification } from './dex-four-stage-certification.js'

type ShadowRow=Readonly<{
 shadow_run_id:string
 user_id:string
 run_lineage_id:string
 strategy_id:string
 instrument_id:string
 observed_at:string|Date
 selected_provider:string|null
 route_decision:unknown
 stage_evidence:unknown
 certification:unknown
 signed_transaction_count:number
 broadcast_count:number
 financial_authority:'NONE'
 authority:'COFFER_SHADOW_EVIDENCE_ONLY'
}>

function safe(value:string):string{
 if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))throw new Error('COFFER_SHADOW_TABLE_INVALID')
 return value
}
function iso(value:string|Date):string{return value instanceof Date?value.toISOString():new Date(value).toISOString()}
function record(value:unknown,code:string):Record<string,unknown>{
 if(typeof value==='string'){
  try{return record(JSON.parse(value),code)}catch{throw new Error(code)}
 }
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code)
 return value as Record<string,unknown>
}
function strings(value:unknown):readonly string[]{
 if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new Error('COFFER_SHADOW_JSON_STRING_ARRAY_INVALID')
 return Object.freeze([...value] as string[])
}
function integer(value:unknown,code:string):number{
 if(typeof value!=='number'||!Number.isInteger(value)||value<0)throw new Error(code)
 return value
}
function bigint(value:unknown,code:string):bigint{
 if(typeof value==='bigint')return value
 if(typeof value==='string'&&/^\d+$/.test(value))return BigInt(value)
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return BigInt(value)
 throw new Error(code)
}
function optionalInt(value:unknown):number|undefined{
 if(value===undefined||value===null)return undefined
 return integer(value,'COFFER_SHADOW_JSON_INTEGER_INVALID')
}
function optionalBigint(value:unknown):bigint|undefined{
 if(value===undefined||value===null)return undefined
 return bigint(value,'COFFER_SHADOW_JSON_BIGINT_INVALID')
}
function json(value:unknown):unknown{
 return JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item))
}

function hydrateQuote(value:unknown):DexRouteQuote{
 const x=record(value,'COFFER_SHADOW_QUOTE_INVALID')
 const provider=x.provider
 if(provider!=='jupiter-swap-v2'&&provider!=='raydium-direct'&&provider!=='meteora-direct')throw new Error('COFFER_SHADOW_QUOTE_PROVIDER_INVALID')
 if(x.authority!=='ROUTE_QUOTE_EVIDENCE_ONLY'||x.canExecute!==false)throw new Error('COFFER_SHADOW_QUOTE_AUTHORITY_INVALID')
 return Object.freeze({
  quoteId:String(x.quoteId??''),provider,inputMint:String(x.inputMint??''),outputMint:String(x.outputMint??''),
  inputAmountAtomic:bigint(x.inputAmountAtomic,'COFFER_SHADOW_INPUT_AMOUNT_INVALID'),
  quotedOutputAtomic:bigint(x.quotedOutputAtomic,'COFFER_SHADOW_OUTPUT_AMOUNT_INVALID'),
  minimumOutputAtomic:bigint(x.minimumOutputAtomic,'COFFER_SHADOW_MIN_OUTPUT_INVALID'),
  quotedAt:String(x.quotedAt??''),expiresAt:x.expiresAt==null?undefined:String(x.expiresAt),
  priceImpactBps:optionalInt(x.priceImpactBps),feeBps:integer(x.feeBps,'COFFER_SHADOW_FEE_BPS_INVALID'),
  liquidityMinor:optionalBigint(x.liquidityMinor),evidenceIds:strings(x.evidenceIds),
  authority:'ROUTE_QUOTE_EVIDENCE_ONLY' as const,canExecute:false as const,
 })
}
function hydrateGate(value:unknown):DexRouteGateDecision{
 const x=record(value,'COFFER_SHADOW_GATE_INVALID')
 const provider=x.provider
 if(provider!=='jupiter-swap-v2'&&provider!=='raydium-direct'&&provider!=='meteora-direct')throw new Error('COFFER_SHADOW_GATE_PROVIDER_INVALID')
 if(x.disposition!=='PASS'&&x.disposition!=='BLOCK')throw new Error('COFFER_SHADOW_GATE_DISPOSITION_INVALID')
 if(x.authority!=='MONEY_DEX_GATE_DECISION'||x.canExecute!==false)throw new Error('COFFER_SHADOW_GATE_AUTHORITY_INVALID')
 return Object.freeze({
  quoteId:String(x.quoteId??''),provider,disposition:x.disposition,reasonCodes:strings(x.reasonCodes),
  observedSlippageBps:integer(x.observedSlippageBps,'COFFER_SHADOW_GATE_SLIPPAGE_INVALID'),
  observedPriceImpactBps:optionalInt(x.observedPriceImpactBps),
  quoteAgeMs:integer(x.quoteAgeMs,'COFFER_SHADOW_GATE_AGE_INVALID'),
  evidenceIds:strings(x.evidenceIds),authority:'MONEY_DEX_GATE_DECISION' as const,canExecute:false as const,
 })
}
function hydrateAttempt(value:unknown):DexRouteAttempt{
 const x=record(value,'COFFER_SHADOW_ATTEMPT_INVALID')
 const provider=x.provider
 if(provider!=='jupiter-swap-v2'&&provider!=='raydium-direct'&&provider!=='meteora-direct')throw new Error('COFFER_SHADOW_ATTEMPT_PROVIDER_INVALID')
 if(x.authority!=='ROUTE_ATTEMPT_EVIDENCE_ONLY')throw new Error('COFFER_SHADOW_ATTEMPT_AUTHORITY_INVALID')
 return Object.freeze({
  provider,
  quote:x.quote==null?undefined:hydrateQuote(x.quote),
  gate:x.gate==null?undefined:hydrateGate(x.gate),
  errorCode:x.errorCode==null?undefined:String(x.errorCode),
  authority:'ROUTE_ATTEMPT_EVIDENCE_ONLY' as const,
 })
}
function hydrateRouteDecision(value:unknown):DexRouteDecision{
 const x=record(value,'COFFER_SHADOW_ROUTE_INVALID')
 if(x.authority!=='ROUTE_SELECTION_ONLY'||x.canSign!==false||x.canBroadcast!==false)throw new Error('COFFER_SHADOW_ROUTE_AUTHORITY_INVALID')
 if(!Array.isArray(x.attempts))throw new Error('COFFER_SHADOW_ROUTE_ATTEMPTS_INVALID')
 return Object.freeze({
  routeDecisionId:String(x.routeDecisionId??''),
  selected:x.selected==null?undefined:hydrateQuote(x.selected),
  attempts:Object.freeze(x.attempts.map(hydrateAttempt)),
  reasonCodes:strings(x.reasonCodes),
  authority:'ROUTE_SELECTION_ONLY' as const,canSign:false as const,canBroadcast:false as const,
 })
}

export function serializeCofferShadowRun(run:CofferShadowRun):Readonly<{
 routeDecision:unknown
 stageEvidence:unknown
 certification:unknown
}>{
 return Object.freeze({
  routeDecision:json(run.routeDecision),
  stageEvidence:json(run.stageEvidence),
  certification:json(run.certification),
 })
}

function hydrateRun(row:ShadowRow):CofferShadowRun{
 if(row.signed_transaction_count!==0||row.broadcast_count!==0||row.financial_authority!=='NONE'||row.authority!=='COFFER_SHADOW_EVIDENCE_ONLY'){
  throw new Error('COFFER_SHADOW_DURABLE_AUTHORITY_INVARIANT_FAILED')
 }
 const stage=record(row.stage_evidence,'COFFER_SHADOW_STAGE_INVALID') as unknown as DexExecutionStageEvidence
 const certification=record(row.certification,'COFFER_SHADOW_CERTIFICATION_INVALID') as unknown as DexStageCertification
 return Object.freeze({
  shadowRunId:row.shadow_run_id,userId:row.user_id,runLineageId:row.run_lineage_id,strategyId:row.strategy_id,instrumentId:row.instrument_id,
  observedAt:iso(row.observed_at),routeDecision:hydrateRouteDecision(row.route_decision),
  stageEvidence:Object.freeze(stage),certification:Object.freeze(certification),
  signedTransactionCount:0 as const,broadcastCount:0 as const,financialAuthority:'NONE' as const,authority:'COFFER_SHADOW_EVIDENCE_ONLY' as const,
 })
}

export class PostgresCofferShadowStore implements CofferShadowStore{
 private readonly table:string
 constructor(private readonly client:SqlClient,tableName='money_dex_shadow_runs'){
  this.table=safe(tableName)
 }
 async put(run:CofferShadowRun):Promise<void>{
  if(run.signedTransactionCount!==0||run.broadcastCount!==0||run.financialAuthority!=='NONE'||run.authority!=='COFFER_SHADOW_EVIDENCE_ONLY'){
   throw new Error('COFFER_SHADOW_AUTHORITY_INVARIANT_FAILED')
  }
  const payload=serializeCofferShadowRun(run)
  const result=await this.client.query(
   `INSERT INTO ${this.table}(
     shadow_run_id,user_id,run_lineage_id,strategy_id,instrument_id,observed_at,selected_provider,
     route_decision,stage_evidence,certification,signed_transaction_count,broadcast_count,financial_authority,authority
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,0,0,'NONE','COFFER_SHADOW_EVIDENCE_ONLY')
    ON CONFLICT DO NOTHING RETURNING shadow_run_id`,
   [
    run.shadowRunId,run.userId,run.runLineageId,run.strategyId,run.instrumentId,run.observedAt,run.routeDecision.selected?.provider??null,
    JSON.stringify(payload.routeDecision),JSON.stringify(payload.stageEvidence),JSON.stringify(payload.certification),
   ],
  )
  if((result.rowCount??result.rows.length)!==1)throw new Error('COFFER_SHADOW_DUPLICATE_RUN')
 }
 async get(shadowRunId:string):Promise<CofferShadowRun|undefined>{
  const result=await this.client.query<ShadowRow>(`SELECT * FROM ${this.table} WHERE shadow_run_id=$1 LIMIT 1`,[shadowRunId])
  return result.rows[0]?hydrateRun(result.rows[0]):undefined
 }
}
