import type {SupabaseClient} from '@supabase/supabase-js'
import {
  deriveRelationshipIntelligence,
  type EntityContextLink,
  type RelationshipActivity,
  type RelationshipFactSuggestion,
  type RelationshipIdentity,
  type RelationshipRole,
} from '@jhadina/relationship-core'
import {ProductionRelationshipRepository} from './production-repository'

type Row=Record<string,unknown>
const strings=(value:unknown):string[]=>Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[]

export async function refreshRelationshipIntelligence(
  client:SupabaseClient,
  ownerUserId:string,
  entityId:string,
  now=new Date().toISOString(),
){
  const [activitiesResult,linksResult,suggestionsResult,identitiesResult,rolesResult,edgesResult]=await Promise.all([
    client.from('jhadina_relationship_activities').select('*').eq('user_id',ownerUserId).eq('entity_id',entityId).order('occurred_at',{ascending:false}).limit(500),
    client.from('jhadina_relationship_context_links').select('*').eq('user_id',ownerUserId).eq('entity_id',entityId).order('occurred_at',{ascending:false}).limit(500),
    client.from('jhadina_relationship_fact_suggestions').select('*').eq('user_id',ownerUserId).eq('entity_id',entityId).order('created_at',{ascending:false}).limit(500),
    client.from('jhadina_relationship_identities').select('*').eq('user_id',ownerUserId).eq('entity_id',entityId).limit(500),
    client.from('jhadina_relationship_roles').select('*').eq('user_id',ownerUserId).eq('entity_id',entityId).limit(500),
    client.from('jhadina_relationship_edges').select('relation,from_entity_id,to_entity_id').eq('user_id',ownerUserId).or('from_entity_id.eq.'+entityId+',to_entity_id.eq.'+entityId).limit(500),
  ])
  for(const result of [activitiesResult,linksResult,suggestionsResult,identitiesResult,rolesResult,edgesResult]){
    if(result.error)throw new Error('RELATIONSHIP_INTELLIGENCE_READ_FAILED:'+result.error.message)
  }
  const activities=(activitiesResult.data??[]).map(activity)
  const links=(linksResult.data??[]).map(link)
  const suggestions=(suggestionsResult.data??[]).map(suggestion)
  const identities=(identitiesResult.data??[]).map(identity)
  const roles=(rolesResult.data??[]).map(role)
  const decisionMakerCount=(edgesResult.data??[]).filter(row=>String(row.relation)==='decision_maker'||String(row.relation)==='contact_for').length
  const signals=deriveRelationshipIntelligence({
    entityId,now,activities,links,suggestions,identities,roles,decisionMakerCount,
  })
  const repo=new ProductionRelationshipRepository(client,ownerUserId)
  for(const signal of signals)await repo.upsertIntelligence(signal)
  return signals
}

function activity(row:Row):RelationshipActivity{
  return {
    id:String(row.id),entityId:String(row.entity_id),type:String(row.activity_type),
    occurredAt:String(row.occurred_at),contextRef:typeof row.context_ref==='string'?row.context_ref:undefined,
    summary:String(row.summary),evidenceRefs:strings(row.evidence_refs),
    metadata:row.metadata&&typeof row.metadata==='object'?row.metadata as Record<string,unknown>:{},
  }
}
function link(row:Row):EntityContextLink{
  return {
    id:String(row.id),entityId:String(row.entity_id),
    contextKind:String(row.context_kind) as EntityContextLink['contextKind'],
    contextRef:String(row.context_ref),relation:String(row.relation),occurredAt:String(row.occurred_at),
    evidenceRefs:strings(row.evidence_refs),
  }
}
function suggestion(row:Row):RelationshipFactSuggestion{
  return {
    id:String(row.id),entityId:String(row.entity_id),field:String(row.field),proposedValue:row.proposed_value,
    evidenceRefs:strings(row.evidence_refs),reason:String(row.reason),createdAt:String(row.created_at),
    status:String(row.status) as RelationshipFactSuggestion['status'],
  }
}
function identity(row:Row):RelationshipIdentity{
  return {
    id:String(row.id),entityId:String(row.entity_id),scheme:String(row.scheme) as RelationshipIdentity['scheme'],
    value:String(row.value),normalizedValue:String(row.normalized_value),
    verifiedAt:typeof row.verified_at==='string'?row.verified_at:undefined,evidenceRefs:strings(row.evidence_refs),
  }
}
function role(row:Row):RelationshipRole{
  return {
    id:String(row.id),entityId:String(row.entity_id),role:String(row.role) as RelationshipRole['role'],
    domain:String(row.domain),contextRef:typeof row.context_ref==='string'?row.context_ref:undefined,
    validFrom:String(row.valid_from),validTo:typeof row.valid_to==='string'?row.valid_to:undefined,
    evidenceRefs:strings(row.evidence_refs),
  }
}
