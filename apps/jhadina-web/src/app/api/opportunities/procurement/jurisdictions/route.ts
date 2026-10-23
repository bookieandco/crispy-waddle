import {NextRequest,NextResponse} from 'next/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {US_STATE_AND_DC_CODES,classifyProcurementPortal} from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'cache-control':'no-store'}})
const levels=['state','county','city','school_district','special_district','authority','public_university','public_hospital']
export async function GET(request:NextRequest){
 try{
  await (await createRequestIdentityVerifier()).verify({})
  const state=(request.nextUrl.searchParams.get('state')??'CA').toUpperCase()
  const level=request.nextUrl.searchParams.get('level')??''
  const search=(request.nextUrl.searchParams.get('search')??'').trim()
  const limit=Number(request.nextUrl.searchParams.get('limit')??20)
  const offset=Number(request.nextUrl.searchParams.get('offset')??0)
  if(!US_STATE_AND_DC_CODES.some(x=>x===state)||level&&!levels.includes(level)||
   search.length>80||!Number.isInteger(limit)||limit<1||limit>25||
   !Number.isInteger(offset)||offset<0||offset>100000)
   return reply({ok:false,error:'Invalid jurisdiction filters'},400)
  const client=createServiceRoleClient()
  if(!client)return reply({ok:false,error:'Registry not available'},503)
  let query=client.from('jhadina_public_jurisdictions')
   .select('id,state_code,level,name,normalized_name,source_url,observed_at',{count:'exact'})
   .eq('state_code',state)
  if(level)query=query.eq('level',level)
  const safeSearch=search.replace(/[%_\\]/g,'').trim()
  if(safeSearch)query=query.ilike('normalized_name','%'+safeSearch+'%')
  const {data,error,count}=await query.order('normalized_name',{ascending:true}).order('id',{ascending:true}).range(offset,offset+limit-1)
  if(error)throw error
  const jurisdictions=data??[]
  const ids=jurisdictions.map(x=>x.id)
  if(!ids.length)return reply({ok:true,mode:'jurisdiction_source_readonly',state,level,offset,limit,total:count??0,
   results:[],sourceSamplePartial:false,externalContactAuthorized:false})
  const [sourcesResult,jobsResult]=await Promise.all([
   client.from('jhadina_public_procurement_sources')
    .select('id,jurisdiction_id,source_name,source_url,official_owner_url,adapter_status,verification_status,access_review_status,certified_at')
    .in('jurisdiction_id',ids).limit(500),
   client.from('jhadina_public_source_discovery_jobs')
    .select('jurisdiction_id,status,last_error')
    .in('jurisdiction_id',ids).limit(100),
  ])
  if(sourcesResult.error||jobsResult.error)throw new Error('procurement_source_status_unavailable')
  // Only persisted, active public observations can enter the existing no-send
  // review route. Bounded samples never assert exhaustive live opportunity coverage.
  const sourceIds=(sourcesResult.data??[]).map(row=>row.id).slice(0,60)
  const inboxResult=sourceIds.length
   ?await client.from('jhadina_public_opportunity_inbox')
    .select('id,source_id,title,stage,source_url,last_seen_at')
    .in('source_id',sourceIds).eq('active',true).eq('stage','open_solicitation')
    .order('last_seen_at',{ascending:false}).limit(120)
   :{data:[],error:null}
  if(inboxResult.error)throw new Error('national_observation_read_failed')
  const observed=new Map<string,Array<{id:string;title:string;sourceUrl:string;lastSeenAt:string}>>()
  for(const row of inboxResult.data??[]){
   const list=observed.get(row.source_id)??[]
   list.push({id:row.id,title:row.title,sourceUrl:row.source_url,lastSeenAt:row.last_seen_at})
   observed.set(row.source_id,list)
  }
  const sourceMap=new Map<string,typeof sourcesResult.data>()
  for(const row of sourcesResult.data??[]){
   const list=sourceMap.get(row.jurisdiction_id)??[]
   list.push(row)
   sourceMap.set(row.jurisdiction_id,list)
  }
  const jobMap=new Map((jobsResult.data??[]).map(job=>[job.jurisdiction_id,job]))
  const results=jurisdictions.map(item=>{
   const rows=sourceMap.get(item.id)??[]
   const verified=rows.filter(s=>s.verification_status==='official_owner_verified'||s.verification_status==='official_portal_verified')
   const certified=rows.filter(s=>s.adapter_status==='active'&&s.certified_at&&
    ['approved_public_official','approved_platform'].includes(s.access_review_status))
   const inboxObservations=rows.flatMap(source=>observed.get(source.id)??[]).slice(0,3)
   const examples=verified.slice(0,3).map(s=>{
    const portal=classifyProcurementPortal({sourceUrl:s.source_url,
     officialBuyerLink:s.official_owner_url??null,
     officialBuyerVerified:s.verification_status==='official_owner_verified'||s.verification_status==='official_portal_verified',
     loginRequired:false,robotsAccessApproved:false,reliableBidIds:false,closedBidDetection:false})
    return {name:s.source_name,url:s.source_url,status:s.adapter_status,
     certified:Boolean(certified.includes(s)),portalFamily:portal.family,
     portalReadiness:portal.status,portalBlockers:portal.blockers.slice(0,3)}
   })
   const discovery=jobMap.get(item.id)
   return {id:item.id,name:item.name,state:item.state_code,level:item.level,
    inventorySourceUrl:item.source_url,observedAt:item.observed_at,sourceCount:rows.length,
    verifiedSourceCount:verified.length,certifiedSourceCount:certified.length,
    examples,inboxObservations,discoveryStatus:discovery?.status??'unknown',
    sourceDataMayBePartial:(sourcesResult.data??[]).length>=500||sourceIds.length>=60||(inboxResult.data??[]).length>=120,
    bidReady:false,outreachAuthorized:false}
  })
  return reply({ok:true,mode:'jurisdiction_source_readonly',state,level,offset,limit,
   total:count??0,results,sourceSamplePartial:(sourcesResult.data??[]).length>=500||sourceIds.length>=60||(inboxResult.data??[]).length>=120,
   caveat:'Directory is an inventory. Source matches and certification do not prove full RFQ documents or vendor eligibility.',
   externalContactAuthorized:false,bidSubmissionAuthorized:false,paymentAuthorized:false})
 }catch(error){
  const message=error instanceof Error?error.message:''
  const unauthorized=/identity|authenticated|session|unauthorized/i.test(message)
  return reply({ok:false,error:unauthorized?'Authentication required':'Jurisdiction registry unavailable'},unauthorized?401:503)
 }
}
