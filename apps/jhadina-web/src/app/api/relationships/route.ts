import {NextResponse} from 'next/server'
import {createRelationshipRequestContext,relationshipApiError} from '@/lib/relationships/request-context'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(request:Request){
  try{
    const {repo}=await createRelationshipRequestContext()
    const url=new URL(request.url)
    const raw=Number(url.searchParams.get('limit')??100)
    const limit=Number.isFinite(raw)?Math.min(Math.max(Math.trunc(raw),1),500):100
    const entities=await repo.listEntities(limit)
    return NextResponse.json({ok:true,entities},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const failure=relationshipApiError(error)
    return NextResponse.json({ok:false,error:failure.message},{status:failure.status,headers:{'cache-control':'no-store'}})
  }
}
