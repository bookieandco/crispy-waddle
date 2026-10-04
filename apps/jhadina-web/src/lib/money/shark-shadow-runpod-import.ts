import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'

export type RunpodShadowImportRecord=Readonly<{
  recordType:'DECISION'|'EXECUTION'|'OBSERVATION'|'LESSON'|'CALIBRATION'|'MEMORY'|'REPLAY'
  recordId:string
  payload:unknown
  createdAt?:string
}>

export type RunpodShadowImportReceipt=Readonly<{
  accepted:number
  replayed:number
  rejected:number
  failures:readonly Readonly<{recordType:string;recordId:string;reason:string}>[]
  authority:'SHADOW_IMPORT_EVIDENCE_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

const allowed=new Set(['DECISION','EXECUTION','OBSERVATION','LESSON','CALIBRATION','MEMORY','REPLAY'])
const stable=(value:unknown)=>JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)
const sha=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex')

function validate(record:RunpodShadowImportRecord):void{
  if(!allowed.has(record.recordType))throw new Error('RUNPOD_SHADOW_IMPORT_TYPE_INVALID')
  if(!record.recordId.trim())throw new Error('RUNPOD_SHADOW_IMPORT_ID_REQUIRED')
  if(record.createdAt&&Number.isNaN(Date.parse(record.createdAt)))throw new Error('RUNPOD_SHADOW_IMPORT_TIME_INVALID')
  if(record.payload===undefined)throw new Error('RUNPOD_SHADOW_IMPORT_PAYLOAD_REQUIRED')
}

export async function importRunpodShadowBatch(
  client:SupabaseClient,
  records:readonly RunpodShadowImportRecord[],
):Promise<RunpodShadowImportReceipt>{
  if(records.length>500)throw new Error('RUNPOD_SHADOW_IMPORT_BATCH_TOO_LARGE')
  let accepted=0,replayed=0,rejected=0
  const failures:Array<{recordType:string;recordId:string;reason:string}>=[]
  for(const record of records){
    try{
      validate(record)
      const payloadSha=sha(record.payload)
      const importId='runpod-shadow-import:'+sha({recordType:record.recordType,recordId:record.recordId})
      const {data,error}=await client.from('money_shark_shadow_runpod_imports').insert({
        import_id:importId,
        record_type:record.recordType,
        record_id:record.recordId,
        payload_sha256:payloadSha,
        payload_json:JSON.parse(stable(record.payload)),
        source_created_at:record.createdAt??null,
        authority:'SHADOW_IMPORT_EVIDENCE_ONLY',
        can_execute:false,
        can_authorize_live:false,
      }).select('import_id').maybeSingle()
      if(!error&&data){accepted++;continue}
      if(error?.code!=='23505')throw new Error('RUNPOD_SHADOW_IMPORT_WRITE_FAILED:'+(error?.message??'unknown'))
      const {data:prior,error:readError}=await client.from('money_shark_shadow_runpod_imports')
        .select('payload_sha256').eq('record_type',record.recordType).eq('record_id',record.recordId).maybeSingle()
      if(readError||!prior)throw new Error('RUNPOD_SHADOW_IMPORT_REPLAY_READ_FAILED:'+(readError?.message??'missing'))
      if(String((prior as any).payload_sha256)!==payloadSha)throw new Error('RUNPOD_SHADOW_IMPORT_CONFLICT')
      replayed++
    }catch(error){
      rejected++
      failures.push({recordType:record.recordType,recordId:record.recordId,reason:error instanceof Error?error.message:String(error)})
    }
  }
  return Object.freeze({
    accepted,replayed,rejected,failures:Object.freeze(failures),
    authority:'SHADOW_IMPORT_EVIDENCE_ONLY',canExecute:false,canAuthorizeLive:false,
  })
}
