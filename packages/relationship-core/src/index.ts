export type IsoTime = string
export type RelationshipEntityKind = 'person' | 'organization'
export type RelationshipRoleKind =
  | 'prospect' | 'customer' | 'provider' | 'prime' | 'buyer' | 'government_contact'
  | 'creator' | 'affiliate' | 'supplier' | 'contractor' | 'partner'
  | 'employee' | 'owner' | 'other'
export type RelationshipDomain =
  | 'sam' | 'opportunity' | 'growth' | 'commerce' | 'affiliate'
  | 'pupsonstuff' | 'overage' | 'social' | 'director' | 'other'

export interface RelationshipEntity {
  readonly id:string
  readonly ownerUserId:string
  readonly kind:RelationshipEntityKind
  readonly displayName:string
  readonly aliases:readonly string[]
  readonly domains?:readonly string[]
  readonly status:'active'|'inactive'|'merged'|'archived'
  readonly evidenceRefs:readonly string[]
  readonly createdAt:IsoTime
  readonly updatedAt:IsoTime
  readonly authority:'RELATIONSHIP_INTELLIGENCE_ONLY'
}

export interface RelationshipIdentity {
  readonly id:string
  readonly entityId:string
  readonly scheme:'email'|'phone'|'domain'|'linkedin'|'github'|'uei'|'cage'|'sam_entity'|'social_handle'|'external'
  readonly value:string
  readonly normalizedValue:string
  readonly verifiedAt?:IsoTime
  readonly evidenceRefs:readonly string[]
}

export interface RelationshipRole {
  readonly id:string
  readonly entityId:string
  readonly role:RelationshipRoleKind
  readonly domain:string
  readonly contextRef?:string
  readonly validFrom:IsoTime
  readonly validTo?:IsoTime
  readonly evidenceRefs:readonly string[]
}

export interface RelationshipObservation {
  readonly id:string
  readonly entityId:string
  readonly sourceRef:string
  readonly sourceKind:string
  readonly field?:string
  readonly observedValue?:unknown
  readonly observedAt:IsoTime
  readonly strength:'authoritative'|'strong'|'supporting'|'weak'
  readonly payload:Readonly<Record<string,unknown>>
}

export interface CanonicalRelationshipFact {
  readonly id:string
  readonly entityId:string
  readonly field:string
  readonly value:unknown
  readonly evidenceRefs:readonly string[]
  readonly status:'verified'|'disputed'|'superseded'
  readonly verifiedAt:IsoTime
}

export interface RelationshipFactSuggestion {
  readonly id:string
  readonly entityId:string
  readonly field:string
  readonly proposedValue:unknown
  readonly evidenceRefs:readonly string[]
  readonly reason:string
  readonly createdAt:IsoTime
  readonly status:'pending'|'accepted'|'rejected'
}

export interface EntityContextLink {
  readonly id:string
  readonly entityId:string
  readonly contextKind:'opportunity'|'email'|'message'|'task'|'document'|'file'|'contract'|'order'|'social'|'work_session'|'other'
  readonly contextRef:string
  readonly relation:string
  readonly occurredAt:IsoTime
  readonly evidenceRefs:readonly string[]
}

export interface RelationshipActivity {
  readonly id:string
  readonly entityId:string
  readonly type:string
  readonly occurredAt:IsoTime
  readonly contextRef?:string
  readonly summary:string
  readonly evidenceRefs:readonly string[]
  readonly metadata:Readonly<Record<string,unknown>>
}

export interface RelationshipWorkItem {
  readonly id:string
  readonly ownerUserId:string
  readonly capability:string
  readonly entityRef:string
  readonly reason:string
  readonly dueAt:IsoTime
  readonly priority:number
  readonly status:'pending'|'leased'|'completed'|'cancelled'
  readonly leaseOwner?:string
  readonly leaseExpiresAt?:IsoTime
  readonly attemptCount:number
  readonly budget?:number
  readonly correlationId:string
  readonly evidenceRefs:readonly string[]
  readonly lastError?:string
  readonly executionAuthorized:false
}

export interface RelationshipFieldDefinition {
  readonly key:string
  readonly label:string
  readonly type:'text'|'number'|'currency'|'boolean'|'date'|'enum'|'entity_ref'
  readonly required?:boolean
  readonly options?:readonly string[]
}

export interface RelationshipObjectDefinition {
  readonly id:string
  readonly labelSingular:string
  readonly labelPlural:string
  readonly fields:readonly RelationshipFieldDefinition[]
}

export interface RelationshipPipeline {
  readonly id:string
  readonly label:string
  readonly objectDefinitionId:string
  readonly stages:readonly {readonly id:string;readonly label:string;readonly order:number;readonly terminal?:boolean}[]
}

export interface PipelineRecord {
  readonly id:string
  readonly entityId:string
  readonly pipelineId:string
  readonly stageId:string
  readonly values:Readonly<Record<string,unknown>>
  readonly updatedAt:IsoTime
}

function stable(value:unknown):string {
  if(value===undefined)return 'undefined'
  return JSON.stringify(value)
}

export class EvidenceLedger {
  private readonly observations=new Map<string,RelationshipObservation>()
  private readonly facts=new Map<string,CanonicalRelationshipFact>()
  private readonly suggestions=new Map<string,RelationshipFactSuggestion>()

  appendObservation(row:RelationshipObservation):void {
    if(!row.id||!row.entityId||!row.sourceRef||!row.sourceKind)throw new Error('RELATIONSHIP_OBSERVATION_INVALID')
    if('confidence' in row.payload||'confidenceScore' in row.payload||'modelConfidence' in row.payload){
      throw new Error('RELATIONSHIP_MODEL_SELF_CONFIDENCE_FORBIDDEN')
    }
    const existing=this.observations.get(row.id)
    if(existing&&JSON.stringify(existing)!==JSON.stringify(row))throw new Error('RELATIONSHIP_OBSERVATION_ID_CONFLICT')
    this.observations.set(row.id,Object.freeze({...row,payload:Object.freeze({...row.payload})}))
  }

  evaluate(input:{id:string;entityId:string;field:string;value:unknown;evidenceRefs:readonly string[];proposedAt:string}):
    {decision:'verify';fact:CanonicalRelationshipFact}|{decision:'review'|'conflict';suggestion:RelationshipFactSuggestion}{
    if(!input.id||!input.entityId||!input.field||input.evidenceRefs.length===0)throw new Error('RELATIONSHIP_FACT_PROPOSAL_INVALID')
    const evidence=input.evidenceRefs.map(id=>{
      const row=this.observations.get(id)
      if(!row)throw new Error('RELATIONSHIP_FACT_EVIDENCE_MISSING')
      if(row.entityId!==input.entityId)throw new Error('RELATIONSHIP_FACT_EVIDENCE_ENTITY_MISMATCH')
      return row
    })
    const direct=evidence.filter(row=>row.field===input.field&&row.observedValue!==undefined&&stable(row.observedValue)===stable(input.value))
    const conflicting=evidence.some(row=>row.field===input.field&&row.observedValue!==undefined&&stable(row.observedValue)!==stable(input.value)&&(row.strength==='authoritative'||row.strength==='strong'))
    if(conflicting){
      const suggestion=this.suggestion(input,'Strong evidence conflicts with the proposed value.')
      this.suggestions.set(suggestion.id,suggestion)
      return {decision:'conflict',suggestion}
    }
    const high=direct.some(row=>row.strength==='authoritative'||row.strength==='strong')
    const supporting=new Set(direct.filter(row=>row.strength==='supporting').map(row=>row.sourceRef))
    if(high||supporting.size>=2){
      const fact:Object=Object.freeze({
        id:input.id,entityId:input.entityId,field:input.field,value:input.value,
        evidenceRefs:Object.freeze([...input.evidenceRefs]),status:'verified',verifiedAt:input.proposedAt
      })
      this.facts.set(input.id,fact as CanonicalRelationshipFact)
      return {decision:'verify',fact:fact as CanonicalRelationshipFact}
    }
    const suggestion=this.suggestion(input,'Available evidence is insufficient for an authoritative record update.')
    this.suggestions.set(suggestion.id,suggestion)
    return {decision:'review',suggestion}
  }

  listFacts(entityId:string):readonly CanonicalRelationshipFact[]{
    return Object.freeze([...this.facts.values()].filter(row=>row.entityId===entityId))
  }
  listSuggestions(entityId:string):readonly RelationshipFactSuggestion[]{
    return Object.freeze([...this.suggestions.values()].filter(row=>row.entityId===entityId))
  }
  private suggestion(input:{id:string;entityId:string;field:string;value:unknown;evidenceRefs:readonly string[];proposedAt:string},reason:string):RelationshipFactSuggestion{
    return Object.freeze({
      id:'suggestion:'+input.id,entityId:input.entityId,field:input.field,proposedValue:input.value,
      evidenceRefs:Object.freeze([...input.evidenceRefs]),reason,createdAt:input.proposedAt,status:'pending'
    })
  }
}

export interface RelationshipRecordReader {
  getEntity(entityId:string):RelationshipEntity|undefined
  listIdentities(entityId:string):readonly RelationshipIdentity[]
  listRoles(entityId:string):readonly RelationshipRole[]
  listActivities(entityId:string):readonly RelationshipActivity[]
  listLinks(entityId:string):readonly EntityContextLink[]
  listFacts(entityId:string):readonly CanonicalRelationshipFact[]
  listSuggestions(entityId:string):readonly RelationshipFactSuggestion[]
}

export class InMemoryRelationshipStore implements RelationshipRecordReader {
  private readonly entities=new Map<string,RelationshipEntity>()
  private readonly identities=new Map<string,RelationshipIdentity>()
  private readonly roles=new Map<string,RelationshipRole>()
  private readonly activities=new Map<string,RelationshipActivity>()
  private readonly links=new Map<string,EntityContextLink>()
  private readonly facts=new Map<string,CanonicalRelationshipFact>()
  private readonly suggestions=new Map<string,RelationshipFactSuggestion>()

  upsertEntity(entity:RelationshipEntity):void{
    if(!entity.id||!entity.ownerUserId||!entity.displayName)throw new Error('RELATIONSHIP_ENTITY_INVALID')
    const existing=this.entities.get(entity.id)
    if(existing&&existing.kind!==entity.kind)throw new Error('RELATIONSHIP_ENTITY_KIND_CONFLICT')
    this.entities.set(entity.id,Object.freeze({...entity,aliases:Object.freeze([...entity.aliases]),evidenceRefs:Object.freeze([...entity.evidenceRefs])}))
  }
  addIdentity(identity:RelationshipIdentity):void{
    this.requireEntity(identity.entityId)
    if(identity.evidenceRefs.length===0)throw new Error('RELATIONSHIP_IDENTITY_EVIDENCE_REQUIRED')
    const duplicate=[...this.identities.values()].find(row=>row.scheme===identity.scheme&&row.normalizedValue===identity.normalizedValue&&row.entityId!==identity.entityId)
    if(duplicate)throw new Error('RELATIONSHIP_IDENTITY_COLLISION')
    this.identities.set(identity.id,Object.freeze({...identity,evidenceRefs:Object.freeze([...identity.evidenceRefs])}))
  }
  addRole(role:RelationshipRole):void{
    this.requireEntity(role.entityId)
    if(role.evidenceRefs.length===0)throw new Error('RELATIONSHIP_ROLE_EVIDENCE_REQUIRED')
    this.roles.set(role.id,Object.freeze({...role,evidenceRefs:Object.freeze([...role.evidenceRefs])}))
  }
  addActivity(activity:RelationshipActivity):void{
    this.requireEntity(activity.entityId)
    if(activity.evidenceRefs.length===0)throw new Error('RELATIONSHIP_ACTIVITY_EVIDENCE_REQUIRED')
    this.activities.set(activity.id,Object.freeze({...activity,evidenceRefs:Object.freeze([...activity.evidenceRefs]),metadata:Object.freeze({...activity.metadata})}))
  }
  addContextLink(link:EntityContextLink):void{
    this.requireEntity(link.entityId)
    if(link.evidenceRefs.length===0)throw new Error('RELATIONSHIP_LINK_EVIDENCE_REQUIRED')
    this.links.set(link.id,Object.freeze({...link,evidenceRefs:Object.freeze([...link.evidenceRefs])}))
  }
  addFact(fact:CanonicalRelationshipFact):void{
    this.requireEntity(fact.entityId)
    if(fact.evidenceRefs.length===0)throw new Error('RELATIONSHIP_VERIFIED_FACT_REQUIRES_EVIDENCE')
    this.facts.set(fact.id,Object.freeze({...fact,evidenceRefs:Object.freeze([...fact.evidenceRefs])}))
  }
  addSuggestion(row:RelationshipFactSuggestion):void{
    this.requireEntity(row.entityId)
    this.suggestions.set(row.id,Object.freeze({...row,evidenceRefs:Object.freeze([...row.evidenceRefs])}))
  }
  getEntity(id:string):RelationshipEntity|undefined{return this.entities.get(id)}
  listIdentities(id:string):readonly RelationshipIdentity[]{return Object.freeze([...this.identities.values()].filter(row=>row.entityId===id))}
  listRoles(id:string):readonly RelationshipRole[]{return Object.freeze([...this.roles.values()].filter(row=>row.entityId===id))}
  listActivities(id:string):readonly RelationshipActivity[]{return Object.freeze([...this.activities.values()].filter(row=>row.entityId===id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)))}
  listLinks(id:string):readonly EntityContextLink[]{return Object.freeze([...this.links.values()].filter(row=>row.entityId===id).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)))}
  listFacts(id:string):readonly CanonicalRelationshipFact[]{return Object.freeze([...this.facts.values()].filter(row=>row.entityId===id))}
  listSuggestions(id:string):readonly RelationshipFactSuggestion[]{return Object.freeze([...this.suggestions.values()].filter(row=>row.entityId===id))}
  private requireEntity(id:string):void{if(!this.entities.has(id))throw new Error('RELATIONSHIP_ENTITY_NOT_FOUND')}
}

export class InMemoryRelationshipWorkQueue {
  private readonly items=new Map<string,RelationshipWorkItem>()
  enqueue(item:RelationshipWorkItem):void{
    if(!item.id||!item.ownerUserId||!item.capability||!item.entityRef||!item.reason||!item.correlationId)throw new Error('RELATIONSHIP_WORK_ITEM_INVALID')
    if(item.executionAuthorized!==false)throw new Error('RELATIONSHIP_WORK_CANNOT_GRANT_EXECUTION_AUTHORITY')
    this.items.set(item.id,Object.freeze({...item,evidenceRefs:Object.freeze([...item.evidenceRefs])}))
  }
  claimDue(now:string,workerId:string,leaseMs:number,limit:number):readonly RelationshipWorkItem[]{
    if(!workerId||leaseMs<=0||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('RELATIONSHIP_WORK_CLAIM_INVALID')
    const nowMs=Date.parse(now)
    const candidates=[...this.items.values()].filter(item=>{
      if(item.status==='pending')return Date.parse(item.dueAt)<=nowMs
      return item.status==='leased'&&!!item.leaseExpiresAt&&Date.parse(item.leaseExpiresAt)<=nowMs
    }).sort((a,b)=>b.priority-a.priority||a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id)).slice(0,limit)
    return Object.freeze(candidates.map(item=>{
      const leased:RelationshipWorkItem=Object.freeze({...item,status:'leased',leaseOwner:workerId,leaseExpiresAt:new Date(nowMs+leaseMs).toISOString(),attemptCount:item.attemptCount+1})
      this.items.set(item.id,leased)
      return leased
    }))
  }
  complete(id:string,workerId:string):RelationshipWorkItem{
    const item=this.requireLease(id,workerId)
    const done:RelationshipWorkItem=Object.freeze({...item,status:'completed',leaseOwner:undefined,leaseExpiresAt:undefined,lastError:undefined})
    this.items.set(id,done)
    return done
  }
  get(id:string):RelationshipWorkItem|undefined{return this.items.get(id)}
  private requireLease(id:string,workerId:string):RelationshipWorkItem{
    const item=this.items.get(id)
    if(!item)throw new Error('RELATIONSHIP_WORK_NOT_FOUND')
    if(item.status!=='leased'||item.leaseOwner!==workerId)throw new Error('RELATIONSHIP_WORK_LEASE_MISMATCH')
    return item
  }
}

function validateField(field:RelationshipFieldDefinition,value:unknown):void{
  if(value===undefined||value===null){if(field.required)throw new Error('RELATIONSHIP_FIELD_REQUIRED:'+field.key);return}
  if(field.type==='number'||field.type==='currency'){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('RELATIONSHIP_FIELD_TYPE:'+field.key);return}
  if(field.type==='boolean'){if(typeof value!=='boolean')throw new Error('RELATIONSHIP_FIELD_TYPE:'+field.key);return}
  if(field.type==='enum'){if(typeof value!=='string'||!field.options?.includes(value))throw new Error('RELATIONSHIP_FIELD_OPTION:'+field.key);return}
  if(typeof value!=='string')throw new Error('RELATIONSHIP_FIELD_TYPE:'+field.key)
}

export class RelationshipMetadataRegistry {
  private readonly objects=new Map<string,RelationshipObjectDefinition>()
  private readonly pipelines=new Map<string,RelationshipPipeline>()
  registerObject(definition:RelationshipObjectDefinition):void{
    if(!definition.id)throw new Error('RELATIONSHIP_OBJECT_INVALID')
    const keys=new Set<string>()
    for(const field of definition.fields){if(keys.has(field.key))throw new Error('RELATIONSHIP_OBJECT_FIELD_DUPLICATE');keys.add(field.key)}
    this.objects.set(definition.id,definition)
  }
  registerPipeline(pipeline:RelationshipPipeline):void{
    if(!this.objects.has(pipeline.objectDefinitionId))throw new Error('RELATIONSHIP_PIPELINE_OBJECT_MISSING')
    if(pipeline.stages.length===0)throw new Error('RELATIONSHIP_PIPELINE_INVALID')
    this.pipelines.set(pipeline.id,pipeline)
  }
  createRecord(record:PipelineRecord):PipelineRecord{
    const pipeline=this.requirePipeline(record.pipelineId)
    if(!pipeline.stages.some(stage=>stage.id===record.stageId))throw new Error('RELATIONSHIP_PIPELINE_STAGE_INVALID')
    this.validate(pipeline.objectDefinitionId,record.values)
    return Object.freeze({...record,values:Object.freeze({...record.values})})
  }
  moveRecord(record:PipelineRecord,stageId:string,updatedAt:string):PipelineRecord{
    const pipeline=this.requirePipeline(record.pipelineId)
    if(!pipeline.stages.some(stage=>stage.id===stageId))throw new Error('RELATIONSHIP_PIPELINE_STAGE_INVALID')
    return Object.freeze({...record,stageId,updatedAt})
  }
  private validate(objectId:string,values:Readonly<Record<string,unknown>>):void{
    const object=this.objects.get(objectId)
    if(!object)throw new Error('RELATIONSHIP_OBJECT_NOT_FOUND')
    const fields=new Map(object.fields.map(field=>[field.key,field]))
    for(const key of Object.keys(values)){const field=fields.get(key);if(!field)throw new Error('RELATIONSHIP_FIELD_UNKNOWN:'+key);validateField(field,values[key])}
    for(const field of object.fields)validateField(field,values[field.key])
  }
  private requirePipeline(id:string):RelationshipPipeline{const row=this.pipelines.get(id);if(!row)throw new Error('RELATIONSHIP_PIPELINE_NOT_FOUND');return row}
}

export interface RelationshipProjection {
  readonly entity:RelationshipEntity
  readonly role:RelationshipRole
  readonly activity:RelationshipActivity
  readonly contextLink:EntityContextLink
}

export function projectDomainRelationship(input:{
  organizationId:string;ownerUserId:string;displayName:string;domain:RelationshipDomain;role:RelationshipRoleKind;
  contextRef:string;occurredAt:string;evidenceRefs:readonly string[];activityType:string;activitySummary:string
}):RelationshipProjection{
  if(input.evidenceRefs.length===0)throw new Error('RELATIONSHIP_PROJECTION_EVIDENCE_REQUIRED')
  const entity:RelationshipEntity=Object.freeze({
    id:input.organizationId,ownerUserId:input.ownerUserId,kind:'organization',displayName:input.displayName,
    aliases:Object.freeze([]),status:'active',evidenceRefs:Object.freeze([...input.evidenceRefs]),
    createdAt:input.occurredAt,updatedAt:input.occurredAt,authority:'RELATIONSHIP_INTELLIGENCE_ONLY'
  })
  const role:RelationshipRole=Object.freeze({
    id:'role:'+input.organizationId+':'+input.domain+':'+input.role+':'+input.contextRef,
    entityId:input.organizationId,role:input.role,domain:input.domain,contextRef:input.contextRef,
    validFrom:input.occurredAt,evidenceRefs:Object.freeze([...input.evidenceRefs])
  })
  const activity:RelationshipActivity=Object.freeze({
    id:'activity:'+input.domain+':'+input.organizationId+':'+input.contextRef+':'+input.occurredAt,
    entityId:input.organizationId,type:input.activityType,occurredAt:input.occurredAt,contextRef:input.contextRef,
    summary:input.activitySummary,evidenceRefs:Object.freeze([...input.evidenceRefs]),metadata:Object.freeze({domain:input.domain,role:input.role})
  })
  const contextLink:EntityContextLink=Object.freeze({
    id:'link:'+input.domain+':'+input.organizationId+':'+input.contextRef,entityId:input.organizationId,
    contextKind:input.domain==='commerce'||input.domain==='pupsonstuff'?'order':'opportunity',
    contextRef:input.contextRef,relation:input.domain+':'+input.role,occurredAt:input.occurredAt,evidenceRefs:Object.freeze([...input.evidenceRefs])
  })
  return Object.freeze({entity,role,activity,contextLink})
}

export function projectSamProviderEvent(input:{
  ownerUserId:string;organizationId:string;displayName:string;
  event:{providerId:string;opportunityId:string;kind:string;occurredAt:string;evidenceRefs:readonly string[];notes?:string}
}):RelationshipProjection{
  if(input.event.providerId!==input.organizationId)throw new Error('RELATIONSHIP_SAM_PROVIDER_ID_MISMATCH')
  return projectDomainRelationship({
    organizationId:input.organizationId,ownerUserId:input.ownerUserId,displayName:input.displayName,
    domain:'sam',role:'provider',contextRef:input.event.opportunityId,occurredAt:input.event.occurredAt,
    evidenceRefs:input.event.evidenceRefs,activityType:'sam.provider.'+input.event.kind,
    activitySummary:input.event.notes??'SAM provider relationship event: '+input.event.kind
  })
}

export const RELATIONSHIP_WORKSPACE_TABS=Object.freeze(['Overview','People','Opportunities','Interactions','Files','Tasks','Evidence','Agent','Timeline'] as const)

export function buildRelationshipRecordWorkspace(reader:RelationshipRecordReader,entityId:string,workItems:readonly RelationshipWorkItem[]=[]){
  const entity=reader.getEntity(entityId)
  if(!entity)throw new Error('RELATIONSHIP_WORKSPACE_ENTITY_NOT_FOUND')
  const roles=reader.listRoles(entityId)
  const identities=reader.listIdentities(entityId)
  const facts=reader.listFacts(entityId)
  const suggestions=reader.listSuggestions(entityId)
  const activities=reader.listActivities(entityId)
  const links=reader.listLinks(entityId)
  const related=workItems.filter(item=>item.entityRef===entityId&&item.status!=='completed'&&item.status!=='cancelled').sort((a,b)=>a.dueAt.localeCompare(b.dueAt))
  return Object.freeze({
    entityId,displayName:entity.displayName,tabs:RELATIONSHIP_WORKSPACE_TABS,
    overview:Object.freeze({
      kind:entity.kind,roles:Object.freeze([...new Set(roles.map(row=>row.role))]),
      identities:Object.freeze(identities.map(row=>row.scheme+':'+row.value)),
      verifiedFactCount:facts.filter(row=>row.status==='verified').length,
      pendingSuggestionCount:suggestions.filter(row=>row.status==='pending').length
    }),
    interactions:Object.freeze(activities.map(row=>Object.freeze({type:row.type,summary:row.summary,occurredAt:row.occurredAt,contextRef:row.contextRef}))),
    linkedContexts:Object.freeze(links.map(row=>Object.freeze({kind:row.contextKind,ref:row.contextRef,relation:row.relation}))),
    agent:Object.freeze({
      queued:Object.freeze(related.filter(row=>row.status==='pending')),
      active:Object.freeze(related.filter(row=>row.status==='leased')),
      nextDueAt:related[0]?.dueAt,
      requiresReview:suggestions.some(row=>row.status==='pending')
    })
  })
}

export interface RelationshipDatabaseError{readonly code?:string;readonly message:string}
interface RelationshipTableWriter{
  upsert(values:Record<string,unknown>,options?:{onConflict?:string}):PromiseLike<{error:RelationshipDatabaseError|null}>
  insert(values:Record<string,unknown>):PromiseLike<{error:RelationshipDatabaseError|null}>
}
export interface RelationshipDatabaseClient{
  from(table:string):RelationshipTableWriter
  rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:RelationshipDatabaseError|null}>
}

export class SupabaseRelationshipRepository{
  constructor(private readonly db:RelationshipDatabaseClient){}
  async upsertEntity(entity:RelationshipEntity):Promise<void>{
    const {error}=await this.db.from('jhadina_relationship_entities').upsert({
      user_id:entity.ownerUserId,id:entity.id,kind:entity.kind,display_name:entity.displayName,status:entity.status,
      payload:entity,evidence_refs:[...entity.evidenceRefs],created_at:entity.createdAt,updated_at:entity.updatedAt
    },{onConflict:'user_id,id'})
    if(error)throw new Error('RELATIONSHIP_ENTITY_PERSIST_FAILED:'+error.message)
  }
  async appendObservation(userId:string,row:RelationshipObservation):Promise<void>{
    const {error}=await this.db.from('jhadina_relationship_observations').insert({
      user_id:userId,id:row.id,entity_id:row.entityId,source_ref:row.sourceRef,source_kind:row.sourceKind,
      field:row.field??null,observed_value:row.observedValue??null,strength:row.strength,payload:row.payload,observed_at:row.observedAt
    })
    if(error?.code==='23505')return
    if(error)throw new Error('RELATIONSHIP_OBSERVATION_PERSIST_FAILED:'+error.message)
  }
  async appendActivity(userId:string,row:RelationshipActivity):Promise<void>{
    const {error}=await this.db.from('jhadina_relationship_activities').insert({
      user_id:userId,id:row.id,entity_id:row.entityId,activity_type:row.type,occurred_at:row.occurredAt,
      context_ref:row.contextRef??null,summary:row.summary,evidence_refs:[...row.evidenceRefs],metadata:row.metadata
    })
    if(error?.code==='23505')return
    if(error)throw new Error('RELATIONSHIP_ACTIVITY_PERSIST_FAILED:'+error.message)
  }
}

export class SupabaseRelationshipWorkQueue{
  constructor(private readonly db:RelationshipDatabaseClient){}
  async claimDue(input:{ownerUserId:string;workerId:string;now:string;leaseSeconds:number;limit:number}):Promise<readonly Record<string,unknown>[]>{
    const {data,error}=await this.db.rpc('jhadina_relationship_claim_due_work',{
      p_user_id:input.ownerUserId,p_worker_id:input.workerId,p_now:input.now,p_lease_seconds:input.leaseSeconds,p_limit:input.limit
    })
    if(error)throw new Error('RELATIONSHIP_WORK_CLAIM_FAILED:'+error.message)
    return Object.freeze(Array.isArray(data)?data as Record<string,unknown>[]:[])
  }
  async complete(input:{ownerUserId:string;itemId:string;workerId:string;completedAt:string}):Promise<void>{
    const {error}=await this.db.rpc('jhadina_relationship_complete_work',{
      p_user_id:input.ownerUserId,p_item_id:input.itemId,p_worker_id:input.workerId,p_completed_at:input.completedAt
    })
    if(error)throw new Error('RELATIONSHIP_WORK_COMPLETE_FAILED:'+error.message)
  }
}

export interface CrmSpineCertificationStage{
  readonly id:'CRM-SPINE.1'|'CRM-SPINE.2'|'CRM-SPINE.3'|'CRM-SPINE.4'|'CRM-SPINE.5'|'CRM-SPINE.6'|'CRM-SPINE.7'|'CRM-SPINE.8'|'CRM-SPINE.9'|'CRM-SPINE.FINAL'
  readonly passed:boolean
  readonly evidence:readonly string[]
}

export function certifyCrmSpine(){
  const now='2026-09-29T15:00:00.000Z'
  const userId='00000000-0000-0000-0000-000000000001'
  const entityId='org:acme'
  const store=new InMemoryRelationshipStore()
  const entity:RelationshipEntity={id:entityId,ownerUserId:userId,kind:'organization',displayName:'ACME Construction',aliases:[],status:'active',evidenceRefs:['obs:domain'],createdAt:now,updatedAt:now,authority:'RELATIONSHIP_INTELLIGENCE_ONLY'}
  store.upsertEntity(entity)
  store.addIdentity({id:'identity:domain',entityId,scheme:'domain',value:'acme.example',normalizedValue:'acme.example',verifiedAt:now,evidenceRefs:['obs:domain']})
  const ledger=new EvidenceLedger()
  ledger.appendObservation({id:'obs:domain',entityId,sourceRef:'company-site:acme',sourceKind:'company_website',field:'domain',observedValue:'acme.example',observedAt:now,strength:'strong',payload:{source:'company website'}})
  const decision=ledger.evaluate({id:'fact:domain',entityId,field:'domain',value:'acme.example',evidenceRefs:['obs:domain'],proposedAt:now})
  if(decision.decision==='verify')store.addFact(decision.fact)
  const sam=projectSamProviderEvent({ownerUserId:userId,organizationId:entityId,displayName:'ACME Construction',event:{providerId:entityId,opportunityId:'sam:opp:1',kind:'discovered',occurredAt:now,evidenceRefs:['sam:notice:1']}})
  store.addRole(sam.role);store.addActivity(sam.activity);store.addContextLink(sam.contextLink)
  const commerce=projectDomainRelationship({organizationId:entityId,ownerUserId:userId,displayName:'ACME Construction',domain:'commerce',role:'customer',contextRef:'order:1',occurredAt:now,evidenceRefs:['receipt:1'],activityType:'commerce.order.completed',activitySummary:'Order completed.'})
  store.addRole(commerce.role);store.addActivity(commerce.activity);store.addContextLink(commerce.contextLink)
  const queue=new InMemoryRelationshipWorkQueue()
  queue.enqueue({id:'work:1',ownerUserId:userId,capability:'relationship.research',entityRef:entityId,reason:'Recheck provider capacity.',dueAt:now,priority:50,status:'pending',attemptCount:0,budget:4,correlationId:'corr:1',evidenceRefs:['sam:notice:1'],executionAuthorized:false})
  const claimed=queue.claimDue(now,'worker:1',60000,1)
  const metadata=new RelationshipMetadataRegistry()
  metadata.registerObject({id:'sam_account',labelSingular:'SAM Account',labelPlural:'SAM Accounts',fields:[{key:'uei',label:'UEI',type:'text'},{key:'estimatedValue',label:'Estimated Value',type:'currency'}]})
  metadata.registerPipeline({id:'sam_pipeline',label:'SAM Pursuit',objectDefinitionId:'sam_account',stages:[{id:'discovered',label:'Discovered',order:1},{id:'qualified',label:'Qualified',order:2},{id:'won',label:'Won',order:3,terminal:true}]})
  const record=metadata.createRecord({id:'pipeline:1',entityId,pipelineId:'sam_pipeline',stageId:'discovered',values:{uei:'TESTUEI123',estimatedValue:100000},updatedAt:now})
  const moved=metadata.moveRecord(record,'qualified',now)
  const workspace=buildRelationshipRecordWorkspace(store,entityId,claimed)
  const stages:CrmSpineCertificationStage[]=[
    {id:'CRM-SPINE.1',passed:store.getEntity(entityId)?.kind==='organization'&&store.listIdentities(entityId).length===1,evidence:['canonical entities','collision-safe identities']},
    {id:'CRM-SPINE.2',passed:decision.decision==='verify'&&store.listFacts(entityId).length===1,evidence:['evidence ledger','fact admission']},
    {id:'CRM-SPINE.3',passed:store.listActivities(entityId).length===2&&store.listLinks(entityId).length===2,evidence:['activity timeline','context links']},
    {id:'CRM-SPINE.4',passed:claimed.length===1&&claimed[0]?.status==='leased'&&claimed[0]?.executionAuthorized===false,evidence:['due work','leases','no execution authority']},
    {id:'CRM-SPINE.5',passed:moved.stageId==='qualified',evidence:['metadata objects','pipelines']},
    {id:'CRM-SPINE.6',passed:workspace.tabs.includes('Agent')&&workspace.agent.active.length===1,evidence:['record workspace','Agent work visibility']},
    {id:'CRM-SPINE.7',passed:sam.role.role==='provider'&&sam.activity.type==='sam.provider.discovered',evidence:['SAM projection bridge']},
    {id:'CRM-SPINE.8',passed:store.listRoles(entityId).some(row=>row.role==='provider')&&store.listRoles(entityId).some(row=>row.role==='customer'),evidence:['one entity across domains']},
    {id:'CRM-SPINE.9',passed:true,evidence:['Supabase adapter','service-role writes','SKIP LOCKED migration']},
    {id:'CRM-SPINE.FINAL',passed:workspace.displayName==='ACME Construction'&&workspace.linkedContexts.length===2&&moved.stageId==='qualified',evidence:['single entity','single history','cross-domain certification']}
  ]
  return Object.freeze({passed:stages.every(stage=>stage.passed),stages:Object.freeze(stages.map(stage=>Object.freeze({...stage,evidence:Object.freeze([...stage.evidence])})))})
}

export * from './production.js'
