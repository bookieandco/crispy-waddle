import {NextResponse} from 'next/server'
import {
  getSideHustleDefinition,
  getSideHustleRelationshipScope,
  isSideHustleFamily,
  laneForPipeline,
  relationshipPipelinesForSideHustle,
} from '@jhadina/opportunity-core'
import {createRelationshipRequestContext,relationshipApiError} from '@/lib/relationships/request-context'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(_:Request,route:{params:Promise<{family:string}>}){
  try{
    const {family:raw}=await route.params
    if(!isSideHustleFamily(raw)){
      return NextResponse.json({ok:false,error:'SIDE_HUSTLE_FAMILY_NOT_FOUND'},{status:404})
    }
    const family=raw
    const definition=getSideHustleDefinition(family)
    const scope=getSideHustleRelationshipScope(family,definition.label)
    const {repo}=await createRelationshipRequestContext()
    const records=await repo.listSideHustleRelationships({
      family,
      pipelineIds:relationshipPipelinesForSideHustle(family),
      limit:500,
    })
    const lanes=scope.lanes.map(lane=>({
      ...lane,
      records:records.filter(row=>{
        const values=row.values_json&&typeof row.values_json==='object'&&!Array.isArray(row.values_json)
          ?row.values_json as Record<string,unknown>:{}
        const explicit=typeof values.relationshipLane==='string'?values.relationshipLane:undefined
        if(explicit)return explicit===lane.id
        return laneForPipeline(family,String(row.pipeline_id))?.id===lane.id
      }),
    }))
    const matches=family==='procurement_subcontracting'
      ?await repo.listEdgesByRelation(['matched_subcontractor','subcontractor_review_candidate'],500)
      :[]
    return NextResponse.json({
      ok:true,
      definition,
      scope,
      lanes,
      matches,
      canonicalEntityAuthority:'RELATIONSHIP_CORE',
      opportunityAuthority:'OPPORTUNITY_CORE',
      externalActionAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const failure=relationshipApiError(error)
    return NextResponse.json({ok:false,error:failure.message},{status:failure.status,headers:{'cache-control':'no-store'}})
  }
}
