import {NextResponse} from 'next/server'
import {createRelationshipRequestContext,relationshipApiError} from '@/lib/relationships/request-context'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(_:Request,route:{params:Promise<{entityId:string}>}){
  try{
    const {entityId}=await route.params
    const {repo}=await createRelationshipRequestContext()
    if(!await repo.getEntity(entityId))return NextResponse.json({ok:false,error:'RELATIONSHIP_ENTITY_NOT_FOUND'},{status:404})
    return NextResponse.json({ok:true,pipeline:await repo.getPipeline(entityId)},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const failure=relationshipApiError(error)
    return NextResponse.json({ok:false,error:failure.message},{status:failure.status,headers:{'cache-control':'no-store'}})
  }
}
