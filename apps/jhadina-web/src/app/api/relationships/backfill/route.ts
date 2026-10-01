import {NextResponse} from 'next/server'
import {createRelationshipRequestContext,relationshipApiError} from '@/lib/relationships/request-context'
import {runRelationshipBackfill} from '@/lib/relationships/backfill'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function POST(request:Request){
  try{
    const {identity,client}=await createRelationshipRequestContext()
    let limit=250
    try{
      const body=await request.json() as {limitPerSource?:unknown}
      if(typeof body.limitPerSource==='number'&&Number.isFinite(body.limitPerSource)){
        limit=Math.min(Math.max(Math.trunc(body.limitPerSource),1),1000)
      }
    }catch{}
    const summary=await runRelationshipBackfill(client,identity.userId,{limitPerSource:limit})
    return NextResponse.json({ok:true,summary,externalExecutionAuthorized:false},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const failure=relationshipApiError(error)
    return NextResponse.json({ok:false,error:failure.message},{status:failure.status,headers:{'cache-control':'no-store'}})
  }
}
