import { NextRequest,NextResponse } from 'next/server'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { discoverPublicWorkPackageProviders } from '@/lib/opportunities/public-work-package-provider-runtime'
import { createSchedulerServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=300

function bounded(raw:string|null,fallback:number,max:number){
  const value=Number(raw)
  return Number.isInteger(value)&&value>=1&&value<=max?value:fallback
}

export async function GET(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)
  if(!client)return NextResponse.json({ok:false,error:'public_work_package_provider_persistence_unavailable'},{status:503})
  try{
    const result=await discoverPublicWorkPackageProviders(client,{
      batchSize:bounded(request.nextUrl.searchParams.get('batchSize'),20,100),
      maxProvidersPerPackage:bounded(request.nextUrl.searchParams.get('maxProviders'),20,50),
    })
    const batches=bounded(request.nextUrl.searchParams.get('batches'),1,20)
    if(batches===1)return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
    const started=Date.now()
    const runs=[result]
    for(let index=1;index<batches&&result.status!=='IDLE'&&Date.now()-started<250_000;index+=1){
      const next=await discoverPublicWorkPackageProviders(client,{
        batchSize:bounded(request.nextUrl.searchParams.get('batchSize'),20,100),
        maxProvidersPerPackage:bounded(request.nextUrl.searchParams.get('maxProviders'),20,50),
      })
      runs.push(next)
      if(next.status==='IDLE')break
    }
    const {count:remaining,error:remainingError}=await client
      .from('jhadina_public_work_packages')
      .select('id',{count:'exact',head:true})
      .in('status',['candidate','review_required'])
      .is('provider_discovery_at',null)
    if(remainingError)throw new Error(`public_provider_remaining_count_failed:${remainingError.message}`)
    return NextResponse.json({
      ok:true,
      convergence:{
        runs:runs.length,
        packages:runs.reduce((sum,row)=>sum+row.packages,0),
        candidates:runs.reduce((sum,row)=>sum+row.candidates,0),
        remaining:remaining??0,
        exhausted:(remaining??0)===0,
        providerOutreachAuthorized:false,
      },
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_work_package_provider_discovery_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}
