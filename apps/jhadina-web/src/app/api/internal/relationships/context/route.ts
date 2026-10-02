import {NextRequest,NextResponse} from 'next/server'
import {authorizedSchedulerRequest} from '@/lib/internal-scheduler-auth'
import {createSchedulerServiceRoleClient,createServiceRoleClient} from '@/lib/supabase/service-role'
import {ProductionRelationshipRepository} from '@/lib/relationships/production-repository'
import {persistRelationshipContextEvent} from '@/lib/relationships/context-fusion'
import type {EntityContextLink} from '@jhadina/relationship-core'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const kinds=new Set<EntityContextLink['contextKind']>(['opportunity','email','message','task','document','file','contract','order','social','work_session','other'])

export async function POST(request:NextRequest){
  if(!(await authorizedSchedulerRequest(request)))return NextResponse.json({ok:false},{status:401})
  const client=createSchedulerServiceRoleClient(request)??createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'relationship_context_storage_unavailable'},{status:503})
  try{
    const body=await request.json() as Record<string,unknown>
    const ownerUserId=typeof body.ownerUserId==='string'?body.ownerUserId:''
    const entityId=typeof body.entityId==='string'?body.entityId:''
    const kind=typeof body.kind==='string'&&kinds.has(body.kind as EntityContextLink['contextKind'])?body.kind as EntityContextLink['contextKind']:null
    const evidenceRefs=Array.isArray(body.evidenceRefs)?body.evidenceRefs.filter((v):v is string=>typeof v==='string'&&Boolean(v.trim())).slice(0,64):[]
    if(!ownerUserId||!entityId||!kind||typeof body.contextRef!=='string'||typeof body.relation!=='string'||typeof body.activityType!=='string'||typeof body.summary!=='string'||!evidenceRefs.length){
      return NextResponse.json({ok:false,error:'invalid_relationship_context_event'},{status:400})
    }
    const repo=new ProductionRelationshipRepository(client,ownerUserId)
    if(!await repo.getEntity(entityId))return NextResponse.json({ok:false,error:'RELATIONSHIP_ENTITY_NOT_FOUND'},{status:404})
    const fused=await persistRelationshipContextEvent(repo,{
      entityId,kind,contextRef:body.contextRef,relation:body.relation,activityType:body.activityType,
      summary:body.summary,occurredAt:typeof body.occurredAt==='string'?body.occurredAt:new Date().toISOString(),
      evidenceRefs,metadata:body.metadata&&typeof body.metadata==='object'?body.metadata as Record<string,unknown>:undefined,
    })
    return NextResponse.json({ok:true,fused,executionAuthorized:false},{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'relationship_context_failed'},{status:502})
  }
}
