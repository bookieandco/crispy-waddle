import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient,createServiceRoleClient} from '@/lib/supabase/service-role'
import {runRelationshipWorkerCycle} from '@/lib/relationships/worker'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

async function run(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)??createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'relationship_worker_storage_unavailable'},{status:503})
  const url=request.nextUrl
  const rawLimit=Number(url.searchParams.get('limit')??10)
  const limit=Number.isInteger(rawLimit)&&rawLimit>=1&&rawLimit<=100?rawLimit:10
  const crash=url.searchParams.get('forceCrash')==='true'&&process.env.NODE_ENV!=='production'
  try{
    const result=await runRelationshipWorkerCycle(client,{
      workerId:'relationship-worker:'+crypto.randomUUID(),
      leaseSeconds:120,
      limitPerOwner:limit,
      crashAfterFirstClaim:crash,
    })
    return NextResponse.json({ok:true,result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'relationship_worker_failed'
    return NextResponse.json({ok:false,error:message},{status:502,headers:{'cache-control':'no-store'}})
  }
}

export async function GET(request:NextRequest){return run(request)}
export async function POST(request:NextRequest){return run(request)}
