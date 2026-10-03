import type {SupabaseClient} from '@supabase/supabase-js'
import {
  buildSafeRelationshipWork,
  chooseCanonicalOrganizationId,
  normalizeRelationshipIdentity,
  projectDomainRelationship,
  recommendedPipelineStage,
  type CanonicalIdentityCandidate,
  type RelationshipIdentity,
  type RelationshipRoleKind,
  type RelationshipDomain,
} from '@jhadina/relationship-core'
import {isSideHustleFamily,type ProviderRelationshipEvent,type SideHustleFamily} from '@jhadina/opportunity-core'
import {ProductionRelationshipRepository} from './production-repository'
import {persistProviderRelationshipEvent} from './sam-event-bridge'

function string(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value.trim():undefined
}
function object(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
}
function sideHustleFamilyFromPayload(value:unknown):SideHustleFamily|undefined{
  const payload=object(value)
  const profile=object(payload.sideHustleProfile)
  const direct=payload.sideHustleFamily??profile.family??object(payload.metadata).sideHustleFamily
  return isSideHustleFamily(direct)?direct:undefined
}
function sideHustleBusinessRefFromPayload(value:unknown):string|undefined{
  const payload=object(value)
  const metadata=object(payload.metadata)
  const direct=payload.sideHustleBusinessRef??payload.ventureId??metadata.sideHustleBusinessRef??metadata.ventureId
  return typeof direct==='string'&&direct.trim()?direct.trim():undefined
}
function slug(value:string):string{
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'unknown'
}
export function awardProviderIdentityCandidates(
  providerId:string,
  evidenceRefs:readonly string[],
):CanonicalIdentityCandidate[]{
  const match=/^provider:award:([a-z0-9]{12})$/i.exec(providerId.trim())
  if(!match)return[]
  return [{scheme:'uei',value:match[1]!.toUpperCase(),evidenceRefs:[...evidenceRefs]}]
}

function refs(value:unknown,fallback:string):string[]{
  const out=new Set<string>()
  const visit=(entry:unknown,depth=0)=>{
    if(depth>2||entry===null||entry===undefined)return
    if(typeof entry==='string'){if(entry.trim())out.add(entry.trim());return}
    if(Array.isArray(entry)){for(const child of entry)visit(child,depth+1);return}
    if(typeof entry==='object'){
      const row=entry as Record<string,unknown>
      for(const key of ['sourceRef','evidenceRef','url','sourceUrl','ref','id']){
        if(typeof row[key]==='string'&&String(row[key]).trim())out.add(String(row[key]).trim())
      }
      for(const key of ['evidenceRefs','sourceRefs','evidence','sources'])visit(row[key],depth+1)
    }
  }
  visit(value)
  if(!out.size)out.add(fallback)
  return [...out]
}

async function addIdentities(
  repo:ProductionRelationshipRepository,
  entityId:string,
  candidates:readonly CanonicalIdentityCandidate[],
  verifiedAt:string,
){
  for(const candidate of candidates){
    const normalized=normalizeRelationshipIdentity(candidate.scheme,candidate.value)
    const identity:RelationshipIdentity={
      id:'identity:'+entityId+':'+candidate.scheme+':'+slug(normalized),
      entityId,
      scheme:candidate.scheme,
      value:candidate.value,
      normalizedValue:normalized,
      verifiedAt,
      evidenceRefs:[...candidate.evidenceRefs],
    }
    await repo.upsertIdentity(identity)
  }
}

export type RelationshipBackfillSummary={
  samProviders:number
  publicPrimes:number
  publicProviders:number
  publicBuyers:number
  prospects:number
  growthCustomers:number
  socialContacts:number
  externalCandidates:number
}

export async function runRelationshipBackfill(
  client:SupabaseClient,
  ownerUserId:string,
  input:{limitPerSource?:number;now?:string}={},
):Promise<RelationshipBackfillSummary>{
  const limit=Math.min(Math.max(input.limitPerSource??250,1),1000)
  const now=input.now??new Date().toISOString()
  const repo=new ProductionRelationshipRepository(client,ownerUserId)
  await repo.ensureDefaultPipelines()
  const summary:RelationshipBackfillSummary={
    samProviders:0,publicPrimes:0,publicProviders:0,publicBuyers:0,
    prospects:0,growthCustomers:0,socialContacts:0,externalCandidates:0,
  }

  const sam=await client.from('jhadina_sam_provider_candidates')
    .select('id,notice_id,provider_key,provider_name,uei,cage,evidence,sources,discovered_at')
    .order('discovered_at',{ascending:true})
    .limit(limit)
  if(sam.error)throw new Error('RELATIONSHIP_BACKFILL_SAM_FAILED:'+sam.error.message)
  for(const row of sam.data??[]){
    const providerId=string(row.provider_key)
    const displayName=string(row.provider_name)
    const opportunityId=string(row.notice_id)
    if(!providerId||!displayName||!opportunityId)continue
    const evidenceRefs=refs([row.evidence,row.sources],'sam-provider:'+String(row.id))
    const identities:CanonicalIdentityCandidate[]=[]
    if(string(row.uei))identities.push({scheme:'uei',value:String(row.uei),evidenceRefs})
    if(string(row.cage))identities.push({scheme:'cage',value:String(row.cage),evidenceRefs})
    const event:ProviderRelationshipEvent={
      id:'backfill:sam-provider:'+String(row.id),
      providerId,
      opportunityId,
      kind:'discovered',
      occurredAt:string(row.discovered_at)??now,
      evidenceRefs,
      notes:'Provider discovered in the canonical SAM provider candidate store.',
    }
    await persistProviderRelationshipEvent({repo,displayName,event,identities})
    summary.samProviders+=1
  }

  const primes=await client.from('jhadina_public_prime_profiles')
    .select('provider_id,provider_name,evidence_refs,updated_at')
    .order('updated_at',{ascending:false})
    .limit(limit)
  if(primes.error)throw new Error('RELATIONSHIP_BACKFILL_PRIMES_FAILED:'+primes.error.message)
  for(const row of primes.data??[]){
    const providerId=string(row.provider_id),displayName=string(row.provider_name)
    if(!providerId||!displayName)continue
    const evidenceRefs=refs(row.evidence_refs,'public-prime:'+providerId)
    await upsertGenericOrganization(repo,{
      sourceNamespace:'public-prime',sourceId:providerId,displayName,role:'prime',domain:'opportunity',
      contextRef:'public-prime:'+providerId,occurredAt:string(row.updated_at)??now,evidenceRefs,
      activityType:'public.prime.discovered',activitySummary:'Prime discovered from public award intelligence.',
      pipelineId:'sam_teaming',sideHustleFamily:'procurement_subcontracting',relationshipLane:'primes',
      identities:awardProviderIdentityCandidates(providerId,evidenceRefs),
    })
    summary.publicPrimes+=1
  }

  const providers=await client.from('jhadina_public_package_provider_candidates')
    .select('package_id,provider_id,legal_name,evidence_refs,evidence,discovered_at')
    .order('discovered_at',{ascending:false})
    .limit(limit)
  if(providers.error)throw new Error('RELATIONSHIP_BACKFILL_PUBLIC_PROVIDERS_FAILED:'+providers.error.message)
  for(const row of providers.data??[]){
    const providerId=string(row.provider_id),displayName=string(row.legal_name),packageId=string(row.package_id)
    if(!providerId||!displayName||!packageId)continue
    const evidenceRefs=refs([row.evidence_refs,row.evidence],'public-provider:'+providerId)
    await upsertGenericOrganization(repo,{
      sourceNamespace:'public-provider',sourceId:providerId,displayName,role:'provider',domain:'opportunity',
      contextRef:'public-work-package:'+packageId,occurredAt:string(row.discovered_at)??now,evidenceRefs,
      activityType:'public.provider.discovered',activitySummary:'Provider discovered for a public-sector work package.',
      pipelineId:'subcontractor_acquisition',sideHustleFamily:'procurement_subcontracting',relationshipLane:'subcontractors',
      identities:awardProviderIdentityCandidates(providerId,evidenceRefs),
    })
    summary.publicProviders+=1
  }

  const inbox=await client.from('jhadina_public_opportunity_inbox')
    .select('id,source_id,state_code,county_name,locality,source_url,payload,captured_at')
    .eq('active',true)
    .order('captured_at',{ascending:false})
    .limit(limit)
  if(inbox.error)throw new Error('RELATIONSHIP_BACKFILL_PUBLIC_BUYERS_FAILED:'+inbox.error.message)
  const seenBuyers=new Set<string>()
  for(const row of inbox.data??[]){
    const payload=object(row.payload)
    const opportunity=object(payload.opportunity)
    const jurisdiction=object(opportunity.jurisdiction)
    const locality=string(jurisdiction.locality)??string(row.locality)??string(row.county_name)
    const region=string(jurisdiction.region)??string(row.state_code)
    const sourceId=string(row.source_id)??'public'
    const buyerKey=[sourceId,region,locality].filter(Boolean).join(':')
    if(!buyerKey||seenBuyers.has(buyerKey))continue
    seenBuyers.add(buyerKey)
    const displayName=[locality,region].filter(Boolean).join(', ')||sourceId
    const opportunityId=string(opportunity.id)??String(row.id)
    const evidenceRefs=refs([row.source_url,opportunity.evidence],'public-opportunity:'+String(row.id))
    await upsertGenericOrganization(repo,{
      sourceNamespace:'public-buyer',sourceId:buyerKey,displayName,role:'buyer',domain:'opportunity',
      contextRef:opportunityId,occurredAt:string(row.captured_at)??now,evidenceRefs,
      activityType:'public.buyer.opportunity_observed',
      activitySummary:'Public buyer/jurisdiction linked to an observed opportunity.',
      pipelineId:'public_buyer',sideHustleFamily:'procurement_subcontracting',relationshipLane:'buyers',
    })
    summary.publicBuyers+=1
  }

  const prospects=await client.from('jhadina_prospects')
    .select('id,payload,last_verified_at')
    .eq('user_id',ownerUserId)
    .order('last_verified_at',{ascending:false})
    .limit(limit)
  if(prospects.error)throw new Error('RELATIONSHIP_BACKFILL_PROSPECTS_FAILED:'+prospects.error.message)
  for(const row of prospects.data??[]){
    const payload=object(row.payload)
    const id=String(row.id)
    const displayName=string(payload.companyName)??string(payload.organizationName)??string(payload.name)??string(payload.displayName)
    if(!displayName)continue
    const evidenceRefs=refs(payload.evidence,'prospect:'+id)
    const identities:CanonicalIdentityCandidate[]=[]
    if(string(payload.domain))identities.push({scheme:'domain',value:String(payload.domain),evidenceRefs})
    if(string(payload.email))identities.push({scheme:'email',value:String(payload.email),evidenceRefs})
    const sideHustleFamily=sideHustleFamilyFromPayload(payload)
    const sideHustleBusinessRef=sideHustleBusinessRefFromPayload(payload)
    await upsertGenericOrganization(repo,{
      sourceNamespace:'prospect',sourceId:id,displayName,role:'prospect',domain:'opportunity',
      contextRef:'prospect:'+id,occurredAt:string(row.last_verified_at)??now,evidenceRefs,
      activityType:'commercial.prospect.discovered',activitySummary:'Commercial prospect imported from prospect intelligence.',
      pipelineId:'commercial_prospecting',identities,sideHustleFamily,
      businessRef:sideHustleBusinessRef,
      relationshipLane:sideHustleFamily?'prospects':undefined,
    })
    summary.prospects+=1
  }

  const customers=await client.from('jhadina_growth_customers')
    .select('id,brand_id,customer_key,lifecycle_stage,first_seen_at,last_seen_at')
    .eq('user_id',ownerUserId)
    .order('last_seen_at',{ascending:false})
    .limit(limit)
  if(customers.error)throw new Error('RELATIONSHIP_BACKFILL_CUSTOMERS_FAILED:'+customers.error.message)
  for(const row of customers.data??[]){
    const key=string(row.customer_key)
    if(!key)continue
    const evidenceRefs=['growth:customer:'+String(row.id)]
    await upsertGenericOrganization(repo,{
      sourceNamespace:'growth-customer',sourceId:key,displayName:'Customer '+key.slice(-8),
      role:'customer',domain:'growth',contextRef:'growth-customer:'+String(row.id),
      occurredAt:string(row.last_seen_at)??string(row.first_seen_at)??now,evidenceRefs,
      activityType:'growth.customer.'+(string(row.lifecycle_stage)??'observed'),
      activitySummary:'Customer lifecycle record imported from Growth Core.',
      pipelineId:'customer_lifecycle',
      identities:[{scheme:'external',value:'growth-customer:'+key,evidenceRefs}],
    })
    summary.growthCustomers+=1
  }

  const social=await client.from('jhadina_social_contact_states')
    .select('id,recipient_ref,provider,platform,provider_recipient_id,state,evidence,observed_at')
    .eq('user_id',ownerUserId)
    .order('observed_at',{ascending:false})
    .limit(limit)
  if(social.error)throw new Error('RELATIONSHIP_BACKFILL_SOCIAL_FAILED:'+social.error.message)
  for(const row of social.data??[]){
    const recipient=string(row.recipient_ref)??string(row.provider_recipient_id)
    if(!recipient)continue
    const evidenceRefs=refs(row.evidence,'social-contact:'+String(row.id))
    await upsertGenericOrganization(repo,{
      sourceNamespace:'social-contact',sourceId:recipient,displayName:'Social contact '+recipient.slice(-8),
      role:'prospect',domain:'social',contextRef:'social-contact:'+String(row.id),
      occurredAt:string(row.observed_at)??now,evidenceRefs,
      activityType:'social.contact.'+(string(row.state)??'observed'),
      activitySummary:'Social contact state imported from Social Core.',
      pipelineId:'commercial_prospecting',
      identities:[{scheme:'social_handle',value:(string(row.platform)??string(row.provider)??'social')+':'+recipient,evidenceRefs}],
    })
    summary.socialContacts+=1
  }

  return summary
}

export async function backfillExternalRelationshipCandidates(
  repo:ProductionRelationshipRepository,
  candidates:readonly {
    sourceNamespace:string
    sourceId:string
    displayName:string
    role:RelationshipRoleKind
    domain:RelationshipDomain
    contextRef:string
    occurredAt:string
    evidenceRefs:readonly string[]
    identities?:readonly CanonicalIdentityCandidate[]
    pipelineId?:string
    sideHustleFamily?:SideHustleFamily
    businessRef?:string
    relationshipLane?:string
    activityType:string
    activitySummary:string
  }[],
):Promise<number>{
  let count=0
  for(const candidate of candidates){
    await upsertGenericOrganization(repo,candidate)
    count+=1
  }
  return count
}

async function upsertGenericOrganization(
  repo:ProductionRelationshipRepository,
  input:{
    sourceNamespace:string
    sourceId:string
    displayName:string
    role:RelationshipRoleKind
    domain:RelationshipDomain
    contextRef:string
    occurredAt:string
    evidenceRefs:readonly string[]
    identities?:readonly CanonicalIdentityCandidate[]
    pipelineId?:string
    sideHustleFamily?:SideHustleFamily
    businessRef?:string
    relationshipLane?:string
    activityType:string
    activitySummary:string
  },
){
  const identities=input.identities??[]
  const existing=await repo.resolveEntityId(identities)
  const entityId=existing??chooseCanonicalOrganizationId({
    sourceNamespace:input.sourceNamespace,
    sourceId:input.sourceId,
    identities,
  })
  const projection=projectDomainRelationship({
    organizationId:entityId,
    ownerUserId:repo.ownerUserId,
    displayName:input.displayName,
    domain:input.domain,
    role:input.role,
    contextRef:input.contextRef,
    occurredAt:input.occurredAt,
    evidenceRefs:input.evidenceRefs,
    activityType:input.activityType,
    activitySummary:input.activitySummary,
  })
  await repo.upsertProjection(projection)
  await addIdentities(repo,entityId,[
    ...identities,
    {scheme:'external',value:input.sourceNamespace+':'+input.sourceId,evidenceRefs:input.evidenceRefs},
  ],input.occurredAt)
  if(input.pipelineId){
    const stageId=recommendedPipelineStage(input.pipelineId,input.activityType)
      ??(input.pipelineId==='customer_lifecycle'?'lead':'discovered')
    await repo.upsertPipelineRecord({
      id:'pipeline-record:'+input.pipelineId+':'+entityId,
      entityId,pipelineId:input.pipelineId,stageId,
      values:{source:input.sourceNamespace,opportunityRef:input.contextRef},
      updatedAt:input.occurredAt,
    })
    if(input.sideHustleFamily){
      await repo.upsertSideHustlePipelineRecord({
        family:input.sideHustleFamily,
        businessRef:input.businessRef,
        entityId,
        pipelineId:input.pipelineId as import('@jhadina/opportunity-core').SideHustleRelationshipPipelineId,
        stageId,
        values:{
          source:input.sourceNamespace,
          opportunityRef:input.contextRef,
          ...(input.relationshipLane?{relationshipLane:input.relationshipLane}:{}),
        },
        updatedAt:input.occurredAt,
      })
    }
  }
  await repo.enqueueWork(buildSafeRelationshipWork({
    id:'work:'+entityId+':relationship-refresh',
    ownerUserId:repo.ownerUserId,
    entityId,
    capability:'relationship.research',
    reason:'Refresh relationship identity, evidence and opportunity context.',
    dueAt:new Date(Date.parse(input.occurredAt)+30*86_400_000).toISOString(),
    priority:25,
    correlationId:'backfill:'+input.sourceNamespace+':'+input.sourceId,
    evidenceRefs:input.evidenceRefs,
    budget:3,
  }))
  return entityId
}
