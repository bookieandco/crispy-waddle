import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { runPublicAdapterShadowBatch } from '@/lib/opportunities/public-adapter-shadow-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'
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
  if(!client)return NextResponse.json({ok:false,error:'public_adapter_shadow_persistence_unavailable'},{status:503})
  try{
    const rawState=request.nextUrl.searchParams.get('state')?.trim().toUpperCase()
    const state=rawState&&rawState in US_STATE_NAMES?rawState as UsStateOrDcCode:undefined
    if(rawState&&!state)return NextResponse.json({ok:false,error:'invalid_state_code'},{status:400})
    const batchSize=boundedParam(request.nextUrl.searchParams.get('batchSize'),10,1,25)
    const convergence=request.nextUrl.searchParams.get('mode')==='converge'
    const batches=boundedParam(request.nextUrl.searchParams.get('batches'),1,1,80)
    if(batches>1&&!state)return NextResponse.json({ok:false,error:'state_required_for_multi_batch'},{status:400})
    if(batches===1){
      const result=await runPublicAdapterShadowBatch(client,{state,batchSize,convergence})
      return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
    }
    const started=Date.now()
    const runs:Array<{status:string;processed:number;activated:number}>=[]
    for(let index=0;index<batches&&Date.now()-started<250_000;index+=1){
      const result=await runPublicAdapterShadowBatch(client,{state,batchSize,convergence:true})
      runs.push({status:result.status,processed:result.processed,activated:result.activated})
      if(result.status==='IDLE')break
    }
    const {count:remaining,error:remainingError}=await client
      .from('jhadina_public_procurement_sources')
      .select('id',{count:'exact',head:true})
      .eq('state_code',state!)
      .eq('adapter_status','adapter_required')
    if(remainingError)throw new Error(`public_adapter_remaining_count_failed:${remainingError.message}`)
    return NextResponse.json({
      ok:true,
      convergence:{
        state,
        runs:runs.length,
        processed:runs.reduce((sum,row)=>sum+row.processed,0),
        activated:runs.reduce((sum,row)=>sum+row.activated,0),
        remaining:remaining??0,
        exhausted:(remaining??0)===0,
        externalActionAuthorized:false,
      },
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_adapter_shadow_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}
