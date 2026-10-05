import {NextResponse} from 'next/server'
import {
  getSideHustleDefinition,
  getSideHustleProductionStatus,
  getSideHustleRelationshipScope,
  isSideHustleFamily,
  laneForPipeline,
  relationshipPipelinesForSideHustle,
} from '@jhadina/opportunity-core'
import {createRelationshipRequestContext,relationshipApiError} from '@/lib/relationships/request-context'
import {VentureRuntimeRepository} from '@/lib/opportunities/venture-runtime-repository'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(request:Request,route:{params:Promise<{family:string}>}){
  try{
    const {family:raw}=await route.params
    if(!isSideHustleFamily(raw)){
      return NextResponse.json({ok:false,error:'SIDE_HUSTLE_FAMILY_NOT_FOUND'},{status:404})
    }
    const family=raw
    const definition=getSideHustleDefinition(family)
    const scope=getSideHustleRelationshipScope(family,definition.label)
    const productionStatus=getSideHustleProductionStatus(family)
    const {identity,client,repo}=await createRelationshipRequestContext()
    const records=await repo.listSideHustleRelationships({
      family,
      pipelineIds:relationshipPipelinesForSideHustle(family),
      limit:500,
    })
    const businessRef=new URL(request.url).searchParams.get('business')?.trim()||undefined
    const businessRefs=[...new Set(records.flatMap(row=>{
      const values=row.values_json&&typeof row.values_json==='object'&&!Array.isArray(row.values_json)
        ?row.values_json as Record<string,unknown>:{}
      return typeof values.sideHustleBusinessRef==='string'&&values.sideHustleBusinessRef.trim()
        ?[values.sideHustleBusinessRef.trim()]:[]
    }))].sort()
    const visibleRecords=businessRef?records.filter(row=>{
      const values=row.values_json&&typeof row.values_json==='object'&&!Array.isArray(row.values_json)
        ?row.values_json as Record<string,unknown>:{}
      return values.sideHustleBusinessRef===businessRef
    }):records
    const lanes=scope.lanes.map(lane=>({
      ...lane,
      records:visibleRecords.filter(row=>{
        const values=row.values_json&&typeof row.values_json==='object'&&!Array.isArray(row.values_json)
          ?row.values_json as Record<string,unknown>:{}
        const explicit=typeof values.relationshipLane==='string'?values.relationshipLane:undefined
        if(explicit)return explicit===lane.id
        return laneForPipeline(family,String(row.pipeline_id))?.id===lane.id
      }),
    }))
    const ventureRepo=new VentureRuntimeRepository(client)
    const familyVentures=(await ventureRepo.listVentures(identity.userId)).filter(venture=>venture.family===family)
    const familyVentureIds=new Set(familyVentures.map(venture=>venture.id))
    const businessWork=(await ventureRepo.listWorkItems(identity.userId))
      .filter(item=>familyVentureIds.has(item.ventureId)&&item.status!=='superseded')
      .slice(0,100)
    const allMatches=family==='procurement_subcontracting'
      ?await repo.listEdgesByRelation(['matched_subcontractor','subcontractor_review_candidate'],500)
      :[]
    const visibleEntityIds=new Set(visibleRecords.map(row=>String(row.entity_id)))
    const matches=businessRef
      ?allMatches.filter(row=>visibleEntityIds.has(String(row.from_entity_id))||visibleEntityIds.has(String(row.to_entity_id)))
      :allMatches
    return NextResponse.json({
      ok:true,
      definition,
      scope,
      productionStatus,
      lanes,
      businessRef,
      businessRefs,
      matches,
      businessPipeline:{
        ventures:familyVentures.map(venture=>({id:venture.id,opportunityId:venture.opportunityId,title:venture.title,lifecycle:venture.lifecycle,score:venture.score.total})),
        workItems:businessWork,
        authority:'SIDE_HUSTLE_BUSINESS_FACTORY',
        externalActionAuthorized:false,
      },
      canonicalEntityAuthority:'RELATIONSHIP_CORE',
      opportunityAuthority:'OPPORTUNITY_CORE',
      externalActionAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const failure=relationshipApiError(error)
    return NextResponse.json({ok:false,error:failure.message},{status:failure.status,headers:{'cache-control':'no-store'}})
  }
}
