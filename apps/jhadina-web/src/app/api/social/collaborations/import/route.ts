import {NextRequest,NextResponse} from 'next/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {createClient} from '@/lib/supabase/server'
import {prepareManualCreatorImport} from '@jhadina/growth-core'
import type {ImportedCreatorLead} from '@jhadina/growth-core'
export const dynamic='force-dynamic'
const headers={'cache-control':'no-store'}
const allowedBrands=new Set(['pupsonstuff','atwood-bookie','bookieandco','truckeros','jhadina','jhadina-music','jhadinatv','overageos'])
export async function POST(request:NextRequest){
 try{
  if(request.headers.get('origin')!==request.nextUrl.origin)
   return NextResponse.json({ok:false,error:'Origin mismatch'}, {status:403,headers})
  if(!request.headers.get('content-type')?.startsWith('application/json'))
   return NextResponse.json({ok:false,error:'JSON required'}, {status:415,headers})
  const raw=await request.text()
  if(raw.length>64000)return NextResponse.json({ok:false,error:'Too large'}, {status:413,headers})
  const body=JSON.parse(raw) as {brandId?:string;leads?:ImportedCreatorLead[]}
  if(!body||typeof body!=='object'||!allowedBrands.has(String(body.brandId))||!Array.isArray(body.leads))
   return NextResponse.json({ok:false,error:'Brand and leads required'},{status:400,headers})
  const leads=prepareManualCreatorImport(body.leads)
  const identity=await(await createRequestIdentityVerifier()).verify({})
  const client=await createClient()
  const owner=identity.userId
  // New records only; never overwrite an existing creator's opt-out or previous evidence.
  // A disputed creator record must be reviewed manually, not erased by a batch import.
  const rows=leads.map(lead=>({
   owner_user_id:owner,kind:'creator',brand_id:body.brandId,
   source_key:lead.platform+':'+lead.handle,campaign_ref:null,observed_at:lead.observedAt,
   evidence_refs:lead.evidenceRefs,payload:{
    platform:lead.platform,handle:lead.handle,nicheTags:lead.nicheTags,
    productAffinitySignals:lead.productAffinitySignals,contactPermission:lead.contactPermission,
    sourceRef:lead.sourceRef,provenance:'OWNER_PROVIDED_UNVERIFIED'
   },status:'DRAFT_ONLY',external_action_authorized:false,money_movement_authorized:false
  }))
  const {data,error}=await client.from('jhadina_creator_campaign_records')
   .upsert(rows,{onConflict:'owner_user_id,kind,brand_id,source_key',ignoreDuplicates:true})
   .select('record_id,source_key').returns<Array<{record_id:string;source_key:string}>>()
  if(error)return NextResponse.json({ok:false,error:'SOCIAL_FREE_STORAGE_UNAVAILABLE'},{status:503,headers})
  return NextResponse.json({ok:true,accepted:leads.length,created:data?.length??0,
   skippedExisting:leads.length-(data?.length??0),externalActionAuthorized:false},{headers})
 }catch(e){
  const message=e instanceof Error?e.message:'SOCIAL_FREE_IMPORT_FAILED'
  const status=/Authenticated|identity|session/i.test(message)?401:400
  return NextResponse.json({ok:false,error:message,externalActionAuthorized:false},{status,headers})
 }
}
