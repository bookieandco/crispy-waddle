import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { commissionPublicProcurementSourceBatch } from '@/lib/opportunities/public-source-commissioning-runtime'
import { refreshNationalPublicJurisdictions } from '@/lib/opportunities/public-discovery-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'
import { syncDotGovOfficialDomainRegistry } from '@/lib/opportunities/dotgov-registry-runtime'
import { US_STATE_NAMES,type UsStateOrDcCode } from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

function boundedParam(raw:string|null,fallback:number,min:number,max:number){
  const value=Number(raw)
  return Number.isInteger(value)&&value>=min&&value<=max?value:fallback
}

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'public_source_commissioning_persistence_unavailable'},{status:503})
  try{
    const rawState=request.nextUrl.searchParams.get('state')?.trim().toUpperCase()
    const state=rawState&&rawState in US_STATE_NAMES?rawState as UsStateOrDcCode:undefined
    if(rawState&&!state)return NextResponse.json({ok:false,error:'invalid_state_code'},{status:400})
    const batchSize=boundedParam(request.nextUrl.searchParams.get('batchSize'),60,1,100)
    const concurrency=boundedParam(request.nextUrl.searchParams.get('concurrency'),6,1,10)
    const batches=boundedParam(request.nextUrl.searchParams.get('batches'),1,1,50)
    if(batches>1&&!state)return NextResponse.json({ok:false,error:'state_required_for_multi_batch'},{status:400})

    const {count,error:countError}=await client
      .from('jhadina_public_jurisdictions')
      .select('id',{count:'exact',head:true})
    if(countError)throw new Error(`public_jurisdiction_bootstrap_count_failed:${countError.message}`)

    if((count??0)===0){
      const bootstrap=await refreshNationalPublicJurisdictions(client)
      return NextResponse.json({
        ok:true,
        bootstrap,
        result:{
          status:'BOOTSTRAPPED',
          processed:0,
          verifiedSources:0,
          retryableErrors:0,
          results:[],
          automaticAdapterActivationAuthorized:false,
          externalContactAuthorized:false,
        },
      },{headers:{'cache-control':'no-store'}})
    }

    const {data:registryState,error:registryError}=await client
      .from('jhadina_public_official_domains')
      .select('last_seen_at')
      .order('last_seen_at',{ascending:false})
      .limit(1)
      .maybeSingle<{last_seen_at:string}>()
    if(registryError)throw new Error(`dotgov_registry_state_read_failed:${registryError.message}`)
    const lastSeen=registryState?.last_seen_at?new Date(registryState.last_seen_at).getTime():0
    const stale=!lastSeen||Date.now()-lastSeen>24*60*60*1000
    if(stale){
      const dotGovRegistry=await syncDotGovOfficialDomainRegistry(client)
      return NextResponse.json({
        ok:true,
        dotGovRegistry,
        result:{
          status:'DOTGOV_BOOTSTRAPPED',
          processed:0,
          verifiedSources:0,
          retryableErrors:0,
          results:[],
          automaticAdapterActivationAuthorized:false,
          externalContactAuthorized:false,
        },
      },{headers:{'cache-control':'no-store'}})
    }

    if(batches===1){
      const result=await commissionPublicProcurementSourceBatch(client,{state,batchSize,concurrency})
      return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
    }

    const started=Date.now()
    const runs:Array<{status:string;processed:number;verifiedSources:number;retryableErrors:number}>=[]
    for(let index=0;index<batches&&Date.now()-started<250_000;index+=1){
      const result=await commissionPublicProcurementSourceBatch(client,{state,batchSize,concurrency})
      runs.push({
        status:result.status,
        processed:result.processed,
        verifiedSources:result.verifiedSources,
        retryableErrors:result.retryableErrors,
      })
      if(result.status==='IDLE')break
    }
    const {count:remaining,error:remainingError}=await client
      .from('jhadina_public_source_discovery_jobs')
      .select('id',{count:'exact',head:true})
      .eq('state_code',state!)
      .in('status',['pending','discovered'])
    if(remainingError)throw new Error(`public_source_remaining_count_failed:${remainingError.message}`)
    return NextResponse.json({
      ok:true,
      convergence:{
        state,
        runs:runs.length,
        processed:runs.reduce((sum,row)=>sum+row.processed,0),
        verifiedSources:runs.reduce((sum,row)=>sum+row.verifiedSources,0),
        retryableErrors:runs.reduce((sum,row)=>sum+row.retryableErrors,0),
        remaining:remaining??0,
        exhausted:(remaining??0)===0,
        externalContactAuthorized:false,
      },
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_source_commissioning_failed'
    const status=message==='PUBLIC_SOURCE_SEARCH_NOT_CONFIGURED'?503:502
    return NextResponse.json({ok:false,error:message},{status,headers:{'cache-control':'no-store'}})
  }
}
