import {NextRequest,NextResponse} from 'next/server'
import {assertCreatorPersistenceCommissioned} from '@/lib/social/creator-persistence-boundary'
import {createClient} from '@/lib/supabase/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {validateFreeCampaignRecord,FREE_CAMPAIGN_RECORD_KINDS,planCollaborationTransition} from '@jhadina/growth-core'
import type {FreeCampaignRecord,FreeCampaignRecordKind,FreeCollaborationStage} from '@jhadina/growth-core'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'cache-control':'no-store'}
const allowedBrands=new Set(['pupsonstuff','atwood-bookie','bookieandco','truckeros','jhadina','jhadina-music','jhadinatv','overageos'])
const validRef=(v:unknown)=>typeof v==='string'&&v.trim().length>=2&&v.trim().length<=160
type Row={record_id:string;kind:FreeCampaignRecordKind;brand_id:string;campaign_ref:string|null;source_key:string;
 payload:Record<string,unknown>;evidence_refs:string[];observed_at:string;revision:number;updated_at:string;archived_at:string|null}
const pick='record_id,kind,brand_id,campaign_ref,source_key,payload,evidence_refs,observed_at,revision,updated_at,archived_at'
const mapRow=(row:Row)=>({id:row.record_id,kind:row.kind,brandId:row.brand_id,campaignRef:row.campaign_ref,
 sourceKey:row.source_key,payload:row.payload,evidenceRefs:row.evidence_refs,observedAt:row.observed_at,
 revision:row.revision,updatedAt:row.updated_at,authority:'DRAFT_ONLY',externalActionAuthorized:false,moneyMovementAuthorized:false})
function err(error:unknown){
 const message=error instanceof Error?error.message:'SOCIAL_FREE_UNKNOWN'
 const status=/Authenticated|identity|session/i.test(message)?401:
  message==='SOCIAL_FREE_ORIGIN_FORBIDDEN'?403:
  message==='SOCIAL_FREE_STORAGE_UNAVAILABLE'||message==='SOCIAL_FREE_NOT_COMMISSIONED'?503:
  message==='SOCIAL_FREE_REVISION_CONFLICT'?409:
  message.startsWith('SOCIAL_FREE_')||message.startsWith('SOCIAL_FREE_RECORD')?400:502
 return NextResponse.json({ok:false,error:status===502?'SOCIAL_FREE_REQUEST_FAILED':message,
  externalActionAuthorized:false,moneyMovementAuthorized:false},{status,headers})
}
async function context(){
 const verifier=await createRequestIdentityVerifier()
 const identity=await verifier.verify({})
 // SSR session JWT and database RLS are the authority; never use service role for this route.
 const client=await createClient()
 return {owner:identity.userId,client}
}
async function bodyJson(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)throw Error('SOCIAL_FREE_ORIGIN_FORBIDDEN')
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('SOCIAL_FREE_JSON_REQUIRED')
 if(Number(request.headers.get('content-length')||'0')>20000)throw Error('SOCIAL_FREE_BODY_TOO_LARGE')
 const raw=await request.text()
 if(raw.length>20000)throw Error('SOCIAL_FREE_BODY_TOO_LARGE')
 let value:unknown
 try{value=JSON.parse(raw)}catch{throw Error('SOCIAL_FREE_JSON_INVALID')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('SOCIAL_FREE_BODY_INVALID')
 return value as Record<string,unknown>
}
function makeRecord(body:Record<string,unknown>,allowNonDraft=false){
 if(Object.keys(body).some(x=>!['kind','brandId','campaignRef','sourceKey','payload','evidenceRefs','observedAt','revision','id','archive'].includes(x)))
  throw Error('SOCIAL_FREE_UNEXPECTED_FIELD')
 if(typeof body.kind!=='string'||!FREE_CAMPAIGN_RECORD_KINDS.includes(body.kind as FreeCampaignRecordKind)||
  !allowedBrands.has(String(body.brandId)))throw Error('SOCIAL_FREE_KIND_OR_BRAND_INVALID')
 if(!validRef(body.sourceKey))throw Error('SOCIAL_FREE_SOURCE_KEY_REQUIRED')
 if(body.campaignRef!==undefined&&body.campaignRef!==null&&!validRef(body.campaignRef))
  throw Error('SOCIAL_FREE_CAMPAIGN_REF_INVALID')
 if(!Array.isArray(body.evidenceRefs)||body.evidenceRefs.length>30)throw Error('SOCIAL_FREE_EVIDENCE_INVALID')
 if(!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))throw Error('SOCIAL_FREE_PAYLOAD_INVALID')
 const record:FreeCampaignRecord={
  id:'preview:record',kind:body.kind as FreeCampaignRecordKind,brandId:String(body.brandId),
  campaignRef:body.campaignRef==null?null:String(body.campaignRef),payload:body.payload as Record<string,unknown>,
  evidenceRefs:body.evidenceRefs as string[],observedAt:String(body.observedAt||''),
  status:'DRAFT_ONLY',externalActionAuthorized:false,moneyMovementAuthorized:false
 }
 validateFreeCampaignRecord(record)
 if(record.kind==='collaboration'&&(!allowNonDraft&&record.payload.lifecycleStage!=='draft'))
  throw Error('SOCIAL_FREE_COLLABORATION_START_DRAFT_REQUIRED')
 return {kind:record.kind,brand_id:record.brandId,campaign_ref:record.campaignRef,source_key:String(body.sourceKey),
  payload:record.payload,evidence_refs:record.evidenceRefs,observed_at:record.observedAt,
  status:'DRAFT_ONLY',external_action_authorized:false,money_movement_authorized:false}
}
export async function GET(request:NextRequest){
 try{
  const {owner,client}=await context()
  const brand=request.nextUrl.searchParams.get('brand')
  const kind=request.nextUrl.searchParams.get('kind')
  if(brand&&!allowedBrands.has(brand))throw Error('SOCIAL_FREE_BRAND_INVALID')
  if(kind&&!FREE_CAMPAIGN_RECORD_KINDS.includes(kind as FreeCampaignRecordKind))throw Error('SOCIAL_FREE_KIND_INVALID')
  let query=client.from('jhadina_creator_campaign_records').select(pick).eq('owner_user_id',owner).is('archived_at',null)
   .order('updated_at',{ascending:false}).limit(100)
  if(brand)query=query.eq('brand_id',brand)
  if(kind)query=query.eq('kind',kind)
  const {data,error}=await query.returns<Row[]>()
  if(error)throw Error('SOCIAL_FREE_STORAGE_UNAVAILABLE')
  return NextResponse.json({ok:true,records:(data??[]).map(mapRow),externalActionAuthorized:false},{headers})
 }catch(error){return err(error)}
}
export async function POST(request:NextRequest){
 try{
  assertCreatorPersistenceCommissioned()
  const {owner,client}=await context(),body=await bodyJson(request),input=makeRecord(body)
  if(body.id!==undefined||body.revision!==undefined||body.archive!==undefined)throw Error('SOCIAL_FREE_CREATE_FIELDS_INVALID')
  const {data,error}=await client.from('jhadina_creator_campaign_records')
   .insert({...input,owner_user_id:owner}).select(pick).single<Row>()
  if(error){if(error.code==='23505')throw Error('SOCIAL_FREE_REVISION_CONFLICT');throw Error('SOCIAL_FREE_STORAGE_UNAVAILABLE')}
  return NextResponse.json({ok:true,record:mapRow(data),externalActionAuthorized:false},{status:201,headers})
 }catch(error){return err(error)}
}
export async function PATCH(request:NextRequest){
 try{
  assertCreatorPersistenceCommissioned()
  const {owner,client}=await context(),body=await bodyJson(request),input=makeRecord(body,true)
  if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id)||!Number.isInteger(body.revision)||
   Number(body.revision)<1||Number(body.revision)>999999)throw Error('SOCIAL_FREE_REVISION_REQUIRED')
  if(body.archive!==undefined&&body.archive!==true)throw Error('SOCIAL_FREE_ARCHIVE_INVALID')
  if(input.kind==='collaboration'){
   const {data:existing,error:readError}=await client.from('jhadina_creator_campaign_records')
    .select('payload,revision').eq('owner_user_id',owner).eq('record_id',body.id).eq('kind','collaboration')
    .eq('revision',body.revision).is('archived_at',null)
    .maybeSingle<{payload:Record<string,unknown>;revision:number}>()
   if(readError)throw Error('SOCIAL_FREE_STORAGE_UNAVAILABLE')
   if(!existing)throw Error('SOCIAL_FREE_REVISION_CONFLICT')
   const previous=existing.payload.lifecycleStage
   const next=input.payload.lifecycleStage
   if(typeof previous!=='string'||typeof next!=='string')throw Error('SOCIAL_FREE_STAGE_REQUIRED')
   if(previous!==next){
    planCollaborationTransition({from:previous as FreeCollaborationStage,to:next as FreeCollaborationStage,
     evidenceRefs:input.evidence_refs,source:'manual_record'})
   }
  }
  const changes={...input,revision:Number(body.revision)+1,updated_at:new Date().toISOString(),
   ...(body.archive===true?{archived_at:new Date().toISOString()}:{})}
  const {data,error}=await client.from('jhadina_creator_campaign_records').update(changes)
   .eq('owner_user_id',owner).eq('record_id',body.id).eq('revision',body.revision)
   .eq('kind',input.kind).eq('brand_id',input.brand_id).eq('source_key',input.source_key)
   .is('archived_at',null).select(pick).maybeSingle<Row>()
  if(error)throw Error('SOCIAL_FREE_STORAGE_UNAVAILABLE')
  if(!data)throw Error('SOCIAL_FREE_REVISION_CONFLICT')
  return NextResponse.json({ok:true,record:mapRow(data),externalActionAuthorized:false},{headers})
 }catch(error){return err(error)}
}
