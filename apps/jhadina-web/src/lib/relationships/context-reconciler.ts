import type {SupabaseClient} from '@supabase/supabase-js'
import {normalizeRelationshipIdentity} from '@jhadina/relationship-core'
import {ProductionRelationshipRepository} from './production-repository'
import {persistRelationshipContextEvent,relationshipContextAdapters} from './context-fusion'

function text(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value.trim():undefined
}

function evidenceRefs(value:unknown,fallback:string):string[]{
  const out=new Set<string>()
  const visit=(item:unknown,depth=0)=>{
    if(depth>3||item===null||item===undefined)return
    if(typeof item==='string'){if(item.trim())out.add(item.trim());return}
    if(Array.isArray(item)){for(const child of item)visit(child,depth+1);return}
    if(typeof item==='object'){
      const row=item as Record<string,unknown>
      for(const key of ['id','ref','url','sourceUrl','evidenceRef']){
        const candidate=text(row[key])
        if(candidate)out.add(candidate)
      }
      for(const key of ['evidence','evidenceRefs','sourceRefs','sources'])visit(row[key],depth+1)
    }
  }
  visit(value)
  if(!out.size)out.add(fallback)
  return [...out]
}

function explicitRelationshipRefs(value:unknown):string[]{
  const out=new Set<string>()
  const visit=(item:unknown,depth=0)=>{
    if(depth>4||item===null||item===undefined)return
    if(typeof item==='string'){
      const trimmed=item.trim()
      if(trimmed.startsWith('relationship:'))out.add(trimmed.slice('relationship:'.length))
      if(trimmed.startsWith('crm:'))out.add(trimmed.slice('crm:'.length))
      return
    }
    if(Array.isArray(item)){for(const child of item)visit(child,depth+1);return}
    if(typeof item==='object'){
      const row=item as Record<string,unknown>
      for(const key of ['relationshipEntityId','crmEntityId']){
        const candidate=text(row[key])
        if(candidate)out.add(candidate)
      }
      for(const child of Object.values(row))visit(child,depth+1)
    }
  }
  visit(value)
  return [...out]
}

export async function reconcileRelationshipContexts(
  client:SupabaseClient,
  input:{ownerUserId?:string;limit?:number;now?:string}={},
){
  const limit=Math.min(Math.max(input.limit??250,1),1000)
  const now=input.now??new Date().toISOString()
  const owners=input.ownerUserId?[input.ownerUserId]:await relationshipOwners(client,limit)
  const summary={owners:owners.length,samDocuments:0,socialMessages:0,growthEvents:0,tasks:0,artifacts:0}

  for(const ownerUserId of owners){
    const repo=new ProductionRelationshipRepository(client,ownerUserId)
    summary.samDocuments+=await reconcileSamDocuments(client,repo,limit,now)
    summary.socialMessages+=await reconcileSocialMessages(client,repo,limit)
    summary.growthEvents+=await reconcileGrowthEvents(client,repo,limit)
    summary.tasks+=await reconcileWorkTasks(client,repo,limit)
    summary.artifacts+=await reconcileArtifacts(client,repo,limit)
  }
  return Object.freeze(summary)
}

async function relationshipOwners(client:SupabaseClient,limit:number):Promise<string[]>{
  const {data,error}=await client.from('jhadina_relationship_entities').select('user_id').limit(limit)
  if(error)throw new Error('RELATIONSHIP_CONTEXT_OWNER_SCAN_FAILED:'+error.message)
  return [...new Set((data??[]).map(row=>String(row.user_id)))]
}

async function reconcileSamDocuments(
  client:SupabaseClient,
  repo:ProductionRelationshipRepository,
  limit:number,
  now:string,
):Promise<number>{
  const {data:links,error:linkError}=await client.from('jhadina_relationship_context_links')
    .select('entity_id,context_ref,evidence_refs')
    .eq('user_id',repo.ownerUserId)
    .eq('context_kind','opportunity')
    .eq('relation','sam:provider')
    .limit(limit)
  if(linkError)throw new Error('RELATIONSHIP_SAM_LINK_SCAN_FAILED:'+linkError.message)
  const noticeIds=[...new Set((links??[]).map(row=>String(row.context_ref)).filter(Boolean))]
  if(!noticeIds.length)return 0
  const {data:docs,error:docError}=await client.from('jhadina_sam_documents')
    .select('id,notice_id,source_url,source_kind,checksum,fetch_status,evidence,fetched_at,updated_at')
    .in('notice_id',noticeIds)
    .order('updated_at',{ascending:false})
    .limit(limit)
  if(docError)throw new Error('RELATIONSHIP_SAM_DOCUMENT_SCAN_FAILED:'+docError.message)
  const byNotice=new Map<string,string[]>()
  for(const link of links??[]){
    const key=String(link.context_ref)
    const entries=byNotice.get(key)??[]
    entries.push(String(link.entity_id))
    byNotice.set(key,entries)
  }
  let count=0
  for(const doc of docs??[]){
    const entities=byNotice.get(String(doc.notice_id))??[]
    const refs=evidenceRefs([doc.evidence,doc.source_url,doc.checksum],'sam-document:'+String(doc.id))
    for(const entityId of entities){
      await persistRelationshipContextEvent(repo,relationshipContextAdapters.document({
        entityId,
        documentRef:'sam-document:'+String(doc.id),
        occurredAt:text(doc.fetched_at)??text(doc.updated_at)??now,
        evidenceRefs:refs,
        label:text(doc.source_kind)??'SAM document',
      }))
      count+=1
    }
  }
  return count
}

async function reconcileSocialMessages(
  client:SupabaseClient,
  repo:ProductionRelationshipRepository,
  limit:number,
):Promise<number>{
  const {data,error}=await client.from('jhadina_social_message_outbox')
    .select('id,platform,provider,provider_recipient_id,status,provider_message_id,created_at,updated_at')
    .eq('user_id',repo.ownerUserId)
    .order('updated_at',{ascending:false})
    .limit(limit)
  if(error)throw new Error('RELATIONSHIP_SOCIAL_MESSAGE_SCAN_FAILED:'+error.message)
  let count=0
  for(const row of data??[]){
    const recipient=text(row.provider_recipient_id)
    if(!recipient)continue
    const platform=text(row.platform)??text(row.provider)??'social'
    const entityId=await repo.resolveEntityId([{
      scheme:'social_handle',
      value:platform+':'+recipient,
      evidenceRefs:['social-message-outbox:'+String(row.id)],
    }])
    if(!entityId)continue
    await persistRelationshipContextEvent(repo,relationshipContextAdapters.message({
      entityId,
      messageRef:text(row.provider_message_id)??'social-outbox:'+String(row.id),
      occurredAt:text(row.updated_at)??text(row.created_at)??new Date().toISOString(),
      evidenceRefs:['social-message-outbox:'+String(row.id)],
      direction:'sent',
    }))
    count+=1
  }
  return count
}

async function reconcileGrowthEvents(
  client:SupabaseClient,
  repo:ProductionRelationshipRepository,
  limit:number,
):Promise<number>{
  const {data:customers,error:customerError}=await client.from('jhadina_growth_customers')
    .select('id,customer_key')
    .eq('user_id',repo.ownerUserId)
    .limit(limit)
  if(customerError)throw new Error('RELATIONSHIP_GROWTH_CUSTOMER_SCAN_FAILED:'+customerError.message)
  const keys=new Map((customers??[]).map(row=>[String(row.id),String(row.customer_key)]))
  if(!keys.size)return 0
  const {data:events,error:eventError}=await client.from('jhadina_growth_customer_events')
    .select('id,customer_id,event_type,product_id,source,occurred_at,evidence')
    .eq('user_id',repo.ownerUserId)
    .order('occurred_at',{ascending:false})
    .limit(limit)
  if(eventError)throw new Error('RELATIONSHIP_GROWTH_EVENT_SCAN_FAILED:'+eventError.message)
  let count=0
  for(const row of events??[]){
    const key=keys.get(String(row.customer_id))
    if(!key)continue
    const normalized=normalizeRelationshipIdentity('external','growth-customer:'+key)
    const {data:identity,error:identityError}=await client.from('jhadina_relationship_identities')
      .select('entity_id')
      .eq('user_id',repo.ownerUserId)
      .eq('scheme','external')
      .eq('normalized_value',normalized)
      .maybeSingle()
    if(identityError)throw new Error('RELATIONSHIP_GROWTH_IDENTITY_LOOKUP_FAILED:'+identityError.message)
    if(!identity?.entity_id)continue
    const eventType=text(row.event_type)??'observed'
    const refs=evidenceRefs(row.evidence,'growth-event:'+String(row.id))
    const isOrder=/order|purchase|checkout|payment|sale|conversion/i.test(eventType)
    if(isOrder){
      await persistRelationshipContextEvent(repo,relationshipContextAdapters.order({
        entityId:String(identity.entity_id),
        orderRef:'growth-event:'+String(row.id),
        occurredAt:text(row.occurred_at)??new Date().toISOString(),
        evidenceRefs:refs,
        status:eventType,
      }))
    }else{
      await persistRelationshipContextEvent(repo,{
        entityId:String(identity.entity_id),kind:'other',contextRef:'growth-event:'+String(row.id),
        relation:'customer_event_for',activityType:'growth.customer.'+eventType,
        summary:'Growth customer event: '+eventType+'.',
        occurredAt:text(row.occurred_at)??new Date().toISOString(),evidenceRefs:refs,
        metadata:{productId:row.product_id,source:row.source},
      })
    }
    count+=1
  }
  return count
}

async function reconcileWorkTasks(
  client:SupabaseClient,
  repo:ProductionRelationshipRepository,
  limit:number,
):Promise<number>{
  const {data,error}=await client.from('jhadina_work_session_tasks')
    .select('id,status,input_refs,output_refs,created_at,updated_at')
    .eq('owner_user_id',repo.ownerUserId)
    .order('updated_at',{ascending:false})
    .limit(limit)
  if(error)throw new Error('RELATIONSHIP_TASK_SCAN_FAILED:'+error.message)
  let count=0
  for(const row of data??[]){
    const entityIds=explicitRelationshipRefs([row.input_refs,row.output_refs])
    for(const entityId of entityIds){
      if(!await repo.getEntity(entityId))continue
      await persistRelationshipContextEvent(repo,relationshipContextAdapters.task({
        entityId,taskRef:'work-task:'+String(row.id),status:text(row.status)??'observed',
        occurredAt:text(row.updated_at)??text(row.created_at)??new Date().toISOString(),
        evidenceRefs:['work-task:'+String(row.id)],
      }))
      count+=1
    }
  }
  return count
}

async function reconcileArtifacts(
  client:SupabaseClient,
  repo:ProductionRelationshipRepository,
  limit:number,
):Promise<number>{
  const {data,error}=await client.from('jhadina_artifacts')
    .select('id,original_name,provenance,derivative_refs,created_at')
    .eq('owner_user_id',repo.ownerUserId)
    .order('created_at',{ascending:false})
    .limit(limit)
  if(error)throw new Error('RELATIONSHIP_ARTIFACT_SCAN_FAILED:'+error.message)
  let count=0
  for(const row of data??[]){
    const entityIds=explicitRelationshipRefs([row.provenance,row.derivative_refs])
    for(const entityId of entityIds){
      if(!await repo.getEntity(entityId))continue
      await persistRelationshipContextEvent(repo,relationshipContextAdapters.file({
        entityId,fileRef:'artifact:'+String(row.id),occurredAt:text(row.created_at)??new Date().toISOString(),
        evidenceRefs:['artifact:'+String(row.id)],label:text(row.original_name),
      }))
      count+=1
    }
  }
  return count
}
