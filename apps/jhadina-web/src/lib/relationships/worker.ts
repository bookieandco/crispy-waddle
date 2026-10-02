import type {SupabaseClient} from '@supabase/supabase-js'
import {SupabaseRelationshipWorkQueue,type RelationshipActivity,type RelationshipWorkItem} from '@jhadina/relationship-core'
import {ProductionRelationshipRepository} from './production-repository'
import {refreshRelationshipIntelligence} from './intelligence-runtime'
import {reconcileRelationshipContexts} from './context-reconciler'
import {reconcilePrimeSubcontractorMatches} from './prime-subcontractor-runtime'

type Row=Record<string,unknown>

function string(value:unknown):string|undefined{
  return typeof value==='string'&&value.length?value:undefined
}
function strings(value:unknown):string[]{
  return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[]
}
function workFromClaim(row:Row):RelationshipWorkItem{
  return {
    id:String(row.id),ownerUserId:String(row.user_id),capability:String(row.capability),
    entityRef:String(row.entity_ref),reason:String(row.reason),dueAt:String(row.due_at),
    priority:Number(row.priority??0),status:String(row.status) as RelationshipWorkItem['status'],
    leaseOwner:string(row.lease_owner),leaseExpiresAt:string(row.lease_expires_at),
    attemptCount:Number(row.attempt_count??0),budget:typeof row.budget==='number'?row.budget:undefined,
    correlationId:String(row.correlation_id),evidenceRefs:strings(row.evidence_refs),
    lastError:string(row.last_error),executionAuthorized:false,
  }
}

const SAFE_CAPABILITIES=new Set([
  'relationship.research',
  'relationship.refresh_provider',
  'relationship.refresh_prime',
  'relationship.quote_continuity',
])

export async function runRelationshipWorkerCycle(
  client:SupabaseClient,
  input:{
    now?:string
    workerId?:string
    leaseSeconds?:number
    limitPerOwner?:number
    crashAfterFirstClaim?:boolean
  }={},
){
  const now=input.now??new Date().toISOString()
  const workerId=input.workerId??'relationship-worker'
  const leaseSeconds=Math.min(Math.max(input.leaseSeconds??120,1),3600)
  const limit=Math.min(Math.max(input.limitPerOwner??10,1),100)

  const {data:ownerRows,error:ownerError}=await client.from('jhadina_relationship_work_items')
    .select('user_id,status,due_at,lease_expires_at')
    .in('status',['pending','leased'])
    .limit(1000)
  if(ownerError)throw new Error('RELATIONSHIP_WORK_OWNER_SCAN_FAILED:'+ownerError.message)
  const nowMs=Date.parse(now)
  const ownerIds=[...new Set((ownerRows??[]).filter(row=>{
    if(row.status==='pending')return Date.parse(String(row.due_at))<=nowMs
    return row.status==='leased'&&row.lease_expires_at&&Date.parse(String(row.lease_expires_at))<=nowMs
  }).map(row=>String(row.user_id)))]
  const fusion=await reconcileRelationshipContexts(client,{limit:250,now})
  const primeSubMatches=[] as Awaited<ReturnType<typeof reconcilePrimeSubcontractorMatches>>[]
  for(const ownerUserId of ownerIds){
    const repo=new ProductionRelationshipRepository(client,ownerUserId)
    primeSubMatches.push(await reconcilePrimeSubcontractorMatches(client,repo,{limit:250,now}))
  }
  const result={owners:ownerIds.length,claimed:0,completed:0,failed:0,fusion,primeSubMatches,executionAuthority:false as const}

  for(const ownerUserId of ownerIds){
    const queue=new SupabaseRelationshipWorkQueue(client as never)
    const claims=await queue.claimDue({ownerUserId,workerId,now,leaseSeconds,limit})
    result.claimed+=claims.length
    if(input.crashAfterFirstClaim&&claims.length)throw new Error('RELATIONSHIP_WORKER_FORCED_CRASH')
    for(const raw of claims){
      const work=workFromClaim(raw)
      try{
        if(!SAFE_CAPABILITIES.has(work.capability))throw new Error('RELATIONSHIP_WORK_CAPABILITY_NOT_ADMITTED:'+work.capability)
        if(work.executionAuthorized!==false)throw new Error('RELATIONSHIP_WORK_EXECUTION_AUTHORITY_FORBIDDEN')
        await executeReadOnlyRelationshipWork(client,work,now)
        await queue.complete({ownerUserId,itemId:work.id,workerId,completedAt:now})
        result.completed+=1
      }catch{
        result.failed+=1
        // Deliberately do not mutate the lease on failure. The lease expires and
        // another worker can reclaim it, proving crash-safe at-least-once work.
      }
    }
  }
  return Object.freeze(result)
}

async function executeReadOnlyRelationshipWork(
  client:SupabaseClient,
  work:RelationshipWorkItem,
  now:string,
){
  const repo=new ProductionRelationshipRepository(client,work.ownerUserId)
  const entity=await repo.getEntity(work.entityRef)
  if(!entity)throw new Error('RELATIONSHIP_WORK_ENTITY_NOT_FOUND')

  const activity:RelationshipActivity={
    id:'activity:worker:'+work.id+':attempt:'+work.attemptCount,
    entityId:work.entityRef,
    type:'relationship.worker.'+work.capability.replace(/^relationship\./,'')+'.completed',
    occurredAt:now,
    summary:'Read-only relationship research cycle completed.',
    evidenceRefs:[...new Set([...work.evidenceRefs,'relationship-work:'+work.id])],
    metadata:{
      capability:work.capability,
      attemptCount:work.attemptCount,
      correlationId:work.correlationId,
      externalMutationPerformed:false,
      executionAuthority:false,
    },
  }
  await repo.appendActivity(activity)
  await refreshRelationshipIntelligence(client,work.ownerUserId,work.entityRef,now)
}
