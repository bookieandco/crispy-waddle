import type {SupabaseClient} from '@supabase/supabase-js'
import type {SideHustleFamily,SideHustleRelationshipPipelineId} from '@jhadina/opportunity-core'
import {
  InMemoryRelationshipStore,
  SupabaseRelationshipRepository,
  buildRelationshipRecordWorkspace,
  DEFAULT_RELATIONSHIP_PIPELINES,
  normalizeRelationshipIdentity,
  type CanonicalRelationshipFact,
  type CanonicalIdentityCandidate,
  type EntityContextLink,
  type RelationshipActivity,
  type RelationshipEntity,
  type RelationshipFactSuggestion,
  type RelationshipIdentity,
  type RelationshipIntelligenceSignal,
  type RelationshipObservation,
  type RelationshipProjection,
  type RelationshipRole,
  type RelationshipWorkItem,
  type RelationshipEdge,
} from '@jhadina/relationship-core'

type Row=Record<string,unknown>

function asString(value:unknown):string|undefined{
  return typeof value==='string'&&value.length?value:undefined
}
function asStrings(value:unknown):string[]{
  return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[]
}
function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
}
function required<T>(value:T|null|undefined,message:string):T{
  if(value===null||value===undefined)throw new Error(message)
  return value
}

export class ProductionRelationshipRepository{
  private readonly core:SupabaseRelationshipRepository

  constructor(
    private readonly client:SupabaseClient,
    readonly ownerUserId:string,
  ){
    if(!ownerUserId)throw new Error('RELATIONSHIP_OWNER_REQUIRED')
    this.core=new SupabaseRelationshipRepository(client as never)
  }

  async upsertEntity(entity:RelationshipEntity):Promise<void>{
    this.assertOwner(entity.ownerUserId)
    await this.core.upsertEntity(entity)
  }

  async upsertIdentity(identity:RelationshipIdentity):Promise<void>{
    const existing=await this.client
      .from('jhadina_relationship_identities')
      .select('entity_id')
      .eq('user_id',this.ownerUserId)
      .eq('scheme',identity.scheme)
      .eq('normalized_value',identity.normalizedValue)
      .maybeSingle()
    if(existing.error)throw new Error('RELATIONSHIP_IDENTITY_LOOKUP_FAILED:'+existing.error.message)
    if(existing.data?.entity_id&&existing.data.entity_id!==identity.entityId){
      throw new Error('RELATIONSHIP_IDENTITY_COLLISION')
    }
    const {error}=await this.client.from('jhadina_relationship_identities').upsert({
      user_id:this.ownerUserId,
      id:identity.id,
      entity_id:identity.entityId,
      scheme:identity.scheme,
      value:identity.value,
      normalized_value:identity.normalizedValue,
      verified_at:identity.verifiedAt??null,
      evidence_refs:[...identity.evidenceRefs],
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_IDENTITY_PERSIST_FAILED:'+error.message)
  }

  async resolveEntityId(identities:readonly CanonicalIdentityCandidate[]):Promise<string|undefined>{
    for(const identity of identities){
      const normalized=normalizeRelationshipIdentity(identity.scheme,identity.value)
      const {data,error}=await this.client
        .from('jhadina_relationship_identities')
        .select('entity_id')
        .eq('user_id',this.ownerUserId)
        .eq('scheme',identity.scheme)
        .eq('normalized_value',normalized)
        .maybeSingle()
      if(error)throw new Error('RELATIONSHIP_IDENTITY_LOOKUP_FAILED:'+error.message)
      if(data?.entity_id)return String(data.entity_id)
    }
    return undefined
  }

  async upsertRole(role:RelationshipRole):Promise<void>{
    const {error}=await this.client.from('jhadina_relationship_roles').upsert({
      user_id:this.ownerUserId,
      id:role.id,
      entity_id:role.entityId,
      role:role.role,
      domain:role.domain,
      context_ref:role.contextRef??null,
      valid_from:role.validFrom,
      valid_to:role.validTo??null,
      evidence_refs:[...role.evidenceRefs],
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_ROLE_PERSIST_FAILED:'+error.message)
  }

  async appendObservation(observation:RelationshipObservation):Promise<void>{
    await this.core.appendObservation(this.ownerUserId,observation)
  }

  async upsertFact(fact:CanonicalRelationshipFact):Promise<void>{
    const {error}=await this.client.from('jhadina_relationship_facts').upsert({
      user_id:this.ownerUserId,
      id:fact.id,
      entity_id:fact.entityId,
      field:fact.field,
      value:fact.value,
      evidence_refs:[...fact.evidenceRefs],
      status:fact.status,
      verified_at:fact.verifiedAt,
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_FACT_PERSIST_FAILED:'+error.message)
  }

  async appendActivity(activity:RelationshipActivity):Promise<void>{
    await this.core.appendActivity(this.ownerUserId,activity)
  }

  async upsertContextLink(link:EntityContextLink):Promise<void>{
    const {error}=await this.client.from('jhadina_relationship_context_links').upsert({
      user_id:this.ownerUserId,
      id:link.id,
      entity_id:link.entityId,
      context_kind:link.contextKind,
      context_ref:link.contextRef,
      relation:link.relation,
      occurred_at:link.occurredAt,
      evidence_refs:[...link.evidenceRefs],
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_CONTEXT_PERSIST_FAILED:'+error.message)
  }

  async upsertProjection(projection:RelationshipProjection):Promise<void>{
    this.assertOwner(projection.entity.ownerUserId)
    await this.upsertEntity(projection.entity)
    await this.upsertRole(projection.role)
    await this.appendActivity(projection.activity)
    await this.upsertContextLink(projection.contextLink)
  }

  async upsertEdge(edge:RelationshipEdge):Promise<void>{
    const {error}=await this.client.from('jhadina_relationship_edges').upsert({
      user_id:this.ownerUserId,
      id:edge.id,
      from_entity_id:edge.fromEntityId,
      to_entity_id:edge.toEntityId,
      relation:edge.relation,
      context_ref:edge.contextRef??null,
      valid_from:edge.validFrom,
      valid_to:edge.validTo??null,
      evidence_refs:[...edge.evidenceRefs],
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_EDGE_PERSIST_FAILED:'+error.message)
  }

  async upsertIntelligence(signal:RelationshipIntelligenceSignal):Promise<void>{
    if(signal.authority!=='ANALYSIS_ONLY')throw new Error('RELATIONSHIP_INTELLIGENCE_AUTHORITY_INVALID')
    const {error}=await this.client.from('jhadina_relationship_intelligence').upsert({
      user_id:this.ownerUserId,
      id:signal.id,
      entity_id:signal.entityId,
      signal_type:signal.kind,
      value_json:signal.value,
      summary:signal.summary,
      observed_at:signal.observedAt,
      evidence_refs:[...signal.evidenceRefs],
      authority:signal.authority,
      updated_at:signal.observedAt,
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_INTELLIGENCE_PERSIST_FAILED:'+error.message)
  }

  async enqueueWork(item:RelationshipWorkItem):Promise<void>{
    this.assertOwner(item.ownerUserId)
    if(item.executionAuthorized!==false)throw new Error('RELATIONSHIP_WORK_CANNOT_GRANT_EXECUTION_AUTHORITY')
    const {error}=await this.client.from('jhadina_relationship_work_items').upsert({
      user_id:this.ownerUserId,
      id:item.id,
      capability:item.capability,
      entity_ref:item.entityRef,
      reason:item.reason,
      due_at:item.dueAt,
      priority:item.priority,
      status:item.status,
      lease_owner:item.leaseOwner??null,
      lease_expires_at:item.leaseExpiresAt??null,
      attempt_count:item.attemptCount,
      budget:item.budget??null,
      correlation_id:item.correlationId,
      evidence_refs:[...item.evidenceRefs],
      last_error:item.lastError??null,
      execution_authorized:false,
      updated_at:new Date().toISOString(),
    },{onConflict:'user_id,id',ignoreDuplicates:true})
    if(error)throw new Error('RELATIONSHIP_WORK_PERSIST_FAILED:'+error.message)
  }

  async ensureDefaultPipelines():Promise<void>{
    for(const template of DEFAULT_RELATIONSHIP_PIPELINES){
      const objectResult=await this.client.from('jhadina_relationship_object_definitions').upsert({
        user_id:this.ownerUserId,
        id:template.objectDefinition.id,
        definition:template.objectDefinition,
        updated_at:new Date().toISOString(),
      },{onConflict:'user_id,id'})
      if(objectResult.error)throw new Error('RELATIONSHIP_OBJECT_DEFINITION_PERSIST_FAILED:'+objectResult.error.message)
      const pipelineResult=await this.client.from('jhadina_relationship_pipelines').upsert({
        user_id:this.ownerUserId,
        id:template.pipeline.id,
        object_definition_id:template.pipeline.objectDefinitionId,
        definition:template.pipeline,
        updated_at:new Date().toISOString(),
      },{onConflict:'user_id,id'})
      if(pipelineResult.error)throw new Error('RELATIONSHIP_PIPELINE_PERSIST_FAILED:'+pipelineResult.error.message)
    }
  }

  async upsertPipelineRecord(input:{
    id:string
    entityId:string
    pipelineId:string
    stageId:string
    values?:Readonly<Record<string,unknown>>
    updatedAt?:string
  }):Promise<void>{
    const {error}=await this.client.from('jhadina_relationship_pipeline_records').upsert({
      user_id:this.ownerUserId,
      id:input.id,
      entity_id:input.entityId,
      pipeline_id:input.pipelineId,
      stage_id:input.stageId,
      values_json:{...(input.values??{})},
      updated_at:input.updatedAt??new Date().toISOString(),
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_PIPELINE_RECORD_PERSIST_FAILED:'+error.message)
  }

  async upsertSideHustlePipelineRecord(input:{
    family:SideHustleFamily
    entityId:string
    pipelineId:SideHustleRelationshipPipelineId
    stageId:string
    values?:Readonly<Record<string,unknown>>
    updatedAt?:string
  }):Promise<void>{
    await this.upsertPipelineRecord({
      id:'pipeline-record:side-hustle:'+input.family+':'+input.pipelineId+':'+input.entityId,
      entityId:input.entityId,
      pipelineId:input.pipelineId,
      stageId:input.stageId,
      values:{
        ...(input.values??{}),
        sideHustleFamily:input.family,
        relationshipScope:'side_hustle',
      },
      updatedAt:input.updatedAt,
    })
  }

  async listSideHustleRelationships(input:{
    family:SideHustleFamily
    pipelineIds:readonly SideHustleRelationshipPipelineId[]
    limit?:number
  }){
    const limit=Math.min(Math.max(input.limit??250,1),500)
    if(!input.pipelineIds.length)return Object.freeze([])
    const {data:rows,error}=await this.client.from('jhadina_relationship_pipeline_records')
      .select('id,entity_id,pipeline_id,stage_id,values_json,updated_at')
      .eq('user_id',this.ownerUserId)
      .in('pipeline_id',[...input.pipelineIds])
      .order('updated_at',{ascending:false})
      .limit(limit)
    if(error)throw new Error('RELATIONSHIP_SIDE_HUSTLE_PIPELINE_READ_FAILED:'+error.message)
    const explicitKeys=new Set((rows??[]).flatMap(row=>{
      const values=record(row.values_json)
      return asString(values.sideHustleFamily)===input.family
        ?[String(row.pipeline_id)+':'+String(row.entity_id)]
        :[]
    }))
    const scoped=(rows??[]).filter(row=>{
      const values=record(row.values_json)
      const family=asString(values.sideHustleFamily)
      if(family===input.family)return true
      if(input.family!=='procurement_subcontracting'||family)return false
      const pipelineId=String(row.pipeline_id)
      if(!['sam_teaming','public_buyer','subcontractor_acquisition'].includes(pipelineId))return false
      return !explicitKeys.has(pipelineId+':'+String(row.entity_id))
    })
    const entityIds=[...new Set(scoped.map(row=>String(row.entity_id)))]
    if(!entityIds.length)return Object.freeze([])
    const {data:entities,error:entityError}=await this.client.from('jhadina_relationship_entities')
      .select('id,kind,display_name,status,evidence_refs,updated_at')
      .eq('user_id',this.ownerUserId)
      .in('id',entityIds)
    if(entityError)throw new Error('RELATIONSHIP_SIDE_HUSTLE_ENTITY_READ_FAILED:'+entityError.message)
    const byId=new Map((entities??[]).map(row=>[String(row.id),row]))
    return Object.freeze(scoped.map(row=>Object.freeze({
      ...row,
      entity:byId.get(String(row.entity_id))??null,
    })))
  }

  async listEntities(limit=100):Promise<readonly Row[]>{
    const {data,error}=await this.client.from('jhadina_relationship_entities')
      .select('id,kind,display_name,status,evidence_refs,updated_at')
      .eq('user_id',this.ownerUserId)
      .order('updated_at',{ascending:false})
      .limit(Math.min(Math.max(limit,1),500))
    if(error)throw new Error('RELATIONSHIP_ENTITY_LIST_FAILED:'+error.message)
    return Object.freeze((data??[]).map(row=>Object.freeze({...row})))
  }

  async getEntity(entityId:string):Promise<RelationshipEntity|undefined>{
    const {data,error}=await this.client.from('jhadina_relationship_entities')
      .select('payload')
      .eq('user_id',this.ownerUserId)
      .eq('id',entityId)
      .maybeSingle()
    if(error)throw new Error('RELATIONSHIP_ENTITY_READ_FAILED:'+error.message)
    return data?.payload as RelationshipEntity|undefined
  }

  async getWorkspace(entityId:string){
    const entity=await this.getEntity(entityId)
    if(!entity)return undefined
    const [identities,roles,activities,links,facts,suggestions,work,edges,intelligence]=await Promise.all([
      this.rows('jhadina_relationship_identities',entityId,'entity_id'),
      this.rows('jhadina_relationship_roles',entityId,'entity_id'),
      this.rows('jhadina_relationship_activities',entityId,'entity_id','occurred_at'),
      this.rows('jhadina_relationship_context_links',entityId,'entity_id','occurred_at'),
      this.rows('jhadina_relationship_facts',entityId,'entity_id','verified_at'),
      this.rows('jhadina_relationship_fact_suggestions',entityId,'entity_id','created_at'),
      this.rows('jhadina_relationship_work_items',entityId,'entity_ref','due_at'),
      this.edgeRows(entityId),
      this.rows('jhadina_relationship_intelligence',entityId,'entity_id','observed_at'),
    ])
    const store=new InMemoryRelationshipStore()
    store.upsertEntity(entity)
    for(const row of identities)store.addIdentity(identityFromRow(row))
    for(const row of roles)store.addRole(roleFromRow(row))
    for(const row of activities)store.addActivity(activityFromRow(row))
    for(const row of links)store.addContextLink(linkFromRow(row))
    for(const row of facts)store.addFact(factFromRow(row))
    for(const row of suggestions)store.addSuggestion(suggestionFromRow(row))
    const workItems=work.map(workFromRow)
    return Object.freeze({
      workspace:buildRelationshipRecordWorkspace(store,entityId,workItems),
      edges:Object.freeze(edges),
      intelligence:Object.freeze(intelligence),
    })
  }

  async getTimeline(entityId:string){
    const [activities,links,intelligence]=await Promise.all([
      this.rows('jhadina_relationship_activities',entityId,'entity_id','occurred_at'),
      this.rows('jhadina_relationship_context_links',entityId,'entity_id','occurred_at'),
      this.rows('jhadina_relationship_intelligence',entityId,'entity_id','observed_at'),
    ])
    return Object.freeze({activities:Object.freeze(activities),links:Object.freeze(links),intelligence:Object.freeze(intelligence)})
  }

  async getEvidence(entityId:string){
    const [observations,facts,suggestions]=await Promise.all([
      this.rows('jhadina_relationship_observations',entityId,'entity_id','observed_at'),
      this.rows('jhadina_relationship_facts',entityId,'entity_id','verified_at'),
      this.rows('jhadina_relationship_fact_suggestions',entityId,'entity_id','created_at'),
    ])
    return Object.freeze({observations:Object.freeze(observations),facts:Object.freeze(facts),suggestions:Object.freeze(suggestions)})
  }

  async getPipeline(entityId:string){
    const {data,error}=await this.client.from('jhadina_relationship_pipeline_records')
      .select('id,pipeline_id,stage_id,values_json,updated_at')
      .eq('user_id',this.ownerUserId)
      .eq('entity_id',entityId)
      .order('updated_at',{ascending:false})
    if(error)throw new Error('RELATIONSHIP_PIPELINE_READ_FAILED:'+error.message)
    return Object.freeze(data??[])
  }

  async listEdgesByRelation(relations:readonly string[],limit=500){
    if(!relations.length)return Object.freeze([])
    const {data,error}=await this.client.from('jhadina_relationship_edges')
      .select('*')
      .eq('user_id',this.ownerUserId)
      .in('relation',[...relations])
      .order('valid_from',{ascending:false})
      .limit(Math.min(Math.max(limit,1),1000))
    if(error)throw new Error('RELATIONSHIP_EDGE_RELATION_READ_FAILED:'+error.message)
    return Object.freeze(data??[])
  }

  async getAgentState(entityId:string){
    const rows=await this.rows('jhadina_relationship_work_items',entityId,'entity_ref','due_at')
    return Object.freeze({
      queued:Object.freeze(rows.filter(row=>row.status==='pending')),
      active:Object.freeze(rows.filter(row=>row.status==='leased')),
      completed:Object.freeze(rows.filter(row=>row.status==='completed').slice(0,25)),
      blocked:Object.freeze(rows.filter(row=>row.last_error)),
      executionAuthority:false,
    })
  }

  private async rows(table:string,entityId:string,column:string,orderColumn?:string):Promise<Row[]>{
    let query=this.client.from(table).select('*').eq('user_id',this.ownerUserId).eq(column,entityId)
    if(orderColumn)query=query.order(orderColumn,{ascending:false})
    const {data,error}=await query.limit(500)
    if(error)throw new Error('RELATIONSHIP_READ_FAILED:'+table+':'+error.message)
    return (data??[]) as Row[]
  }

  private async edgeRows(entityId:string):Promise<Row[]>{
    const {data,error}=await this.client.from('jhadina_relationship_edges')
      .select('*')
      .eq('user_id',this.ownerUserId)
      .or('from_entity_id.eq.'+entityId+',to_entity_id.eq.'+entityId)
      .limit(500)
    if(error)throw new Error('RELATIONSHIP_EDGE_READ_FAILED:'+error.message)
    return (data??[]) as Row[]
  }

  private assertOwner(ownerUserId:string):void{
    if(ownerUserId!==this.ownerUserId)throw new Error('RELATIONSHIP_OWNER_MISMATCH')
  }
}

function identityFromRow(row:Row):RelationshipIdentity{
  return {
    id:String(row.id),entityId:String(row.entity_id),scheme:String(row.scheme) as RelationshipIdentity['scheme'],
    value:String(row.value),normalizedValue:String(row.normalized_value),
    verifiedAt:asString(row.verified_at),evidenceRefs:asStrings(row.evidence_refs),
  }
}
function roleFromRow(row:Row):RelationshipRole{
  return {
    id:String(row.id),entityId:String(row.entity_id),role:String(row.role) as RelationshipRole['role'],
    domain:String(row.domain),contextRef:asString(row.context_ref),validFrom:String(row.valid_from),
    validTo:asString(row.valid_to),evidenceRefs:asStrings(row.evidence_refs),
  }
}
function activityFromRow(row:Row):RelationshipActivity{
  return {
    id:String(row.id),entityId:String(row.entity_id),type:String(row.activity_type),
    occurredAt:String(row.occurred_at),contextRef:asString(row.context_ref),summary:String(row.summary),
    evidenceRefs:asStrings(row.evidence_refs),metadata:record(row.metadata),
  }
}
function linkFromRow(row:Row):EntityContextLink{
  return {
    id:String(row.id),entityId:String(row.entity_id),contextKind:String(row.context_kind) as EntityContextLink['contextKind'],
    contextRef:String(row.context_ref),relation:String(row.relation),occurredAt:String(row.occurred_at),
    evidenceRefs:asStrings(row.evidence_refs),
  }
}
function factFromRow(row:Row):CanonicalRelationshipFact{
  return {
    id:String(row.id),entityId:String(row.entity_id),field:String(row.field),value:row.value,
    evidenceRefs:asStrings(row.evidence_refs),status:String(row.status) as CanonicalRelationshipFact['status'],
    verifiedAt:String(row.verified_at),
  }
}
function suggestionFromRow(row:Row):RelationshipFactSuggestion{
  return {
    id:String(row.id),entityId:String(row.entity_id),field:String(row.field),proposedValue:row.proposed_value,
    evidenceRefs:asStrings(row.evidence_refs),reason:String(row.reason),
    createdAt:String(row.created_at),status:String(row.status) as RelationshipFactSuggestion['status'],
  }
}
function workFromRow(row:Row):RelationshipWorkItem{
  return {
    id:String(row.id),ownerUserId:String(row.user_id),capability:String(row.capability),
    entityRef:String(row.entity_ref),reason:String(row.reason),dueAt:String(row.due_at),
    priority:Number(row.priority??0),status:String(row.status) as RelationshipWorkItem['status'],
    leaseOwner:asString(row.lease_owner),leaseExpiresAt:asString(row.lease_expires_at),
    attemptCount:Number(row.attempt_count??0),budget:typeof row.budget==='number'?row.budget:undefined,
    correlationId:String(row.correlation_id),evidenceRefs:asStrings(row.evidence_refs),
    lastError:asString(row.last_error),executionAuthorized:false,
  }
}

export function requireRelationshipEntity<T>(value:T|undefined):T{
  return required(value,'RELATIONSHIP_ENTITY_NOT_FOUND')
}
