import {
  buildSafeRelationshipWork,
  chooseCanonicalOrganizationId,
  normalizeRelationshipIdentity,
  projectSamPrimeEvent,
  projectSamProviderEvent,
  recommendedPipelineStage,
  type CanonicalIdentityCandidate,
  type RelationshipIdentity,
} from '@jhadina/relationship-core'
import type {PrimeRelationshipEvent,ProviderRelationshipEvent} from '@jhadina/opportunity-core'
import {ProductionRelationshipRepository} from './production-repository'
import {persistDurableIdentityEvidence} from './identity-evidence'
import {persistRelationshipContextEvent,relationshipContextAdapters} from './context-fusion'

function future(at:string,days:number):string{
  const base=Date.parse(at)
  return new Date((Number.isFinite(base)?base:Date.now())+days*86_400_000).toISOString()
}
function evidence(event:{id:string;evidenceRefs:string[]}):string[]{
  return [...new Set([...event.evidenceRefs,'sam:relationship-event:'+event.id])]
}

async function persistIdentities(
  repo:ProductionRelationshipRepository,
  entityId:string,
  identities:readonly CanonicalIdentityCandidate[],
  verifiedAt:string,
){
  for(const row of identities){
    const normalized=normalizeRelationshipIdentity(row.scheme,row.value)
    const identity:RelationshipIdentity={
      id:'identity:'+entityId+':'+row.scheme+':'+normalized.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      entityId,
      scheme:row.scheme,
      value:row.value,
      normalizedValue:normalized,
      verifiedAt,
      evidenceRefs:[...row.evidenceRefs],
    }
    await repo.upsertIdentity(identity)
  }
}

export async function persistProviderRelationshipEvent(input:{
  repo:ProductionRelationshipRepository
  displayName:string
  event:ProviderRelationshipEvent
  identities?:readonly CanonicalIdentityCandidate[]
}){
  const identities=input.identities??[]
  const existing=await input.repo.resolveEntityId(identities)
  const entityId=existing??chooseCanonicalOrganizationId({
    sourceNamespace:'sam-provider',
    sourceId:input.event.providerId,
    identities,
  })
  const refs=evidence(input.event)
  const projection=projectSamProviderEvent({
    ownerUserId:input.repo.ownerUserId,
    organizationId:entityId,
    displayName:input.displayName,
    event:{
      ...input.event,
      providerId:entityId,
      evidenceRefs:refs,
    },
  })
  await input.repo.upsertProjection(projection)
  await persistIdentities(input.repo,entityId,[
    ...identities,
    {scheme:'external',value:'sam-provider:'+input.event.providerId,evidenceRefs:refs},
  ],input.event.occurredAt)
  await persistDurableIdentityEvidence({
    repo:input.repo,entityId,identities,observedAt:input.event.occurredAt,sourceKind:'sam_provider_relationship',
  })

  if(input.event.kind==='contracted'){
    await persistRelationshipContextEvent(input.repo,relationshipContextAdapters.contract({
      entityId,contractRef:'sam-provider-event:'+input.event.id,occurredAt:input.event.occurredAt,
      evidenceRefs:refs,status:'contracted',
    }))
  }
  const stage=recommendedPipelineStage('subcontractor_acquisition',projection.activity.type)??'discovered'
  await input.repo.upsertPipelineRecord({
    id:'pipeline-record:subcontractor:'+entityId,
    entityId,
    pipelineId:'subcontractor_acquisition',
    stageId:stage,
    values:{source:'sam',opportunityRef:input.event.opportunityId},
    updatedAt:input.event.occurredAt,
  })
  await input.repo.upsertSideHustlePipelineRecord({
    family:'procurement_subcontracting',
    entityId,
    pipelineId:'subcontractor_acquisition',
    stageId:stage,
    values:{source:'sam',opportunityRef:input.event.opportunityId,relationshipLane:'subcontractors'},
    updatedAt:input.event.occurredAt,
  })

  const dueDays=input.event.kind==='quote_received'||input.event.kind==='quote_refreshed'?14:
    input.event.kind==='capacity_changed'?0:30
  if(['discovered','quote_received','quote_refreshed','capacity_changed','provider_reconfirmed'].includes(input.event.kind)){
    await input.repo.enqueueWork(buildSafeRelationshipWork({
      id:'work:'+entityId+':provider-continuity',
      ownerUserId:input.repo.ownerUserId,
      entityId,
      capability:input.event.kind.includes('quote')?'relationship.quote_continuity':'relationship.refresh_provider',
      reason:input.event.kind.includes('quote')?'Revalidate quote validity and provider capacity.':'Refresh provider identity, contact and capacity evidence.',
      dueAt:future(input.event.occurredAt,dueDays),
      priority:input.event.kind==='capacity_changed'?90:50,
      correlationId:'sam:'+input.event.opportunityId+':'+input.event.id,
      evidenceRefs:refs,
      budget:5,
    }))
  }
  return {entityId,projection,stage}
}

export async function persistPrimeRelationshipEvent(input:{
  repo:ProductionRelationshipRepository
  displayName:string
  event:PrimeRelationshipEvent
  identities?:readonly CanonicalIdentityCandidate[]
}){
  const identities=input.identities??[]
  const existing=await input.repo.resolveEntityId(identities)
  const entityId=existing??chooseCanonicalOrganizationId({
    sourceNamespace:'sam-prime',
    sourceId:input.event.primeId,
    identities,
  })
  const refs=evidence(input.event)
  const projection=projectSamPrimeEvent({
    ownerUserId:input.repo.ownerUserId,
    organizationId:entityId,
    displayName:input.displayName,
    event:{...input.event,primeId:entityId,evidenceRefs:refs},
  })
  await input.repo.upsertProjection(projection)
  await persistIdentities(input.repo,entityId,[
    ...identities,
    {scheme:'external',value:'sam-prime:'+input.event.primeId,evidenceRefs:refs},
  ],input.event.occurredAt)
  await persistDurableIdentityEvidence({
    repo:input.repo,entityId,identities,observedAt:input.event.occurredAt,sourceKind:'sam_prime_relationship',
  })
  if(input.event.kind==='subcontract_signed'){
    await persistRelationshipContextEvent(input.repo,relationshipContextAdapters.contract({
      entityId,contractRef:'sam-prime-event:'+input.event.id,occurredAt:input.event.occurredAt,
      evidenceRefs:refs,status:'subcontract_signed',
    }))
  }
  const stage=recommendedPipelineStage('sam_teaming',projection.activity.type)??'discovered'
  await input.repo.upsertPipelineRecord({
    id:'pipeline-record:sam-teaming:'+entityId,
    entityId,
    pipelineId:'sam_teaming',
    stageId:stage,
    values:{source:'sam',opportunityRef:input.event.opportunityId??''},
    updatedAt:input.event.occurredAt,
  })
  await input.repo.upsertSideHustlePipelineRecord({
    family:'procurement_subcontracting',
    entityId,
    pipelineId:'sam_teaming',
    stageId:stage,
    values:{source:'sam',opportunityRef:input.event.opportunityId??'',relationshipLane:'primes'},
    updatedAt:input.event.occurredAt,
  })
  if(['introduced','meeting_held','rfq_received','quote_submitted','renewal_requested'].includes(input.event.kind)){
    await input.repo.enqueueWork(buildSafeRelationshipWork({
      id:'work:'+entityId+':prime-continuity',
      ownerUserId:input.repo.ownerUserId,
      entityId,
      capability:'relationship.refresh_prime',
      reason:'Refresh prime relationship, buyer overlap and teaming context.',
      dueAt:future(input.event.occurredAt,30),
      priority:45,
      correlationId:'sam-prime:'+input.event.id,
      evidenceRefs:refs,
      budget:5,
    }))
  }
  return {entityId,projection,stage}
}
