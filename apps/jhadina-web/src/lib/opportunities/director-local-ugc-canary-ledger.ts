import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {
  inspectDirectorLocalUgcCanaryCommissioning,
  type DirectorLocalUgcCanaryCommissioningDecision,
  type DirectorLocalUgcCanaryState,
} from '@jhadina/director-core/local-ugc-canary-commissioner'

const AUTHORITY='DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONING_EVIDENCE' as const
const SHA_RE=/^[a-f0-9]{64}$/
function sensitiveKey(key:string):boolean{
  const normalized=key.replace(/[^a-z0-9]/gi,'').toLowerCase()
  return ['authorization','token','secret','password','apikey','credential']
    .some(marker=>normalized.includes(marker))
}

type JsonScalar=null|boolean|number|string
type JsonValue=JsonScalar|JsonValue[]|{[key:string]:JsonValue}

type ReceiptRow={
  id:string
  project_id:string
  owner_user_id:string
  canary_id:string
  next_boundary:DirectorLocalUgcCanaryCommissioningDecision['nextBoundary']
  admissible_to_advance:boolean
  complete:boolean
  blockers:string[]
  evidence_ids:string[]
  realized_accepted_output_cost_usd:number|string|null
  snapshot_sha256:string
  commissioning_decision:DirectorLocalUgcCanaryCommissioningDecision
  canary_state:DirectorLocalUgcCanaryState
  authority:string
  observed_at:string
}

export type DirectorLocalUgcCanaryLedgerReceipt=Readonly<{
  id:string
  projectId:string
  ownerUserId:string
  canaryId:string
  decision:DirectorLocalUgcCanaryCommissioningDecision
  state:DirectorLocalUgcCanaryState
  snapshotSha256:string
  observedAt:string
  authority:typeof AUTHORITY
}>

function canonical(value:unknown):JsonValue{
  if(value===null)return null
  if(typeof value==='string'||typeof value==='boolean')return value
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_NONFINITE_NUMBER')
    return value
  }
  if(Array.isArray(value))return value.map(item=>canonical(item))
  if(typeof value==='object'){
    const result:Record<string,JsonValue>={}
    for(const [key,item] of Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b))){
      if(item===undefined)continue
      if(sensitiveKey(key))throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_SENSITIVE_FIELD_FORBIDDEN:'+key)
      result[key]=canonical(item)
    }
    return result
  }
  throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_VALUE_NOT_SERIALIZABLE')
}

function snapshotPayload(
  state:DirectorLocalUgcCanaryState,
  decision:DirectorLocalUgcCanaryCommissioningDecision,
):Readonly<{state:JsonValue;decision:JsonValue}>{
  return Object.freeze({state:canonical(state),decision:canonical(decision)})
}

function snapshotHash(
  state:DirectorLocalUgcCanaryState,
  decision:DirectorLocalUgcCanaryCommissioningDecision,
):string{
  return createHash('sha256')
    .update(JSON.stringify(snapshotPayload(state,decision)),'utf8')
    .digest('hex')
}

function numberOrUndefined(value:number|string|null):number|undefined{
  if(value===null)return undefined
  const parsed=typeof value==='number'?value:Number(value)
  if(!Number.isFinite(parsed)||parsed<0){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_COST_INVALID')
  }
  return parsed
}

function uniqueSorted(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>String(value).trim()).filter(Boolean))].sort()
}

function sameStrings(a:readonly string[],b:readonly string[]):boolean{
  const left=uniqueSorted(a),right=uniqueSorted(b)
  return left.length===right.length&&left.every((value,index)=>value===right[index])
}

function assertDecisionMatches(
  stored:DirectorLocalUgcCanaryCommissioningDecision,
  recomputed:DirectorLocalUgcCanaryCommissioningDecision,
):void{
  if(
    stored.canaryId!==recomputed.canaryId||
    stored.projectId!==recomputed.projectId||
    stored.nextBoundary!==recomputed.nextBoundary||
    stored.admissibleToAdvance!==recomputed.admissibleToAdvance||
    stored.complete!==recomputed.complete||
    stored.authority!==recomputed.authority||
    stored.canCreateCompute!==false||
    stored.canSpend!==false||
    stored.canApproveCreative!==false||
    stored.canPublish!==false||
    !sameStrings(stored.blockers,recomputed.blockers)||
    !sameStrings(stored.evidenceIds,recomputed.evidenceIds)
  ){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_DECISION_DRIFT')
  }
  const storedCost=stored.realizedAcceptedOutputCostUsd
  const recomputedCost=recomputed.realizedAcceptedOutputCostUsd
  if(
    storedCost!==undefined||recomputedCost!==undefined
  ){
    if(
      storedCost===undefined||
      recomputedCost===undefined||
      Math.abs(storedCost-recomputedCost)>.000001
    )throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_COST_DRIFT')
  }
}

function toReceipt(row:ReceiptRow):DirectorLocalUgcCanaryLedgerReceipt{
  if(row.authority!==AUTHORITY)throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_AUTHORITY_INVALID')
  if(!SHA_RE.test(String(row.snapshot_sha256??''))){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_HASH_INVALID')
  }
  if(!Number.isFinite(Date.parse(String(row.observed_at??'')))){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_TIME_INVALID')
  }
  const state=row.canary_state
  if(
    state.projectId!==row.project_id||
    state.canaryId!==row.canary_id
  )throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_STATE_IDENTITY_MISMATCH')

  const recomputed=inspectDirectorLocalUgcCanaryCommissioning(state)
  assertDecisionMatches(row.commissioning_decision,recomputed)
  if(
    row.next_boundary!==recomputed.nextBoundary||
    row.admissible_to_advance!==recomputed.admissibleToAdvance||
    row.complete!==recomputed.complete||
    !sameStrings(row.blockers,recomputed.blockers)||
    !sameStrings(row.evidence_ids,recomputed.evidenceIds)
  )throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_ROW_DRIFT')

  const rowCost=numberOrUndefined(row.realized_accepted_output_cost_usd)
  const expectedCost=recomputed.realizedAcceptedOutputCostUsd
  if(rowCost!==undefined||expectedCost!==undefined){
    if(
      rowCost===undefined||
      expectedCost===undefined||
      Math.abs(rowCost-expectedCost)>.000001
    )throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_ROW_COST_DRIFT')
  }

  const expectedHash=snapshotHash(state,recomputed)
  if(expectedHash!==row.snapshot_sha256){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_SNAPSHOT_HASH_MISMATCH')
  }

  return Object.freeze({
    id:String(row.id),
    projectId:row.project_id,
    ownerUserId:row.owner_user_id,
    canaryId:row.canary_id,
    decision:recomputed,
    state,
    snapshotSha256:row.snapshot_sha256,
    observedAt:row.observed_at,
    authority:AUTHORITY,
  })
}

function receiptSelect():string{
  return [
    'id','project_id','owner_user_id','canary_id','next_boundary',
    'admissible_to_advance','complete','blockers','evidence_ids',
    'realized_accepted_output_cost_usd','snapshot_sha256',
    'commissioning_decision','canary_state','authority','observed_at',
  ].join(',')
}

export async function persistDirectorLocalUgcCanarySnapshot(input:{
  client:SupabaseClient
  ownerUserId:string
  state:DirectorLocalUgcCanaryState
  observedAt?:string
}):Promise<DirectorLocalUgcCanaryLedgerReceipt>{
  const ownerUserId=input.ownerUserId.trim()
  if(!ownerUserId)throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_OWNER_REQUIRED')
  const decision=inspectDirectorLocalUgcCanaryCommissioning(input.state)
  const observedAt=input.observedAt??new Date().toISOString()
  if(!Number.isFinite(Date.parse(observedAt))){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_TIME_INVALID')
  }

  const payload=snapshotPayload(input.state,decision)
  const stateJson=payload.state as unknown as DirectorLocalUgcCanaryState
  const decisionJson=payload.decision as unknown as DirectorLocalUgcCanaryCommissioningDecision
  const digest=snapshotHash(input.state,decision)

  const row={
    project_id:decision.projectId,
    owner_user_id:ownerUserId,
    canary_id:decision.canaryId,
    next_boundary:decision.nextBoundary,
    admissible_to_advance:decision.admissibleToAdvance,
    complete:decision.complete,
    blockers:[...decision.blockers],
    evidence_ids:[...decision.evidenceIds],
    realized_accepted_output_cost_usd:decision.realizedAcceptedOutputCostUsd??null,
    snapshot_sha256:digest,
    commissioning_decision:decisionJson,
    canary_state:stateJson,
    authority:AUTHORITY,
    observed_at:observedAt,
  }

  const inserted=await input.client.from('director_local_ugc_canary_receipts')
    .insert(row)
    .select(receiptSelect())
    .single()

  if(!inserted.error&&inserted.data){
    return toReceipt(inserted.data as unknown as ReceiptRow)
  }

  const code=String((inserted.error as {code?:unknown}|null)?.code??'')
  if(code!=='23505'){
    throw new Error(
      'DIRECTOR_LOCAL_UGC_CANARY_LEDGER_WRITE_FAILED:'+
      String(inserted.error?.message??code??'unknown'),
    )
  }

  const existing=await input.client.from('director_local_ugc_canary_receipts')
    .select(receiptSelect())
    .eq('project_id',decision.projectId)
    .eq('owner_user_id',ownerUserId)
    .eq('canary_id',decision.canaryId)
    .eq('snapshot_sha256',digest)
    .maybeSingle()
  if(existing.error||!existing.data){
    throw new Error(
      'DIRECTOR_LOCAL_UGC_CANARY_LEDGER_IDEMPOTENT_READ_FAILED:'+
      String(existing.error?.message??'missing'),
    )
  }
  return toReceipt(existing.data as unknown as ReceiptRow)
}

export async function loadLatestDirectorLocalUgcCanarySnapshot(input:{
  client:SupabaseClient
  ownerUserId:string
  projectId:string
  canaryId:string
}):Promise<DirectorLocalUgcCanaryLedgerReceipt|undefined>{
  const ownerUserId=input.ownerUserId.trim()
  const projectId=input.projectId.trim()
  const canaryId=input.canaryId.trim()
  if(!ownerUserId||!projectId||!canaryId){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_IDENTITY_REQUIRED')
  }
  const query=await input.client.from('director_local_ugc_canary_receipts')
    .select(receiptSelect())
    .eq('project_id',projectId)
    .eq('owner_user_id',ownerUserId)
    .eq('canary_id',canaryId)
    .order('observed_at',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(query.error){
    throw new Error('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_READ_FAILED:'+query.error.message)
  }
  return query.data?toReceipt(query.data as unknown as ReceiptRow):undefined
}
